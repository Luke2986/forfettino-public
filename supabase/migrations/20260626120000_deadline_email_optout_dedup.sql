-- Story 84-3: Email Scadenze — Opt-out di canale + tabella di dedup idempotenza
--
-- Due cose nella stessa migration (AC#1 + AC#6):
--   1. Colonna opt-out `scadenze_email_enabled` su user_notification_settings (manca: il
--      canale email scadenze è nuovo, separato da scadenze_enabled che governa l'in-app).
--   2. Tabella di dedup `deadline_email_sent` per l'idempotenza dell'invio (email_log NON
--      basta: non ha user_id/schedule_id/threshold — vedi story §Contesto §2).
--   3. RPC `unsubscribe_scadenze(p_user_id)` per il flip server-side idempotente (mirror
--      di unsubscribe_waitlist_nurture, ma riceve lo user_id GIÀ verificato via HMAC
--      dall'Edge Function — vedi story §unsubscribe-scadenze: il token firmato non è
--      memorizzato in DB, la verifica avviene nella EF che possiede UNSUBSCRIBE_SECRET).

-- ── 1. Opt-out canale email scadenze ──────────────────────────────────────────
ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS scadenze_email_enabled BOOLEAN NOT NULL DEFAULT true;

-- ── 2. Tabella dedup invii (idempotenza per (user, schedule, threshold)) ───────
CREATE TABLE IF NOT EXISTS public.deadline_email_sent (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_schedule_id   UUID NOT NULL REFERENCES public.tax_schedule(id) ON DELETE CASCADE,
  threshold         INTEGER NOT NULL,
  resend_message_id TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT deadline_email_sent_unique
    UNIQUE (user_id, tax_schedule_id, threshold)
);

-- Index per le query admin/diagnostica per utente
CREATE INDEX IF NOT EXISTS idx_deadline_email_sent_user
  ON public.deadline_email_sent (user_id);

ALTER TABLE public.deadline_email_sent ENABLE ROW LEVEL SECURITY;

-- Admin può leggere (diagnostica/dashboard 84-9). Service_role (Edge Function) scrive
-- bypassando RLS automaticamente. Nessuna policy INSERT per authenticated.
CREATE POLICY "Admin can read deadline_email_sent"
  ON public.deadline_email_sent
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── 3. RPC opt-out scadenze (flip server-side idempotente) ─────────────────────
-- Riceve lo user_id GIÀ verificato dalla EF (HMAC token verificato server-side).
-- NON granted ad anon: solo service_role la invoca (la EF, dopo aver verificato il
-- token firmato). Questo evita che chiunque possa disiscrivere un utente arbitrario
-- conoscendone l'UUID. Idempotente: scrive solo se il flag è ancora true; fa UPSERT
-- della riga settings se non esiste (utente senza row preferenze = default tutto on).
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
