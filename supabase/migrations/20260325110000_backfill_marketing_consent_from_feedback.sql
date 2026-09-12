-- Backfill: trasferisce il consenso feedback_email_consent → marketing_email_consent
-- per gli utenti che avevano già dato il consenso email tramite il vecchio toggle
-- "Contattami via email" ma NON hanno ancora attivato "Email di marketing".
-- Preserva il timestamp originale del consenso per audit GDPR.

UPDATE public.profiles
SET
  marketing_email_consent = true,
  marketing_email_consent_at = feedback_email_consent_at
WHERE feedback_email_consent = true
  AND marketing_email_consent = false;
