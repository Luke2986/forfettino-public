-- Register already-applied migrations + apply missing reincrement_launch_cap RPC

-- Apply the missing function from 20260411120000
CREATE OR REPLACE FUNCTION public.reincrement_launch_cap(p_window_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap_remaining INTEGER;
  v_cap_total INTEGER;
BEGIN
  SET LOCAL lock_timeout = '5s';

  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_window_id::text));
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'lock_timeout';
  END;

  SELECT cap_remaining, cap_total
  INTO v_cap_remaining, v_cap_total
  FROM public.launch_windows
  WHERE id = p_window_id
  FOR UPDATE;

  IF v_cap_remaining IS NULL THEN
    RAISE EXCEPTION 'launch_window_not_found';
  END IF;

  IF v_cap_remaining >= v_cap_total THEN
    RAISE EXCEPTION 'cap_already_full';
  END IF;

  UPDATE public.launch_windows
  SET cap_remaining = cap_remaining + 1
  WHERE id = p_window_id;

  INSERT INTO public.event_logs (user_id, event_name, props)
  VALUES (
    auth.uid(),
    'launch_cap_reincremented',
    jsonb_build_object(
      'window_id', p_window_id,
      'remaining_after', v_cap_remaining + 1
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reincrement_launch_cap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reincrement_launch_cap(UUID) TO service_role;