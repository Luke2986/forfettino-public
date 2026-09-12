-- Story 84-5: Tracking Resend — tabella email_events (eventi ciclo di vita email) + aggregazione.
--
-- Riceve dal webhook Resend (EF resend-webhook, firma Svix) gli eventi per-email del ciclo di
-- vita: sent/delivered/delivery_delayed/bounced/complained/failed (segnali SMTP, arrivano SUBITO,
-- indipendenti dal toggle dominio) + opened/clicked (predisposti ma OFF al lancio — decisione 84-1,
-- gating 84-7). Granularità per-evento: email_log.status resta a delivered/bounced (CHECK NON esteso,
-- AC#4); opened/clicked/complained/delivery_delayed vivono SOLO qui.
--
-- ⚠️ RETENTION / PII: email_events contiene `recipient_email` + `raw_payload` (include `to`, subject,
-- tags) = dato personale. La privacy policy (spike 84-1) fissa la retention dei log email di servizio
-- a 6 MESI. Questa migration NON implementa il purge: il cleanup periodico
-- (DELETE FROM public.email_events WHERE created_at < now() - interval '6 months', via pg_cron/cron
-- Lovable) è demandato a 84-8 (cron) e dichiarato nella privacy a 84-7. TODO: non perdere questo cleanup.

-- ── 1. Tabella eventi ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identità STABILE dell'evento (gli header svix-id sono riusati dai retry Resend) → idempotenza.
  svix_id           TEXT NOT NULL,
  event_type        TEXT NOT NULL,          -- es. "email.delivered" (salvato as-is, NON è il CHECK di email_log)
  recipient_email   TEXT,                   -- primo destinatario (data.to)
  -- user_id dai tags echeggiati da 84-3. NULLABLE: le email non-scadenza (send-email/nurture) non
  -- hanno il tag → evento registrato senza attribuzione. NESSUNA FK ad auth.users di proposito: un
  -- UUID valido-per-shape ma inesistente (tag di terze parti) violerebbe la FK → INSERT fallito →
  -- 500 → retry-storm. L'EF valida solo lo SHAPE UUID (resend-webhook-logic.isUuid), non l'esistenza.
  user_id           UUID,
  resend_message_id TEXT,                   -- = data.email_id, match su email_log.resend_message_id (84-3)
  clicked_url       TEXT,                   -- solo email.clicked (difensivo)
  bounce_type       TEXT,                   -- solo email.bounced (difensivo)
  -- Timestamp dell'EVENTO = top-level created_at del payload (NON data.created_at); fallback now() lato EF.
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload       JSONB NOT NULL,         -- payload integrale per audit/debug (PII — vedi retention sopra)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotenza (AC#5/#7): Resend ritenta sui non-2xx riusando lo stesso svix-id → ON CONFLICT DO NOTHING.
  CONSTRAINT email_events_svix_id_unique UNIQUE (svix_id)
);

-- Index diagnostica admin / dashboard 84-9.
CREATE INDEX IF NOT EXISTS idx_email_events_user
  ON public.email_events (user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_message_id
  ON public.email_events (resend_message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type
  ON public.email_events (event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at
  ON public.email_events (occurred_at DESC);

-- ── 2. RLS — mirror esatto di email_log / deadline_email_sent ────────────────────
-- Admin legge (diagnostica/dashboard). Service_role (Edge Function) scrive bypassando RLS.
-- Nessuna policy INSERT per authenticated.
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read email events" ON public.email_events;
CREATE POLICY "Admin can read email events"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── 3. Aggregazione base (AC#7) — la dashboard ricca è 84-9 ──────────────────────
-- Conteggi grezzi per event_type, opzionalmente filtrati per category (dai tags nel raw_payload)
-- e finestra temporale, + breakdown per threshold (AC#7: "per category + threshold").
-- SECURITY DEFINER + check admin esplicito (pattern get_payment_discrepancy_stats).
--
-- ⚠️ PATH TAGS: i tag Resend nel payload webhook vivono in `data.tags` (oggetto-mappa) → il path
-- corretto è `raw_payload -> 'data' -> 'tags' ->> '<key>'` (NON top-level `raw_payload -> 'tags'`).
-- ⚠️ DISCLAIMER Apple MPP: il conteggio `opened` (quando esisterà — toggle OFF al lancio) è gonfiato
-- da Apple Mail Privacy Protection (+15-40% falsi open) → NON è verità. Il CLICK è la metrica primaria.
CREATE OR REPLACE FUNCTION public.get_email_event_stats(
  p_category TEXT DEFAULT NULL,
  p_since    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result       JSONB;
  v_by_threshold JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Breakdown per threshold (chiave 'na' = email senza tag threshold). Conteggi di recapito
  -- per soglia (delivered/bounced/complained = i numeri che contano per igiene lista/reputazione).
  SELECT COALESCE(jsonb_object_agg(thr, cnts), '{}'::jsonb)
  INTO v_by_threshold
  FROM (
    SELECT
      COALESCE(raw_payload -> 'data' -> 'tags' ->> 'threshold', 'na') AS thr,
      jsonb_build_object(
        'total',      COUNT(*),
        'delivered',  COUNT(*) FILTER (WHERE event_type = 'email.delivered'),
        'bounced',    COUNT(*) FILTER (WHERE event_type = 'email.bounced'),
        'complained', COUNT(*) FILTER (WHERE event_type = 'email.complained')
      ) AS cnts
    FROM public.email_events
    WHERE (p_category IS NULL OR raw_payload -> 'data' -> 'tags' ->> 'category' = p_category)
      AND (p_since IS NULL OR occurred_at >= p_since)
    GROUP BY 1
  ) s;

  SELECT jsonb_build_object(
    'total',            COUNT(*),
    'sent',             COUNT(*) FILTER (WHERE event_type = 'email.sent'),
    'delivered',        COUNT(*) FILTER (WHERE event_type = 'email.delivered'),
    'delivery_delayed', COUNT(*) FILTER (WHERE event_type = 'email.delivery_delayed'),
    'bounced',          COUNT(*) FILTER (WHERE event_type = 'email.bounced'),
    'complained',       COUNT(*) FILTER (WHERE event_type = 'email.complained'),
    'failed',           COUNT(*) FILTER (WHERE event_type = 'email.failed'),
    -- Predisposti, OFF al lancio. `opened` NON è verità (Apple MPP) → click = metrica primaria.
    'opened',           COUNT(*) FILTER (WHERE event_type = 'email.opened'),
    'clicked',          COUNT(*) FILTER (WHERE event_type = 'email.clicked'),
    'by_threshold',     v_by_threshold
  )
  INTO v_result
  FROM public.email_events
  WHERE (p_category IS NULL OR raw_payload -> 'data' -> 'tags' ->> 'category' = p_category)
    AND (p_since IS NULL OR occurred_at >= p_since);

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_event_stats(TEXT, TIMESTAMPTZ) TO authenticated;
