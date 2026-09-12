-- Story 44.3: Tabella email_log per tracciamento invii email via Resend
-- Ogni record = un'email inviata (o tentata) tramite Edge Function send-email

CREATE TABLE IF NOT EXISTS public.email_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email   TEXT NOT NULL,
  subject           TEXT NOT NULL,
  resend_message_id TEXT,
  status            TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  error_message     TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id          UUID
);

-- Index per ordinamento cronologico (più recenti prima)
CREATE INDEX idx_email_log_sent_at ON public.email_log (sent_at DESC);

-- Index per raggruppamento batch
CREATE INDEX idx_email_log_batch_id ON public.email_log (batch_id);

-- RLS: solo admin può leggere, solo service_role può scrivere (bypass automatico)
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read email logs"
  ON public.email_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Nessuna policy INSERT per authenticated: solo service_role (Edge Function) scrive
