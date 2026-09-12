
ALTER TABLE public.profiles
  ADD COLUMN privacy_policy_accepted_at TIMESTAMPTZ NULL,
  ADD COLUMN privacy_policy_version TEXT NULL,
  ADD COLUMN tos_accepted_at TIMESTAMPTZ NULL,
  ADD COLUMN tos_version TEXT NULL,
  ADD COLUMN analytics_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN analytics_consent_at TIMESTAMPTZ NULL,
  ADD COLUMN marketing_email_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN marketing_email_consent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.profiles.privacy_policy_accepted_at IS 'Timestamp di accettazione della Privacy Policy';
COMMENT ON COLUMN public.profiles.privacy_policy_version IS 'Versione della Privacy Policy accettata (es. 2026-03-05-v1.0)';
COMMENT ON COLUMN public.profiles.tos_accepted_at IS 'Timestamp di accettazione dei Termini di Servizio';
COMMENT ON COLUMN public.profiles.tos_version IS 'Versione dei Termini di Servizio accettata';
COMMENT ON COLUMN public.profiles.analytics_consent IS 'Consenso analytics/tracking (GDPR art. 6)';
COMMENT ON COLUMN public.profiles.analytics_consent_at IS 'Timestamp di modifica del consenso analytics';
COMMENT ON COLUMN public.profiles.marketing_email_consent IS 'Consenso email marketing (GDPR art. 6)';
COMMENT ON COLUMN public.profiles.marketing_email_consent_at IS 'Timestamp di modifica del consenso email marketing';
