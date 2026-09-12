-- Epic 26: User Contributions table + RPCs for point tracking
-- Tracks discrete point-earning events (feedback, referrals, calls, first receipt, import XML, scadenze)
-- Session points are NOT stored here — computed at runtime from user_sessions

CREATE TABLE IF NOT EXISTS public.user_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  points       INTEGER NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_contributions_action_type_check CHECK (
    action_type IN (
      'feedback_submitted',
      'referral_signup',
      'call_completed',
      'first_receipt',
      'import_xml',
      'scadenza_paid'
    )
  )
);

CREATE INDEX idx_user_contributions_user_id
  ON public.user_contributions (user_id);
CREATE INDEX idx_user_contributions_action_type
  ON public.user_contributions (action_type);
CREATE INDEX idx_user_contributions_user_action
  ON public.user_contributions (user_id, action_type);

ALTER TABLE public.user_contributions ENABLE ROW LEVEL SECURITY;

-- Users can read their own contributions
CREATE POLICY "Users can read own contributions"
  ON public.user_contributions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin can read all contributions
CREATE POLICY "Admin can read all contributions"
  ON public.user_contributions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct INSERT from client — only via SECURITY DEFINER RPCs

----------------------------------------------------------------------
-- RPC: record_feedback_contribution (cooldown 7 days)
-- Uses pg_advisory_xact_lock to prevent race condition on rapid clicks
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
BEGIN
  -- Advisory lock per-user to prevent double-award on concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('feedback_' || v_uid::text));

  SELECT MAX(created_at) INTO last_feedback
  FROM public.user_contributions
  WHERE user_id = v_uid AND action_type = 'feedback_submitted';

  IF last_feedback IS NOT NULL AND last_feedback > now() - INTERVAL '7 days' THEN
    RETURN;
  END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'feedback_submitted', 10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_feedback_contribution() TO authenticated;

----------------------------------------------------------------------
-- RPC: record_first_receipt_contribution (one-time)
-- Uses advisory lock to prevent race condition
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_first_receipt_contribution()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Advisory lock per-user to prevent double-award on concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('first_receipt_' || v_uid::text));

  -- Already awarded?
  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'first_receipt'
  ) THEN
    RETURN;
  END IF;

  -- Verify user actually has at least one receipt
  IF NOT EXISTS (
    SELECT 1 FROM public.receipts
    WHERE user_id = v_uid
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'first_receipt', 10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_first_receipt_contribution() TO authenticated;

----------------------------------------------------------------------
-- RPC: record_import_xml_contribution (cooldown 7 days)
-- Uses pg_advisory_xact_lock to prevent race condition on rapid clicks
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_import_xml_contribution()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_import TIMESTAMPTZ;
  v_uid UUID := auth.uid();
BEGIN
  -- Advisory lock per-user to prevent double-award on concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('import_xml_' || v_uid::text));

  SELECT MAX(created_at) INTO last_import
  FROM public.user_contributions
  WHERE user_id = v_uid AND action_type = 'import_xml';

  IF last_import IS NOT NULL AND last_import > now() - INTERVAL '7 days' THEN
    RETURN;
  END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'import_xml', 5);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_import_xml_contribution() TO authenticated;

----------------------------------------------------------------------
-- RPC: record_scadenza_contribution (one-time per schedule)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_scadenza_contribution(p_schedule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Advisory lock per-user+schedule to prevent double-award on concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('scadenza_' || v_uid::text || '_' || p_schedule_id::text));

  -- Already awarded for this schedule?
  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid
      AND action_type = 'scadenza_paid'
      AND metadata->>'schedule_id' = p_schedule_id::text
  ) THEN
    RETURN;
  END IF;

  -- Verify the schedule belongs to this user and has a payment
  IF NOT EXISTS (
    SELECT 1 FROM public.tax_schedule ts
    JOIN public.payments p ON p.tax_schedule_id = ts.id
    WHERE ts.id = p_schedule_id AND ts.user_id = v_uid
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
  VALUES (v_uid, 'scadenza_paid', 5,
          jsonb_build_object('schedule_id', p_schedule_id::text));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_scadenza_contribution(UUID) TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_record_call_contribution (admin only, cooldown 30 days per user)
-- NOTE: GRANT is TO authenticated (not a dedicated admin role) because Supabase
-- does not have a built-in admin role. The has_role() check inside the function
-- is the authoritative access control. This is the standard pattern used by all
-- admin RPCs in this project (e.g., admin-stats edge function, increment_analytics_event).
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_record_call_contribution(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_call TIMESTAMPTZ;
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

  IF last_call IS NOT NULL AND last_call > now() - INTERVAL '30 days' THEN
    RETURN;
  END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (p_user_id, 'call_completed', 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_call_contribution(UUID) TO authenticated;

----------------------------------------------------------------------
-- Backfill: award first_receipt for existing users with receipts
-- NOTE: This runs only once during the migration. The NOT EXISTS guard
-- makes it safe if rows already exist (idempotent within a single run).
-- Supabase migration framework ensures this file executes exactly once.
----------------------------------------------------------------------
INSERT INTO public.user_contributions (user_id, action_type, points)
SELECT DISTINCT r.user_id, 'first_receipt', 10
FROM public.receipts r
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_contributions uc
  WHERE uc.user_id = r.user_id AND uc.action_type = 'first_receipt'
);
