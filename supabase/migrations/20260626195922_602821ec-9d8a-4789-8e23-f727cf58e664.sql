-- Story 84-3 — Email Scadenze: opt-out + dedup + RPC unsubscribe

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS scadenze_email_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.deadline_email_sent (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_schedule_id   UUID NOT NULL REFERENCES public.tax_schedule(id) ON DELETE CASCADE,
  threshold         INTEGER NOT NULL,
  resend_message_id TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deadline_email_sent_unique UNIQUE (user_id, tax_schedule_id, threshold)
);

GRANT SELECT ON public.deadline_email_sent TO authenticated;
GRANT ALL ON public.deadline_email_sent TO service_role;

CREATE INDEX IF NOT EXISTS idx_deadline_email_sent_user
  ON public.deadline_email_sent (user_id);

ALTER TABLE public.deadline_email_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read deadline_email_sent" ON public.deadline_email_sent;
CREATE POLICY "Admin can read deadline_email_sent"
  ON public.deadline_email_sent
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.unsubscribe_scadenze(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.user_notification_settings (user_id, scadenze_email_enabled)
  VALUES (p_user_id, false)
  ON CONFLICT (user_id) DO UPDATE
    SET scadenze_email_enabled = false
    WHERE public.user_notification_settings.scadenze_email_enabled IS DISTINCT FROM false;
  v_changed := FOUND;
  RETURN v_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_scadenze(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_scadenze(UUID) TO service_role;