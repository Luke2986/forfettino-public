-- Story 58.1: Aggiorna get_client_revenue_report per accettare p_fiscal_year nullable
-- Se p_fiscal_year IS NULL → aggrega su tutti gli anni (vista "Totale")
-- DROP necessario: cambiare DEFAULT sulla firma è una modifica incompatibile per Postgres

DROP FUNCTION IF EXISTS get_client_revenue_report(UUID, INT);

CREATE OR REPLACE FUNCTION get_client_revenue_report(p_user_id UUID, p_fiscal_year INT DEFAULT NULL)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
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
    r.client_id,
    MAX(COALESCE(r.client_name, 'Senza cliente')) AS client_name,
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
  WHERE r.user_id = p_user_id
    AND (p_fiscal_year IS NULL OR r.fiscal_year = p_fiscal_year)
  GROUP BY r.client_id
  ORDER BY total_gross DESC;
$$;
