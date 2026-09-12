CREATE TABLE IF NOT EXISTS public.email_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  svix_id           TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  recipient_email   TEXT,
  user_id           UUID,
  resend_message_id TEXT,
  clicked_url       TEXT,
  bounce_type       TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload       JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_events_svix_id_unique UNIQUE (svix_id)
);

GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_email_events_user
  ON public.email_events (user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_message_id
  ON public.email_events (resend_message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type
  ON public.email_events (event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at
  ON public.email_events (occurred_at DESC);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read email events" ON public.email_events;
CREATE POLICY "Admin can read email events"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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