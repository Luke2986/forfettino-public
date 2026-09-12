-- Fix: record_feedback_contribution returns boolean instead of void.
-- true  = points awarded successfully
-- false = skipped (cooldown active or config inactive)
-- Prevents misleading "Punti guadagnati" message on the client.

DROP FUNCTION IF EXISTS public.record_feedback_contribution();

CREATE OR REPLACE FUNCTION public.record_feedback_contribution()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_feedback TIMESTAMPTZ;
  v_uid UUID := auth.uid();
  v_points INTEGER;
BEGIN
  -- Advisory lock per-user to prevent double-award on concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('feedback_' || v_uid::text));

  SELECT MAX(created_at) INTO last_feedback
  FROM public.user_contributions
  WHERE user_id = v_uid AND action_type = 'feedback_submitted';

  -- Cooldown: return false if within 7 days
  IF last_feedback IS NOT NULL AND last_feedback > now() - INTERVAL '7 days' THEN
    RETURN false;
  END IF;

  -- Read points from config
  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'feedback_submitted' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'feedback_submitted', v_points);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_feedback_contribution() TO authenticated;
