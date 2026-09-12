-- Story 43.2: MFA Hardening — Server-side lockout tracking + atomic backup code verification
-- Findings: C1 (sessionStorage bypass), H2 (client-side lockout), H3 (fail-open), M3 (TOCTOU)

-- Ensure pgcrypto is available (Supabase enables it by default, this is idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Table: mfa_lockout_tracking
-- Tracks failed MFA attempts server-side. One row per user (upsert pattern).
-- =============================================================================
CREATE TABLE public.mfa_lockout_tracking (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  backup_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_lockout_tracking ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated users — only service_role and SECURITY DEFINER RPCs can access.
-- A read-only RPC (get_mfa_lockout_status) is exposed to authenticated users below.

-- =============================================================================
-- RPC: check_lockout (pre-check, NO increment)
-- Called BEFORE every MFA verification attempt.
-- Returns current lockout state. Resets expired windows but does NOT increment.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_lockout(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row mfa_lockout_tracking%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_window_minutes INT := 15;
BEGIN
  -- Upsert: create row if not exists
  INSERT INTO mfa_lockout_tracking (user_id, attempt_count, last_attempt_at)
  VALUES (p_user_id, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
  FROM mfa_lockout_tracking
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if currently locked
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', v_row.locked_until,
      'attempts', v_row.attempt_count
    );
  END IF;

  -- Reset if lock expired or last attempt was outside the window
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= v_now THEN
    UPDATE mfa_lockout_tracking
    SET attempt_count = 0, locked_until = NULL
    WHERE user_id = p_user_id;
    v_row.attempt_count := 0;
  ELSIF v_row.last_attempt_at IS NOT NULL
        AND v_row.last_attempt_at < v_now - (v_window_minutes || ' minutes')::interval THEN
    UPDATE mfa_lockout_tracking
    SET attempt_count = 0
    WHERE user_id = p_user_id;
    v_row.attempt_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'locked_until', NULL,
    'attempts', v_row.attempt_count
  );
END;
$$;

-- =============================================================================
-- RPC: record_failed_attempt (post-fail increment)
-- Called AFTER a failed MFA verification. Increments attempt count.
-- After 5 failed attempts within 15 minutes, locks for 15 minutes.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_failed_attempt(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row mfa_lockout_tracking%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_max_attempts INT := 5;
  v_lockout_minutes INT := 15;
BEGIN
  UPDATE mfa_lockout_tracking
  SET attempt_count = attempt_count + 1,
      last_attempt_at = v_now
  WHERE user_id = p_user_id
  RETURNING * INTO v_row;

  -- Lock if threshold reached
  IF v_row.attempt_count >= v_max_attempts THEN
    UPDATE mfa_lockout_tracking
    SET locked_until = v_now + (v_lockout_minutes || ' minutes')::interval
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', v_now + (v_lockout_minutes || ' minutes')::interval,
      'attempts', v_row.attempt_count
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'locked_until', NULL,
    'attempts', v_row.attempt_count
  );
END;
$$;

-- =============================================================================
-- RPC: reset_lockout
-- Called after successful MFA verification (TOTP or backup code).
-- Resets attempt counter and clears lock.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reset_lockout(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mfa_lockout_tracking
  SET attempt_count = 0,
      locked_until = NULL,
      last_attempt_at = NULL
  WHERE user_id = p_user_id;
END;
$$;

-- =============================================================================
-- RPC: verify_and_consume_backup_code
-- Atomic backup code verification: SELECT + UPDATE in one transaction.
-- Uses pgcrypto crypt() for bcrypt comparison (compatible with Deno bcrypt $2a$ hashes).
-- Returns JSONB with 'valid' boolean. FOR UPDATE prevents TOCTOU race condition.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.verify_and_consume_backup_code(p_user_id UUID, p_plain_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id UUID;
  v_factor_id TEXT;
  v_normalized TEXT;
BEGIN
  -- Normalize: uppercase, strip spaces and dashes
  v_normalized := upper(regexp_replace(p_plain_code, '[\s\-]', '', 'g'));

  -- Find matching unused code with row lock (prevents TOCTOU)
  SELECT id, factor_id INTO v_code_id, v_factor_id
  FROM mfa_backup_codes
  WHERE user_id = p_user_id
    AND used_at IS NULL
    AND hashed_code = crypt(v_normalized, hashed_code)
  LIMIT 1
  FOR UPDATE;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  -- Atomically mark as used
  UPDATE mfa_backup_codes
  SET used_at = now()
  WHERE id = v_code_id AND used_at IS NULL;

  -- Also record backup verification timestamp
  INSERT INTO mfa_lockout_tracking (user_id, backup_verified_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE
  SET backup_verified_at = now();

  RETURN jsonb_build_object(
    'valid', true,
    'factor_id', v_factor_id
  );
END;
$$;

-- =============================================================================
-- RPC: check_lockout_for_totp
-- Client-facing wrapper for check_lockout with auth.uid() check.
-- Called from the client BEFORE TOTP verification (AC2: track TOTP attempts).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_lockout_for_totp(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only check own lockout status';
  END IF;
  RETURN check_lockout(p_user_id);
END;
$$;

-- =============================================================================
-- RPC: record_failed_totp_attempt
-- Client-facing wrapper for record_failed_attempt with auth.uid() check.
-- Called from the client AFTER a failed TOTP verification.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_failed_totp_attempt(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only record own failed attempts';
  END IF;
  RETURN record_failed_attempt(p_user_id);
END;
$$;

-- =============================================================================
-- RPC: reset_lockout_after_totp
-- Called from the client after successful TOTP verification (AAL2 achieved).
-- Checks auth.uid() before resetting — only self-reset allowed.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reset_lockout_after_totp(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only reset own lockout';
  END IF;
  PERFORM reset_lockout(p_user_id);
END;
$$;

-- =============================================================================
-- Access Control: server-only RPCs restricted to service_role.
-- Client-facing RPCs have auth.uid() checks and remain callable by authenticated.
-- =============================================================================
REVOKE EXECUTE ON FUNCTION check_lockout FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION record_failed_attempt FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reset_lockout FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION verify_and_consume_backup_code FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_lockout TO service_role;
GRANT EXECUTE ON FUNCTION record_failed_attempt TO service_role;
GRANT EXECUTE ON FUNCTION reset_lockout TO service_role;
GRANT EXECUTE ON FUNCTION verify_and_consume_backup_code TO service_role;

-- =============================================================================
-- RPC: get_mfa_lockout_status
-- Read-only RPC for authenticated users to check their own lockout status
-- and backup verification state. Used by MfaGate and MfaVerify on the client.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_mfa_lockout_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row mfa_lockout_tracking%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Security: users can only query their own status
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only check own lockout status';
  END IF;

  SELECT * INTO v_row
  FROM mfa_lockout_tracking
  WHERE user_id = p_user_id;

  -- No row = no lockout, no backup verification
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'locked', false,
      'locked_until', NULL,
      'attempts', 0,
      'backup_verified', false,
      'backup_verified_at', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now,
    'locked_until', CASE WHEN v_row.locked_until > v_now THEN v_row.locked_until ELSE NULL END,
    'attempts', v_row.attempt_count,
    'backup_verified', v_row.backup_verified_at IS NOT NULL
                       AND v_row.backup_verified_at > v_now - interval '24 hours',
    'backup_verified_at', v_row.backup_verified_at
  );
END;
$$;
