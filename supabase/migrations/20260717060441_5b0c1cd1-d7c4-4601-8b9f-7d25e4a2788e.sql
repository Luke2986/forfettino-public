DO $$
DECLARE
  v_reassociati INTEGER := 0;
  v_orfani_residui INTEGER := 0;
BEGIN
  WITH matches AS (
    SELECT
      r.id AS receipt_id,
      c.id AS client_id
    FROM public.receipts r
    JOIN LATERAL (
      SELECT c.id, COUNT(*) OVER () AS n
      FROM public.clients c
      WHERE c.user_id = r.user_id
        AND lower(trim(c.display_name)) = lower(trim(r.client_name))
    ) c ON true
    WHERE r.client_id IS NULL
      AND r.client_name IS NOT NULL
      AND trim(r.client_name) <> ''
      AND r.created_at < '2026-07-18'
      AND c.n = 1
  ), upd AS (
    UPDATE public.receipts r
    SET client_id = m.client_id
    FROM matches m
    WHERE r.id = m.receipt_id
      AND r.client_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_reassociati FROM upd;

  SELECT count(*) INTO v_orfani_residui
  FROM public.receipts r
  WHERE r.client_id IS NULL
    AND r.client_name IS NOT NULL
    AND trim(r.client_name) <> ''
    AND r.created_at < '2026-07-18';

  RAISE NOTICE 'reassociati: %', v_reassociati;
  RAISE NOTICE 'orfani residui: %', v_orfani_residui;
END $$;