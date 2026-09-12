-- Pro Waitlist — raccolta consenso per notifica lancio Pro (GDPR Art. 6.1.a, Art. 7)

CREATE TABLE pro_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX idx_pro_waitlist_active ON pro_waitlist(revoked_at) WHERE revoked_at IS NULL;

ALTER TABLE pro_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own waitlist entry"
  ON pro_waitlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own waitlist entry"
  ON pro_waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own waitlist entry"
  ON pro_waitlist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own waitlist entry"
  ON pro_waitlist FOR DELETE
  USING (auth.uid() = user_id);