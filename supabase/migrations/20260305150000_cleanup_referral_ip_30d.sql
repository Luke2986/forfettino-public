-- Story 35-4: GDPR IP referral cleanup
-- Pulisce source_ip dai referral piu' vecchi di 30 giorni.
-- L'IP e' dato personale (GDPR Art. 4) e non serve dopo il periodo di anti-frode.
-- NOTA: per cleanup periodico futuro, attivare pg_cron con schedule settimanale

UPDATE referrals
SET source_ip = NULL
WHERE created_at < NOW() - INTERVAL '30 days'
  AND source_ip IS NOT NULL;
