-- Epic 54 Story 54.1: RPC per analytics fatturato per cliente
-- get_client_revenue_report: aggregazione incassi per cliente con percentuali
-- get_client_monthly_trend: trend mensile per singolo cliente

-- =============================================================================
-- RPC 1: get_client_revenue_report
-- Ritorna ranking clienti per fatturato nell'anno fiscale specificato
-- =============================================================================
CREATE OR REPLACE FUNCTION get_client_revenue_report(p_user_id UUID, p_fiscal_year INT)
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
    AND r.fiscal_year = p_fiscal_year
  GROUP BY r.client_id
  ORDER BY total_gross DESC;
$$;

-- =============================================================================
-- RPC 2: get_client_monthly_trend
-- Ritorna trend mensile di fatturato per un singolo cliente
-- Gestisce client_id NULL per il bucket "Senza cliente"
-- =============================================================================
CREATE OR REPLACE FUNCTION get_client_monthly_trend(p_user_id UUID, p_fiscal_year INT, p_client_id UUID)
RETURNS TABLE (
  month INT,
  gross_amount NUMERIC,
  receipt_count INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM r.receipt_date)::INT AS month,
    SUM(r.gross_amount)::NUMERIC AS gross_amount,
    COUNT(*)::INT AS receipt_count
  FROM receipts r
  WHERE r.user_id = p_user_id
    AND r.fiscal_year = p_fiscal_year
    AND (r.client_id = p_client_id OR (p_client_id IS NULL AND r.client_id IS NULL))
  GROUP BY EXTRACT(MONTH FROM r.receipt_date)
  ORDER BY month;
$$;
