
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public._admin_seed_vault_secret(p_name text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, p_value, p_name);
  ELSE
    PERFORM vault.create_secret(p_value, p_name, 'pg_cron secret');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._admin_seed_vault_secret(text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey_anon int := 0; v_email_del int := 0; v_email_events_del int := 0;
  v_sessions_del int := 0; v_events_del int := 0; v_referral_null int := 0;
BEGIN
  WITH updated AS (
    UPDATE survey_responses SET user_id = '00000000-0000-0000-0000-000000000000',
      comment = NULL, free_text = NULL
    WHERE created_at < NOW() - INTERVAL '24 months'
      AND user_id != '00000000-0000-0000-0000-000000000000'
    RETURNING id
  ) SELECT count(*) INTO v_survey_anon FROM updated;

  WITH deleted AS (DELETE FROM email_log WHERE sent_at < NOW() - INTERVAL '6 months' RETURNING id)
  SELECT count(*) INTO v_email_del FROM deleted;

  WITH deleted AS (DELETE FROM email_events WHERE created_at < NOW() - INTERVAL '6 months' RETURNING id)
  SELECT count(*) INTO v_email_events_del FROM deleted;

  WITH deleted AS (DELETE FROM user_sessions WHERE session_date::timestamp < NOW() - INTERVAL '12 months' RETURNING id)
  SELECT count(*) INTO v_sessions_del FROM deleted;

  WITH deleted AS (DELETE FROM event_logs WHERE created_at < NOW() - INTERVAL '12 months' RETURNING id)
  SELECT count(*) INTO v_events_del FROM deleted;

  WITH updated AS (UPDATE referrals SET source_ip = NULL
    WHERE created_at < NOW() - INTERVAL '30 days' AND source_ip IS NOT NULL RETURNING id)
  SELECT count(*) INTO v_referral_null FROM updated;

  RETURN jsonb_build_object(
    'executed_at', NOW(),
    'survey_anonymized', v_survey_anon,
    'email_log_deleted', v_email_del,
    'email_events_deleted', v_email_events_del,
    'sessions_deleted', v_sessions_del,
    'event_logs_deleted', v_events_del,
    'referral_ip_nullified', v_referral_null
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_data() IS
  'GDPR data retention cleanup. Anonymizes survey_responses (24mo), deletes email_log (6mo), email_events (6mo), user_sessions (12mo), event_logs (12mo), nullifies referral IPs (30d).';

DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('daily-deadline-reminder-email');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM cron.schedule(
    'daily-deadline-reminder-email',
    '0 7 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://yuyysqpjowieynbqmirj.supabase.co/functions/v1/send-deadline-reminder-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_pg' LIMIT 1)
        ),
        body := '{}'::jsonb
      )
    $cron$
  );
END $$;
