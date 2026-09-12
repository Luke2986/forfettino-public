-- Migration: Add feedback email consent columns to profiles
-- Story 14-4: Consenso Email Opt-In per Contatti Futuri (GDPR Art. 6.1.a)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS feedback_email_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_email_consent_at TIMESTAMPTZ DEFAULT NULL;

-- Audit trail documentation
COMMENT ON COLUMN profiles.feedback_email_consent IS 'Whether user consented to receive occasional emails for surveys and service improvement (GDPR Art. 6.1.a). Default false — no retroactive consent.';
COMMENT ON COLUMN profiles.feedback_email_consent_at IS 'Timestamp when feedback email consent was given or revoked (audit trail — updated on both grant and revoke).';
