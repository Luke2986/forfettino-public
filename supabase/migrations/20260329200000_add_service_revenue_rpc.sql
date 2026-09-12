-- Story 55.3: RPC get_service_revenue_report
-- Ranking fatturato per categoria servizio, struttura analoga a get_client_revenue_report.
-- LEFT JOIN service_categories senza filtrare active (categorie disattivate devono apparire nei report storici).
-- Incassi con service_category_id IS NULL aggregati come "Non categorizzato".

-- DROP necessario: cambiare DEFAULT sulla firma è una modifica incompatibile per Postgres
DROP FUNCTION IF EXISTS get_service_revenue_report(UUID, INT);

CREATE OR REPLACE FUNCTION get_service_revenue_report(p_user_id UUID, p_fiscal_year INT DEFAULT NULL)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  service_color TEXT,
  total_gross NUMERIC,
  total_net NUMERIC,
  receipt_count INT,
  first_receipt_date DATE,
  last_receipt_date DATE,
  percentage NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.service_category_id AS service_id,
    COALESCE(sc.name, 'Non categorizzato') AS service_name,
    COALESCE(sc.color, '#94a3b8') AS service_color,
    SUM(r.gross_amount)::NUMERIC AS total_gross,
    SUM(COALESCE(r.net_spendable, 0))::NUMERIC AS total_net,
    COUNT(*)::INT AS receipt_count,
    MIN(r.receipt_date)::DATE AS first_receipt_date,
    MAX(r.receipt_date)::DATE AS last_receipt_date,
    ROUND(
      100.0 * SUM(r.gross_amount) / NULLIF(SUM(SUM(r.gross_amount)) OVER (), 0),
      2
    )::NUMERIC AS percentage
  FROM receipts r
  LEFT JOIN service_categories sc ON sc.id = r.service_category_id
  WHERE r.user_id = p_user_id
    AND (p_fiscal_year IS NULL OR r.fiscal_year = p_fiscal_year)
  GROUP BY r.service_category_id, sc.name, sc.color
  ORDER BY total_gross DESC;
$$;
