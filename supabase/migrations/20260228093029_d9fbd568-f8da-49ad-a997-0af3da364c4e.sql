
-- Migration 1: user_contributions table + RPCs
CREATE TABLE IF NOT EXISTS public.user_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  points       INTEGER NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_contributions_action_type_check CHECK (
    action_type IN (
      'feedback_submitted','referral_signup','call_completed',
      'first_receipt','import_xml','scadenza_paid'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_user_contributions_user_id ON public.user_contributions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_contributions_action_type ON public.user_contributions (action_type);
CREATE INDEX IF NOT EXISTS idx_user_contributions_user_action ON public.user_contributions (user_id, action_type);

ALTER TABLE public.user_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own contributions" ON public.user_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all contributions" ON public.user_contributions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_feedback_contribution()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_feedback TIMESTAMPTZ; v_uid UUID := auth.uid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('feedback_' || v_uid::text));
  SELECT MAX(created_at) INTO last_feedback FROM public.user_contributions WHERE user_id = v_uid AND action_type = 'feedback_submitted';
  IF last_feedback IS NOT NULL AND last_feedback > now() - INTERVAL '7 days' THEN RETURN; END IF;
  INSERT INTO public.user_contributions (user_id, action_type, points) VALUES (v_uid, 'feedback_submitted', 10);
END; $$;
GRANT EXECUTE ON FUNCTION public.record_feedback_contribution() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_first_receipt_contribution()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('first_receipt_' || v_uid::text));
  IF EXISTS (SELECT 1 FROM public.user_contributions WHERE user_id = v_uid AND action_type = 'first_receipt') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.receipts WHERE user_id = v_uid) THEN RETURN; END IF;
  INSERT INTO public.user_contributions (user_id, action_type, points) VALUES (v_uid, 'first_receipt', 10);
END; $$;
GRANT EXECUTE ON FUNCTION public.record_first_receipt_contribution() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_import_xml_contribution()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_import TIMESTAMPTZ; v_uid UUID := auth.uid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('import_xml_' || v_uid::text));
  SELECT MAX(created_at) INTO last_import FROM public.user_contributions WHERE user_id = v_uid AND action_type = 'import_xml';
  IF last_import IS NOT NULL AND last_import > now() - INTERVAL '7 days' THEN RETURN; END IF;
  INSERT INTO public.user_contributions (user_id, action_type, points) VALUES (v_uid, 'import_xml', 5);
END; $$;
GRANT EXECUTE ON FUNCTION public.record_import_xml_contribution() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_scadenza_contribution(p_schedule_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('scadenza_' || v_uid::text || '_' || p_schedule_id::text));
  IF EXISTS (SELECT 1 FROM public.user_contributions WHERE user_id = v_uid AND action_type = 'scadenza_paid' AND metadata->>'schedule_id' = p_schedule_id::text) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tax_schedule ts JOIN public.payments p ON p.tax_schedule_id = ts.id WHERE ts.id = p_schedule_id AND ts.user_id = v_uid) THEN RETURN; END IF;
  INSERT INTO public.user_contributions (user_id, action_type, points, metadata) VALUES (v_uid, 'scadenza_paid', 5, jsonb_build_object('schedule_id', p_schedule_id::text));
END; $$;
GRANT EXECUTE ON FUNCTION public.record_scadenza_contribution(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_call_contribution(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_call TIMESTAMPTZ;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('call_' || p_user_id::text));
  SELECT MAX(created_at) INTO last_call FROM public.user_contributions WHERE user_id = p_user_id AND action_type = 'call_completed';
  IF last_call IS NOT NULL AND last_call > now() - INTERVAL '30 days' THEN RETURN; END IF;
  INSERT INTO public.user_contributions (user_id, action_type, points) VALUES (p_user_id, 'call_completed', 50);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_record_call_contribution(UUID) TO authenticated;

-- Backfill first_receipt for existing users
INSERT INTO public.user_contributions (user_id, action_type, points)
SELECT DISTINCT r.user_id, 'first_receipt', 10
FROM public.receipts r
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_contributions uc WHERE uc.user_id = r.user_id AND uc.action_type = 'first_receipt'
);

