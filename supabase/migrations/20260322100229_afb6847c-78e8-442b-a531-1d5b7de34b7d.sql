
CREATE OR REPLACE FUNCTION public.get_client_revenue_report(p_user_id UUID, p_fiscal_year INT)
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  total_gross NUMERIC,
  total_net NUMERIC,
  receipt_count BIGINT,
  first_receipt_date DATE,
  last_receipt_date DATE,
  percentage NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.client_id,
    MAX(COALESCE(r.client_name, 'Senza cliente')) AS client_name,
    SUM(r.gross_amount) AS total_gross,
    SUM(COALESCE(r.net_spendable, 0)) AS total_net,
    COUNT(*)::BIGINT AS receipt_count,
    MIN(r.receipt_date) AS first_receipt_date,
    MAX(r.receipt_date) AS last_receipt_date,
    ROUND(
      SUM(r.gross_amount) * 100.0 / NULLIF(SUM(SUM(r.gross_amount)) OVER (), 0),
      2
    ) AS percentage
  FROM public.receipts r
  WHERE r.user_id = p_user_id
    AND r.fiscal_year = p_fiscal_year
  GROUP BY r.client_id
  ORDER BY total_gross DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_client_monthly_trend(p_user_id UUID, p_fiscal_year INT, p_client_id UUID)
RETURNS TABLE(
  month INT,
  gross_amount NUMERIC,
  receipt_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM r.receipt_date)::INT AS month,
    SUM(r.gross_amount) AS gross_amount,
    COUNT(*)::BIGINT AS receipt_count
  FROM public.receipts r
  WHERE r.user_id = p_user_id
    AND r.fiscal_year = p_fiscal_year
    AND (r.client_id = p_client_id OR (p_client_id IS NULL AND r.client_id IS NULL))
  GROUP BY EXTRACT(MONTH FROM r.receipt_date)
  ORDER BY month;
$$;
