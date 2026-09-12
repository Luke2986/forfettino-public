-- Story 55.4: RPC get_cross_analysis
-- Matrice incrociata cliente x servizio: fatturato e conteggio incassi per combinazione.
-- LEFT JOIN clients + service_categories: incassi senza client → 'Senza cliente', senza categoria → 'Non categorizzato'.

-- DROP necessario: cambiare DEFAULT sulla firma è una modifica incompatibile per Postgres
DROP FUNCTION IF EXISTS get_cross_analysis(UUID, INT);

CREATE OR REPLACE FUNCTION get_cross_analysis(p_user_id UUID, p_fiscal_year INT DEFAULT NULL)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  total_gross NUMERIC,
  receipt_count INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS client_id,
    COALESCE(c.name, 'Senza cliente') AS client_name,
    sc.id AS category_id,
    COALESCE(sc.name, 'Non categorizzato') AS category_name,
    COALESCE(sc.color, '#94a3b8') AS category_color,
    SUM(r.gross_amount)::NUMERIC AS total_gross,
    COUNT(r.id)::INT AS receipt_count
  FROM receipts r
  LEFT JOIN clients c ON r.client_id = c.id
  LEFT JOIN service_categories sc ON r.service_category_id = sc.id
  WHERE r.user_id = p_user_id
    AND p_user_id = auth.uid()
    AND (p_fiscal_year IS NULL OR r.fiscal_year = p_fiscal_year)
  GROUP BY c.id, c.name, sc.id, sc.name, sc.color
  ORDER BY SUM(r.gross_amount) DESC;
$$;
