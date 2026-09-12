-- Migration: waitlist_email_sent table + pro_waitlist.unsubscribed_at + RPC unsubscribe
-- Story 72-5: Email Nurturing Sequence Pre-Lancio

-- 1. Create waitlist_email_sent table for dedup tracking
CREATE TABLE IF NOT EXISTS public.waitlist_email_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id UUID NOT NULL REFERENCES public.pro_waitlist(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  window_id UUID NOT NULL REFERENCES public.launch_windows(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id TEXT,

  CONSTRAINT waitlist_email_sent_type_check
    CHECK (email_type IN ('nurture_t14', 'nurture_t7', 'nurture_t48h')),

  CONSTRAINT waitlist_email_sent_unique_per_window
    UNIQUE (waitlist_id, email_type, window_id)
);

-- Index for admin aggregate queries
CREATE INDEX idx_waitlist_email_sent_window_type
  ON public.waitlist_email_sent (window_id, email_type);

-- RLS: enable
ALTER TABLE public.waitlist_email_sent ENABLE ROW LEVEL SECURITY;

-- Admin can SELECT for dashboard
CREATE POLICY "admin_select_waitlist_email_sent"
  ON public.waitlist_email_sent
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role bypasses RLS for INSERT (Edge Function uses service_role key)

-- 2. Add unsubscribed_at column to pro_waitlist
ALTER TABLE public.pro_waitlist
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- 3. RPC: unsubscribe_waitlist_nurture(p_token text)
-- Callable by anon (email link click, no auth required)
CREATE OR REPLACE FUNCTION public.unsubscribe_waitlist_nurture(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE public.pro_waitlist
  SET unsubscribed_at = now()
  WHERE referral_token = p_token
    AND revoked_at IS NULL
    AND unsubscribed_at IS NULL;

  v_updated := FOUND;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_waitlist_nurture(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.unsubscribe_waitlist_nurture(TEXT) TO authenticated;

-- 4. Cron scheduling (pg_cron) — COMMENTED OUT, activate manually via SQL Editor
-- Requires pg_cron and pg_net extensions enabled in Supabase dashboard.
-- Alternative: use external cron service (cron-job.org, Vercel cron) with:
--   POST {SUPABASE_URL}/functions/v1/send-waitlist-nurture
--   Header: X-Cron-Secret: {CRON_SECRET}
--   Schedule: 0 7 * * * (07:00 UTC = 09:00 Europe/Rome CET+2)
--
-- SELECT cron.schedule(
--   'waitlist-nurture-daily',
--   '0 7 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/send-waitlist-nurture',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'X-Cron-Secret', current_setting('app.settings.cron_secret')
--     ),
--     body := '{}'::jsonb
--   )$$
-- );