-- Migration 2: referrals table + trigger
CREATE TABLE IF NOT EXISTS public.referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_code    TEXT NOT NULL,
  invitee_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitee_email    TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  points_awarded   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at     TIMESTAMPTZ,
  CONSTRAINT referrals_status_check CHECK (status IN ('pending', 'confirmed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_invitee ON public.referrals (invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals (referrer_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "Admin can read all referrals" ON public.referrals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.process_referral_signup(p_referrer_code TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer_user_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('referral_' || auth.uid()::text));
  SELECT user_id INTO v_referrer_user_id FROM public.profiles WHERE user_code = p_referrer_code;
  IF v_referrer_user_id IS NULL THEN RETURN; END IF;
  IF v_referrer_user_id = auth.uid() THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE invitee_user_id = auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.referrals (referrer_user_id, referrer_code, invitee_user_id, status) VALUES (v_referrer_user_id, p_referrer_code, auth.uid(), 'pending');
END; $$;
GRANT EXECUTE ON FUNCTION public.process_referral_signup(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_referral_on_onboarding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referral RECORD;
BEGIN
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    SELECT * INTO v_referral FROM public.referrals WHERE invitee_user_id = NEW.user_id AND status = 'pending' AND points_awarded = false LIMIT 1;
    IF v_referral IS NOT NULL THEN
      UPDATE public.referrals SET status = 'confirmed', confirmed_at = now(), points_awarded = true WHERE id = v_referral.id;
      INSERT INTO public.user_contributions (user_id, action_type, points, metadata) VALUES (v_referral.referrer_user_id, 'referral_signup', 100, jsonb_build_object('invitee_user_id', NEW.user_id::text));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_referral_on_onboarding ON public.profiles;
CREATE TRIGGER trg_referral_on_onboarding
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed)
  EXECUTE FUNCTION public.process_referral_on_onboarding();

-- Migration 3: contribution_rewards table
CREATE TABLE IF NOT EXISTS public.contribution_rewards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type  TEXT NOT NULL,
  period       TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contribution_rewards_unique_user_type_period UNIQUE (user_id, reward_type, period)
);

CREATE INDEX IF NOT EXISTS idx_contribution_rewards_user_id ON public.contribution_rewards (user_id);
CREATE INDEX IF NOT EXISTS idx_contribution_rewards_period ON public.contribution_rewards (period);

ALTER TABLE public.contribution_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rewards" ON public.contribution_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can select all rewards" ON public.contribution_rewards FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert rewards" ON public.contribution_rewards FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update rewards" ON public.contribution_rewards FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Migration 4: leaderboard RPCs
CREATE OR REPLACE FUNCTION public._contribution_totals()
RETURNS TABLE (uid UUID, total_pts BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH contribution_points AS (
    SELECT uc.user_id, SUM(uc.points)::BIGINT AS pts FROM public.user_contributions uc GROUP BY uc.user_id
  ),
  session_points AS (
    SELECT us.user_id, COUNT(DISTINCT us.session_date)::BIGINT AS pts FROM public.user_sessions us GROUP BY us.user_id
  )
  SELECT COALESCE(cp.user_id, sp.user_id) AS uid, COALESCE(cp.pts, 0) + COALESCE(sp.pts, 0) AS total_pts
  FROM contribution_points cp FULL OUTER JOIN session_points sp ON cp.user_id = sp.user_id;
$$;
REVOKE ALL ON FUNCTION public._contribution_totals() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (feedback_pts BIGINT, referral_pts BIGINT, call_pts BIGINT, first_receipt_pts BIGINT, import_xml_pts BIGINT, scadenza_pts BIGINT, session_pts BIGINT, total_pts BIGINT, my_rank BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_feedback BIGINT; v_referral BIGINT; v_call BIGINT; v_first_receipt BIGINT; v_import_xml BIGINT; v_scadenza BIGINT; v_sessions BIGINT; v_total BIGINT; v_rank BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_receipt'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'import_xml'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'scadenza_paid'), 0)
  INTO v_feedback, v_referral, v_call, v_first_receipt, v_import_xml, v_scadenza
  FROM public.user_contributions WHERE user_id = v_uid;

  SELECT COUNT(DISTINCT session_date) INTO v_sessions FROM public.user_sessions WHERE user_id = v_uid;
  v_total := v_feedback + v_referral + v_call + v_first_receipt + v_import_xml + v_scadenza + v_sessions;

  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_receipt, v_import_xml, v_scadenza, v_sessions, v_total, v_rank;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (rank BIGINT, user_id UUID, total_pts BIGINT, is_current BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE calling_user UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT ROW_NUMBER() OVER (ORDER BY ct.total_pts DESC, ct.uid) AS rk, ct.uid, ct.total_pts AS total
    FROM public._contribution_totals() ct
    JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
    WHERE ct.total_pts > 0
  )
  SELECT r.rk AS rank, CASE WHEN r.uid = calling_user THEN r.uid ELSE NULL END AS user_id, r.total AS total_pts, (r.uid = calling_user) AS is_current
  FROM ranked r ORDER BY r.rk LIMIT p_limit;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (rank BIGINT, user_id UUID, user_code TEXT, first_name TEXT, total_pts BIGINT, is_reward_eligible BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  WITH ranked AS (
    SELECT ROW_NUMBER() OVER (ORDER BY ct.total_pts DESC, ct.uid) AS rk, ct.uid, p.user_code AS ucode, p.first_name AS fname, ct.total_pts AS total,
      NOT EXISTS (SELECT 1 FROM public.contribution_rewards cr WHERE cr.user_id = ct.uid AND cr.period = TO_CHAR(now(), 'YYYY-MM')) AS eligible
    FROM public._contribution_totals() ct
    JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
    WHERE ct.total_pts > 0
  )
  SELECT r.rk, r.uid, r.ucode, r.fname, r.total, r.eligible FROM ranked r ORDER BY r.rk LIMIT p_limit;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_admin_leaderboard(INTEGER) TO authenticated;
