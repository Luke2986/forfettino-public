-- Migration: Add GDPR consent columns to profiles
-- Story 35-1: Migration DB consensi, pagine legali e route

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tos_version TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_consent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_email_consent_at TIMESTAMPTZ DEFAULT NULL;

-- Documentation
COMMENT ON COLUMN profiles.privacy_policy_accepted_at IS 'Timestamp when user accepted the privacy policy';
COMMENT ON COLUMN profiles.privacy_policy_version IS 'Version string of the privacy policy accepted (e.g. 2026-03-05-v1.0)';
COMMENT ON COLUMN profiles.tos_accepted_at IS 'Timestamp when user accepted the Terms of Service';
COMMENT ON COLUMN profiles.tos_version IS 'Version string of the ToS accepted (e.g. 2026-03-05-v1.0)';
COMMENT ON COLUMN profiles.analytics_consent IS 'Whether user consented to analytics profiling (Mixpanel with user_id)';
COMMENT ON COLUMN profiles.analytics_consent_at IS 'Timestamp when analytics consent was given or revoked';
COMMENT ON COLUMN profiles.marketing_email_consent IS 'Whether user consented to marketing emails';
COMMENT ON COLUMN profiles.marketing_email_consent_at IS 'Timestamp when marketing email consent was given or revoked';
