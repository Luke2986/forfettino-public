
-- ========================================
-- Table: mfa_lockout_tracking
-- ========================================
CREATE TABLE IF NOT EXISTS public.mfa_lockout_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  backup_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.mfa_lockout_tracking ENABLE ROW LEVEL SECURITY;

-- RLS: only service_role can access directly; client uses RPC wrappers
CREATE POLICY "Service role full access"
  ON public.mfa_lockout_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_mfa_lockout_tracking_updated_at
  BEFORE UPDATE ON public.mfa_lockout_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- 1. check_lockout (service_role only)
-- ========================================
CREATE OR REPLACE FUNCTION public.check_lockout(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row mfa_lockout_tracking%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM mfa_lockout_tracking WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('locked', false, 'attempts', 0);
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN json_build_object('locked', true, 'locked_until', v_row.locked_until, 'attempts', v_row.failed_attempts);
  END IF;

  -- Lockout expired — reset
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    UPDATE mfa_lockout_tracking SET failed_attempts = 0, locked_until = NULL WHERE user_id = p_user_id;
    RETURN json_build_object('locked', false, 'attempts', 0);
  END IF;

  RETURN json_build_object('locked', false, 'attempts', v_row.failed_attempts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_lockout(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_lockout(uuid) TO service_role;

-- ========================================
-- 2. record_failed_attempt (service_role only)
-- ========================================
CREATE OR REPLACE FUNCTION public.record_failed_attempt(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempts integer;
  v_locked_until timestamptz;
  v_max_attempts CONSTANT integer := 5;
  v_lockout_minutes CONSTANT integer := 15;
BEGIN
  INSERT INTO mfa_lockout_tracking (user_id, failed_attempts)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET failed_attempts = mfa_lockout_tracking.failed_attempts + 1
  RETURNING failed_attempts INTO v_attempts;

  IF v_attempts >= v_max_attempts THEN
    v_locked_until := now() + (v_lockout_minutes || ' minutes')::interval;
    UPDATE mfa_lockout_tracking SET locked_until = v_locked_until WHERE user_id = p_user_id;
    RETURN json_build_object('locked', true, 'locked_until', v_locked_until, 'attempts', v_attempts);
  END IF;

  RETURN json_build_object('locked', false, 'attempts', v_attempts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_failed_attempt(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_attempt(uuid) TO service_role;

-- ========================================
-- 3. reset_lockout (service_role only)
-- ========================================
CREATE OR REPLACE FUNCTION public.reset_lockout(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE mfa_lockout_tracking
  SET failed_attempts = 0, locked_until = NULL
  WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_lockout(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_lockout(uuid) TO service_role;

-- ========================================
-- 4. verify_and_consume_backup_code (service_role only)
-- ========================================
CREATE OR REPLACE FUNCTION public.verify_and_consume_backup_code(p_user_id uuid, p_plain_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row mfa_backup_codes%ROWTYPE;
  v_found boolean := false;
BEGIN
  FOR v_row IN
    SELECT * FROM mfa_backup_codes
    WHERE user_id = p_user_id AND used_at IS NULL
  LOOP
    IF v_row.hashed_code = crypt(p_plain_code, v_row.hashed_code) THEN
      -- Mark code as used
      UPDATE mfa_backup_codes SET used_at = now() WHERE id = v_row.id;
      -- Set backup_verified_at
      INSERT INTO mfa_lockout_tracking (user_id, backup_verified_at)
      VALUES (p_user_id, now())
      ON CONFLICT (user_id)
      DO UPDATE SET backup_verified_at = now();
      RETURN json_build_object('valid', true, 'factor_id', v_row.factor_id);
    END IF;
  END LOOP;

  RETURN json_build_object('valid', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_and_consume_backup_code(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_consume_backup_code(uuid, text) TO service_role;

-- ========================================
-- 5. check_lockout_for_totp (client-safe wrapper)
-- ========================================
CREATE OR REPLACE FUNCTION public.check_lockout_for_totp(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT public.check_lockout(p_user_id) INTO v_result;
  RETURN v_result;
END;
$$;

-- ========================================
-- 6. record_failed_totp_attempt (client-safe wrapper)
-- ========================================
CREATE OR REPLACE FUNCTION public.record_failed_totp_attempt(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT public.record_failed_attempt(p_user_id) INTO v_result;
  RETURN v_result;
END;
$$;

-- ========================================
-- 7. reset_lockout_after_totp (client-safe wrapper)
-- ========================================
CREATE OR REPLACE FUNCTION public.reset_lockout_after_totp(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM public.reset_lockout(p_user_id);
END;
$$;

-- ========================================
-- 8. get_mfa_lockout_status (read-only, client-safe)
-- ========================================
CREATE OR REPLACE FUNCTION public.get_mfa_lockout_status(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row mfa_lockout_tracking%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_row FROM mfa_lockout_tracking WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('locked', false, 'attempts', 0, 'backup_verified', false);
  END IF;

  -- Check if lockout expired
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    RETURN json_build_object('locked', false, 'attempts', 0, 'backup_verified', v_row.backup_verified_at IS NOT NULL);
  END IF;

  RETURN json_build_object(
    'locked', (v_row.locked_until IS NOT NULL AND v_row.locked_until > now()),
    'locked_until', v_row.locked_until,
    'attempts', v_row.failed_attempts,
    'backup_verified', v_row.backup_verified_at IS NOT NULL
  );
END;
$$;
