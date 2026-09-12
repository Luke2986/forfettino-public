-- Tabella payment_discrepancies
CREATE TABLE IF NOT EXISTS public.payment_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_schedule_id UUID REFERENCES public.tax_schedule(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  fiscal_year INTEGER NOT NULL,
  reference_year INTEGER,
  bucket TEXT NOT NULL,
  amount_estimated_cents BIGINT NOT NULL,
  amount_paid_cents BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  delta_pct NUMERIC,
  tolerance_band TEXT NOT NULL CHECK (tolerance_band IN ('green', 'yellow', 'red')),
  reason_code TEXT,
  discrepancy_category TEXT CHECK (discrepancy_category IN ('reality', 'engine', 'unknown')),
  note TEXT,
  engine_params_snapshot JSONB,
  engine_version TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_discrepancies TO authenticated;
GRANT ALL ON public.payment_discrepancies TO service_role;

CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_user_year
  ON public.payment_discrepancies (user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_band
  ON public.payment_discrepancies (tolerance_band);
CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_category
  ON public.payment_discrepancies (discrepancy_category)
  WHERE discrepancy_category IS NOT NULL;

ALTER TABLE public.payment_discrepancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment discrepancies" ON public.payment_discrepancies;
CREATE POLICY "Users can view own payment discrepancies"
  ON public.payment_discrepancies
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all payment discrepancies" ON public.payment_discrepancies;
CREATE POLICY "Admins can read all payment discrepancies"
  ON public.payment_discrepancies
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC mark_tax_schedule_paid
CREATE OR REPLACE FUNCTION public.mark_tax_schedule_paid(
  p_schedule_id UUID,
  p_amount_paid_cents BIGINT,
  p_payment_date DATE,
  p_payment_type TEXT,
  p_amount_estimated_cents BIGINT,
  p_tolerance_band TEXT,
  p_reason_code TEXT DEFAULT NULL,
  p_discrepancy_category TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_engine_snapshot JSONB DEFAULT NULL,
  p_engine_version TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_bucket TEXT;
  v_payment_year INTEGER;
  v_reference_year INTEGER;
  v_status TEXT;
  v_delta_cents BIGINT;
  v_delta_pct NUMERIC;
  v_payment_id UUID;
  v_discrepancy_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount_paid_cents IS NULL OR p_amount_paid_cents <= 0 THEN
    RAISE EXCEPTION 'Importo pagato non valido';
  END IF;

  IF p_engine_snapshot IS NOT NULL AND octet_length(p_engine_snapshot::text) > 8192 THEN
    RAISE EXCEPTION 'engine_snapshot too large';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('mark_paid_' || v_uid::text || '_' || p_schedule_id::text)
  );

  SELECT bucket, payment_year, reference_year, status
    INTO v_bucket, v_payment_year, v_reference_year, v_status
  FROM public.tax_schedule
  WHERE id = p_schedule_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tax schedule not found or not owned by user';
  END IF;

  IF v_status = 'paid' THEN
    RETURN NULL;
  END IF;

  v_delta_cents := p_amount_paid_cents - p_amount_estimated_cents;
  v_delta_pct := CASE
    WHEN p_amount_estimated_cents > 0
      THEN v_delta_cents::numeric / p_amount_estimated_cents
    ELSE NULL
  END;

  INSERT INTO public.payments (
    user_id, amount, payment_date, payment_type, tax_schedule_id, notes
  ) VALUES (
    v_uid,
    p_amount_paid_cents::numeric / 100.0,
    p_payment_date,
    p_payment_type,
    p_schedule_id,
    'Rata segnata come pagata'
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.tax_schedule
  SET status = 'paid'
  WHERE id = p_schedule_id AND user_id = v_uid;

  INSERT INTO public.payment_discrepancies (
    user_id, tax_schedule_id, payment_id, fiscal_year, reference_year, bucket,
    amount_estimated_cents, amount_paid_cents, delta_cents, delta_pct,
    tolerance_band, reason_code, discrepancy_category, note,
    engine_params_snapshot, engine_version
  ) VALUES (
    v_uid, p_schedule_id, v_payment_id, v_payment_year, v_reference_year, v_bucket,
    p_amount_estimated_cents, p_amount_paid_cents, v_delta_cents, v_delta_pct,
    p_tolerance_band, p_reason_code, p_discrepancy_category, p_note,
    p_engine_snapshot, p_engine_version
  )
  RETURNING id INTO v_discrepancy_id;

  RETURN v_discrepancy_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_tax_schedule_paid(
  UUID, BIGINT, DATE, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
) TO authenticated;