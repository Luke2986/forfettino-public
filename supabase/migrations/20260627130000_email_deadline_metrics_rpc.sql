-- Story 84-9: Admin Dashboard Metriche Email Scadenze — 2 RPC additive su email_events.
--
-- Scope: SOLO LETTURA. NESSUNA modifica allo schema email_events/email_log né a
-- get_email_event_stats (84-5, riusata as-is per le KPI + by_threshold).
-- Questa migration aggiunge ciò che le KPI base non coprono:
--   1) get_email_event_trend       → serie giornaliera per event_type (AC#3 trend recapito)
--   2) get_email_event_recipients  → drill-down per-utente (AC#2)
--
-- ⚠️ PATH TAGS (gotcha 84-5 HIGH-1 — NON ripeterlo): i tag Resend vivono in `data.tags`
-- → path corretto `raw_payload -> 'data' -> 'tags' ->> '<key>'` (NON top-level `-> 'tags'`).
-- Stesso path di get_email_event_stats (84-5, righe 93/101/121).
--
-- ⚠️ DIMENSIONE = SOGLIA, non bucket: i tag hanno solo category/user_id/threshold. Il bucket
-- di scadenza (june/inps_q3/saldo_tax) è solo nell'utm_campaign del link (clicked_url, parziale).
-- Raggruppare/esporre la SOGLIA (30/7/3/0), non un raggruppamento per bucket non supportato dai dati.
--
-- ⚠️ DISCLAIMER Apple MPP: `opened`/`clicked` da email_events sono PREDISPOSTI ma OFF al lancio
-- (toggle dominio Resend OFF, decisione 84-1) → ~0. `opened` è inoltre gonfiato da Apple Mail
-- Privacy Protection (+15-40% falsi). Il CLICK reale = PostHog (EF admin-deadline-email-clicks).
--
-- ⚠️ PII: NESSUNA RPC ritorna `raw_payload` (contiene `to`/subject/tags). Solo colonne pulite,
-- filtrate server-side. Admin-gating triplo: RLS email_events (admin-read) + check has_role interno
-- (SECURITY DEFINER BYPASSA la RLS → il check è obbligatorio) + route AdminProtectedRoute lato client.
--
-- ⚠️ TIMEZONE: il trend giornaliero raggruppa su (occurred_at AT TIME ZONE 'Europe/Rome')::date
-- (evita lo shift UTC che spaccherebbe i giorni a cavallo di mezzanotte — MEMORY timezone safety).

-- ── 1. Trend giornaliero per event_type (AC#3) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_email_event_trend(
  p_category TEXT DEFAULT NULL,
  p_since    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.day), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      (occurred_at AT TIME ZONE 'Europe/Rome')::date AS day,
      COUNT(*) FILTER (WHERE event_type = 'email.sent')       AS sent,
      COUNT(*) FILTER (WHERE event_type = 'email.delivered')  AS delivered,
      COUNT(*) FILTER (WHERE event_type = 'email.bounced')    AS bounced,
      COUNT(*) FILTER (WHERE event_type = 'email.complained') AS complained,
      -- Predisposto, OFF al lancio (84-1). Click reale = PostHog, non questo.
      COUNT(*) FILTER (WHERE event_type = 'email.clicked')    AS clicked
    FROM public.email_events
    WHERE (p_category IS NULL OR raw_payload -> 'data' -> 'tags' ->> 'category' = p_category)
      AND (p_since IS NULL OR occurred_at >= p_since)
    GROUP BY 1
  ) s;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_event_trend(TEXT, TIMESTAMPTZ) TO authenticated;

-- ── 2. Drill-down per-utente (AC#2) ──────────────────────────────────────────────
-- Righe pulite (NO raw_payload). `threshold` derivato dai tag. Cap a LEAST(p_limit, 1000):
-- il client mostra un avviso se le righe raggiungono il limite (potenziale troncamento).
CREATE OR REPLACE FUNCTION public.get_email_event_recipients(
  p_category   TEXT DEFAULT NULL,
  p_since      TIMESTAMPTZ DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_limit      INT DEFAULT 500
)
RETURNS TABLE(
  recipient_email TEXT,
  user_id         UUID,
  event_type      TEXT,
  threshold       TEXT,
  clicked_url     TEXT,
  occurred_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    e.recipient_email,
    e.user_id,
    e.event_type,
    e.raw_payload -> 'data' -> 'tags' ->> 'threshold' AS threshold,
    e.clicked_url,
    e.occurred_at
  FROM public.email_events e
  WHERE (p_category IS NULL OR e.raw_payload -> 'data' -> 'tags' ->> 'category' = p_category)
    AND (p_since IS NULL OR e.occurred_at >= p_since)
    AND (p_event_type IS NULL OR e.event_type = p_event_type)
  ORDER BY e.occurred_at DESC
  LIMIT LEAST(p_limit, 1000);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_event_recipients(TEXT, TIMESTAMPTZ, TEXT, INT) TO authenticated;
