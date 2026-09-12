-- MFA Backup Codes table for account recovery
-- Story 8.2: Users can recover MFA access using one-time backup codes

CREATE TABLE public.mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_id TEXT NOT NULL,
  hashed_code TEXT NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookup
CREATE INDEX idx_mfa_backup_codes_user_id ON public.mfa_backup_codes(user_id);

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own backup codes (for count display in settings)
CREATE POLICY "Users can view own backup codes"
ON public.mfa_backup_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for regular users
-- Only service_role (Edge Functions) can manage backup codes
