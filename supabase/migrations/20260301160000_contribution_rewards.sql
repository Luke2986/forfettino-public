-- Epic 26: Contribution rewards table — admin-managed reward tracking
-- Admin confirms rewards for top contributors (e.g., 1 year PRO)

CREATE TABLE IF NOT EXISTS public.contribution_rewards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type  TEXT NOT NULL,
  period       TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate rewards for same user/type/period
  CONSTRAINT contribution_rewards_unique_user_type_period
    UNIQUE (user_id, reward_type, period)
);

CREATE INDEX idx_contribution_rewards_user_id
  ON public.contribution_rewards (user_id);
CREATE INDEX idx_contribution_rewards_period
  ON public.contribution_rewards (period);

ALTER TABLE public.contribution_rewards ENABLE ROW LEVEL SECURITY;

-- Users see their own rewards
CREATE POLICY "Users can read own rewards"
  ON public.contribution_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "Admin can select all rewards"
  ON public.contribution_rewards
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert rewards"
  ON public.contribution_rewards
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update rewards"
  ON public.contribution_rewards
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
