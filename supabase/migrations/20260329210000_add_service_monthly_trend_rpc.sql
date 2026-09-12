-- =============================================================================
-- Story 55.5: get_service_monthly_trend
-- Ritorna trend mensile di fatturato per un singolo servizio (o tutti se NULL)
-- Pattern identico a get_client_monthly_trend
-- =============================================================================
DROP FUNCTION IF EXISTS get_service_monthly_trend(UUID, INT, UUID);

CREATE OR REPLACE FUNCTION get_service_monthly_trend(p_user_id UUID, p_fiscal_year INT, p_service_id UUID DEFAULT NULL)
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
    AND (p_service_id IS NULL OR r.service_category_id = p_service_id)
    AND auth.uid() = p_user_id
  GROUP BY EXTRACT(MONTH FROM r.receipt_date)
  ORDER BY month;
$$;
