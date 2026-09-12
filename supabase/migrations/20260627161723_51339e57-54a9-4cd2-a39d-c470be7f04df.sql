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