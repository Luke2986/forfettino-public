-- Story 26-4: Clean slate + drop obsolete RPCs + new RPCs reading from config
-- Depends on: 20260302000000_contribution_action_config.sql

----------------------------------------------------------------------
-- 1. Clean slate (tiny data volume, complete redesign)
----------------------------------------------------------------------
DELETE FROM public.user_milestone_claims;
DELETE FROM public.user_contributions;

----------------------------------------------------------------------
-- 2. Drop obsolete RPCs
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_first_receipt_contribution();
DROP FUNCTION IF EXISTS public.record_scadenza_contribution(UUID);
DROP FUNCTION IF EXISTS public.record_import_xml_contribution();

----------------------------------------------------------------------
-- 3. Update CHECK constraint (drop old, add new with 4 action types)
----------------------------------------------------------------------
ALTER TABLE public.user_contributions
  DROP CONSTRAINT IF EXISTS user_contributions_action_type_check;

ALTER TABLE public.user_contributions
  ADD CONSTRAINT user_contributions_action_type_check CHECK (
    action_type IN (
      'feedback_submitted',
      'referral_signup',
      'call_completed',
      'first_import_xml'
    )
  );

----------------------------------------------------------------------
-- 4. NEW RPC: record_first_import_contribution (one-time, from config)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_first_import_contribution()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_points INTEGER;
BEGIN
  -- Advisory lock per-user to prevent double-award
  PERFORM pg_advisory_xact_lock(hashtext('first_import_' || v_uid::text));

  -- Already awarded?
  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'first_import_xml'
  ) THEN
    RETURN;
  END IF;

  -- Verify user actually has at least one XML import
  IF NOT EXISTS (
    SELECT 1 FROM public.receipts
    WHERE user_id = v_uid AND source = 'xml_import'
  ) THEN
    RETURN;
  END IF;

  -- Read points from config
  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'first_import_xml' AND is_active = true;

  IF v_points IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'first_import_xml', v_points);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_first_import_contribution() TO authenticated;

----------------------------------------------------------------------
-- 5. UPDATE: record_feedback_contribution (reads points from config)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_feedback_contribution()
RETURNS void
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

  -- Cooldown: silently return if within 7 days (fire-and-forget by design)
  IF last_feedback IS NOT NULL AND last_feedback > now() - INTERVAL '7 days' THEN
    RETURN;
  END IF;

  -- Read points from config
  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'feedback_submitted' AND is_active = true;

  IF v_points IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'feedback_submitted', v_points);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_feedback_contribution() TO authenticated;

----------------------------------------------------------------------
-- 6. UPDATE: admin_record_call_contribution (reads points from config)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_record_call_contribution(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_call TIMESTAMPTZ;
  v_points INTEGER;
BEGIN
  -- Admin check (authoritative access control)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Advisory lock per-target-user to prevent double-award
  PERFORM pg_advisory_xact_lock(hashtext('call_' || p_user_id::text));

  -- Cooldown 30 days for this user
  SELECT MAX(created_at) INTO last_call
  FROM public.user_contributions
  WHERE user_id = p_user_id AND action_type = 'call_completed';

  -- Cooldown: silently return if within 30 days (fire-and-forget by design)
  IF last_call IS NOT NULL AND last_call > now() - INTERVAL '30 days' THEN
    RETURN;
  END IF;

  -- Read points from config
  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'call_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (p_user_id, 'call_completed', v_points);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_call_contribution(UUID) TO authenticated;

----------------------------------------------------------------------
-- 7. Backfill: award first_import_xml for existing users with XML imports
----------------------------------------------------------------------
INSERT INTO public.user_contributions (user_id, action_type, points)
SELECT DISTINCT r.user_id, 'first_import_xml', cfg.points
FROM public.receipts r
CROSS JOIN (
  SELECT points FROM public.contribution_action_config
  WHERE action_type = 'first_import_xml' AND is_active = true
) cfg
WHERE r.source = 'xml_import'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_contributions uc
    WHERE uc.user_id = r.user_id AND uc.action_type = 'first_import_xml'
  );
