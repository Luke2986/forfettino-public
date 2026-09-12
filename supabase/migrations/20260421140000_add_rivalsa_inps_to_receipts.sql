-- Migration: rivalsa INPS 4% (Gestione Separata)
--
-- Aggiunge tracciamento della rivalsa INPS 4% addebitata in fattura
-- dai forfettari in Gestione Separata.
--
-- Il gross_amount rimane il TOTALE FATTURA (compenso + rivalsa), quindi
-- l'engine fiscale esistente non cambia: la rivalsa concorre al reddito
-- come il resto. I nuovi campi sono solo tracciabilita' per UI/report.
--
-- Formula rivalsa: gross * 4/104 (la rivalsa e' il 4% del compenso base,
-- quindi su un gross che gia' la include e' 4/104 del totale).

-- receipts: flag + importo rivalsa
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS rivalsa_inps_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS rivalsa_inps_amount numeric(12,2) NOT NULL DEFAULT 0
  CHECK (rivalsa_inps_amount >= 0);

-- installment_plans: flag per propagare rivalsa ai receipt creati dal piano
ALTER TABLE public.installment_plans
  ADD COLUMN IF NOT EXISTS rivalsa_inps_applied boolean NOT NULL DEFAULT false;

-- Indice opzionale per report aggregati "rivalsa YTD per cliente"
CREATE INDEX IF NOT EXISTS idx_receipts_user_fiscal_year_rivalsa
  ON public.receipts (user_id, fiscal_year)
  WHERE rivalsa_inps_applied = true;

COMMENT ON COLUMN public.receipts.rivalsa_inps_applied IS
  'True se l''incasso include rivalsa INPS 4% addebitata in fattura (solo Gestione Separata).';
COMMENT ON COLUMN public.receipts.rivalsa_inps_amount IS
  'Importo della rivalsa INPS 4% inclusa nel gross_amount. Calcolo: gross * 4/104.';
COMMENT ON COLUMN public.installment_plans.rivalsa_inps_applied IS
  'Flag del piano rate: propagato a tutti i receipt generati dalle rate.';
