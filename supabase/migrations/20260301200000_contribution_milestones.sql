-- Contribution Milestones: admin-configurable reward tiers
-- Users unlock milestones when their total points reach the threshold.
-- Rewards (discounts, Pro months) are manually delivered by admin.

----------------------------------------------------------------------
-- Table: contribution_milestones (config — admin editable)
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contribution_milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level            INTEGER NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  points_required  INTEGER NOT NULL CHECK (points_required > 0),
  reward_type      TEXT NOT NULL CHECK (
    reward_type IN ('badge', 'discount_15', 'discount_30', 'pro_3_months', 'pro_12_months')
  ),
  reward_label     TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contribution_milestones ENABLE ROW LEVEL SECURITY;

-- Everyone can read active milestones (public info)
CREATE POLICY "Anyone can read milestones"
  ON public.contribution_milestones FOR SELECT
  USING (true);

-- Admin full access
CREATE POLICY "Admin can manage milestones"
  ON public.contribution_milestones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

----------------------------------------------------------------------
-- Table: user_milestone_claims (who reached what, reward delivery tracking)
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_milestone_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id   UUID NOT NULL REFERENCES public.contribution_milestones(id) ON DELETE CASCADE,
  reached_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at     TIMESTAMPTZ,
  admin_notes    TEXT,
  UNIQUE(user_id, milestone_id)
);

CREATE INDEX idx_milestone_claims_user ON public.user_milestone_claims (user_id);
CREATE INDEX idx_milestone_claims_milestone ON public.user_milestone_claims (milestone_id);

ALTER TABLE public.user_milestone_claims ENABLE ROW LEVEL SECURITY;

-- Users can read their own claims
CREATE POLICY "Users can read own milestone claims"
  ON public.user_milestone_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "Admin can manage milestone claims"
  ON public.user_milestone_claims FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

----------------------------------------------------------------------
-- Seed: 5 default milestones
----------------------------------------------------------------------
INSERT INTO public.contribution_milestones (level, name, points_required, reward_type, reward_label)
VALUES
  (1, 'Supporter',   150,  'badge',         'Badge Supporter'),
  (2, 'Contributor', 400,  'discount_15',   'Sconto 15% sul prossimo piano'),
  (3, 'Champion',    800,  'discount_30',   'Sconto 30% sul prossimo piano'),
  (4, 'Ambassador',  1500, 'pro_3_months',  '3 mesi Pro gratis'),
  (5, 'Legend',       3000, 'pro_12_months', '12 mesi Pro gratis')
ON CONFLICT (level) DO NOTHING;

----------------------------------------------------------------------
-- RPC: get_milestones() — public, returns active milestones
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_milestones()
RETURNS TABLE (
  id UUID,
  level INTEGER,
  name TEXT,
  points_required INTEGER,
  reward_type TEXT,
  reward_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, level, name, points_required, reward_type, reward_label
  FROM public.contribution_milestones
  WHERE is_active = true
  ORDER BY level ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_milestones() TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_update_milestone — update a single milestone
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_milestone(
  p_id UUID,
  p_name TEXT,
  p_points_required INTEGER,
  p_reward_type TEXT,
  p_reward_label TEXT,
  p_is_active BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_reward_type NOT IN ('badge', 'discount_15', 'discount_30', 'pro_3_months', 'pro_12_months') THEN
    RAISE EXCEPTION 'Invalid reward_type: %', p_reward_type;
  END IF;

  UPDATE public.contribution_milestones
  SET name = p_name,
      points_required = p_points_required,
      reward_type = p_reward_type,
      reward_label = p_reward_label,
      is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_milestone(UUID, TEXT, INTEGER, TEXT, TEXT, BOOLEAN) TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_create_milestone — add a new milestone
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_milestone(
  p_level INTEGER,
  p_name TEXT,
  p_points_required INTEGER,
  p_reward_type TEXT,
  p_reward_label TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_reward_type NOT IN ('badge', 'discount_15', 'discount_30', 'pro_3_months', 'pro_12_months') THEN
    RAISE EXCEPTION 'Invalid reward_type: %', p_reward_type;
  END IF;

  INSERT INTO public.contribution_milestones (level, name, points_required, reward_type, reward_label)
  VALUES (p_level, p_name, p_points_required, p_reward_type, p_reward_label)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_milestone(INTEGER, TEXT, INTEGER, TEXT, TEXT) TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_delete_milestone — remove a milestone (soft: set inactive)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_milestone(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.contribution_milestones
  SET is_active = false, updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_milestone(UUID) TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_claim_milestone_for_user — mark reward as delivered
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_claim_milestone_for_user(
  p_user_id UUID,
  p_milestone_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.user_milestone_claims (user_id, milestone_id, reward_claimed, claimed_at, admin_notes)
  VALUES (p_user_id, p_milestone_id, true, now(), p_notes)
  ON CONFLICT (user_id, milestone_id)
  DO UPDATE SET reward_claimed = true, claimed_at = now(), admin_notes = COALESCE(p_notes, user_milestone_claims.admin_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_claim_milestone_for_user(UUID, UUID, TEXT) TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_get_milestone_achievers — who reached which milestones
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_milestone_achievers()
RETURNS TABLE (
  user_id UUID,
  user_code TEXT,
  first_name TEXT,
  total_pts BIGINT,
  milestone_id UUID,
  milestone_level INTEGER,
  milestone_name TEXT,
  reward_label TEXT,
  reward_claimed BOOLEAN,
  claimed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ct.uid AS user_id,
    p.user_code,
    p.first_name,
    ct.total_pts,
    m.id AS milestone_id,
    m.level AS milestone_level,
    m.name AS milestone_name,
    m.reward_label,
    COALESCE(c.reward_claimed, false) AS reward_claimed,
    c.claimed_at
  FROM _contribution_totals() ct
  JOIN profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  CROSS JOIN contribution_milestones m
  LEFT JOIN user_milestone_claims c
    ON c.user_id = ct.uid AND c.milestone_id = m.id
  WHERE m.is_active = true
    AND ct.total_pts >= m.points_required
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY ct.total_pts DESC, m.level ASC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_milestone_achievers() TO authenticated;
