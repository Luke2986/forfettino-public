ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS marca_bollo_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS marca_bollo_amount numeric(12,2) NOT NULL DEFAULT 0
  CHECK (marca_bollo_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_receipts_user_fiscal_year_bollo
  ON public.receipts (user_id, fiscal_year)
  WHERE marca_bollo_applied = true;

COMMENT ON COLUMN public.receipts.marca_bollo_applied IS
  'True se l''incasso include la marca da bollo 2 EUR addebitata al cliente in fattura (dovuta su fatture no-IVA > 77,47 EUR).';

COMMENT ON COLUMN public.receipts.marca_bollo_amount IS
  'Importo del bollo incluso nel gross_amount (2.00 se addebitato, 0 altrimenti). Fisso, non percentuale.';