-- Migration: RPC decrement_launch_cap
-- Story: 72-1 Backend Cap Enforcement Atomico
-- Purpose: Atomic, idempotent cap decrement with advisory lock

CREATE OR REPLACE FUNCTION public.decrement_launch_cap(
  p_window_id uuid,
  p_checkout_session_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap_remaining int;
  v_is_active boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_now timestamptz := now();
BEGIN
  -- Set lock timeout to prevent indefinite hangs
  SET LOCAL lock_timeout = '5s';

  -- Acquire transactional advisory lock (released at COMMIT/ROLLBACK)
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_window_id::text));
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object('success', false, 'reason', 'lock_timeout');
  END;

  -- Idempotency check: already processed?
  IF EXISTS (
    SELECT 1 FROM public.processed_checkout_sessions
    WHERE checkout_session_id = p_checkout_session_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_processed');
  END IF;

  -- Fetch window data
  SELECT cap_remaining, is_active, starts_at, ends_at
  INTO v_cap_remaining, v_is_active, v_starts_at, v_ends_at
  FROM public.launch_windows
  WHERE id = p_window_id;

  -- Window not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'window_not_found');
  END IF;

  -- Window inactive
  IF NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'reason', 'window_inactive');
  END IF;

  -- Window outside time range
  IF v_now < v_starts_at OR v_now > v_ends_at THEN
    RETURN jsonb_build_object('success', false, 'reason', 'window_closed');
  END IF;

  -- Cap exhausted
  IF v_cap_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cap_exhausted');
  END IF;

  -- Atomic decrement
  UPDATE public.launch_windows
  SET cap_remaining = cap_remaining - 1
  WHERE id = p_window_id;

  -- Record processed session for idempotency
  INSERT INTO public.processed_checkout_sessions (checkout_session_id, window_id, user_id)
  VALUES (p_checkout_session_id, p_window_id, p_user_id);

  -- Log the event
  INSERT INTO public.event_logs (user_id, event_name, props)
  VALUES (
    p_user_id,
    'launch_cap_decremented',
    jsonb_build_object(
      'window_id', p_window_id,
      'remaining_after', v_cap_remaining - 1,
      'user_id', p_user_id,
      'checkout_session_id', p_checkout_session_id
    )
  );

  RETURN jsonb_build_object('success', true, 'remaining', v_cap_remaining - 1);
END;
$$;

-- Security: only service_role can execute
REVOKE ALL ON FUNCTION public.decrement_launch_cap(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_launch_cap(uuid, text, uuid) TO service_role;
