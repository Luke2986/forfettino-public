-- Migration: marca da bollo 2 EUR addebitata al cliente
--
-- Aggiunge tracciamento della marca da bollo 2 EUR addebitata in fattura
-- dai forfettari (fatture senza IVA con importi > 77,47 EUR,
-- D.P.R. 642/1972 art. 13 Tariffa).
--
-- Il gross_amount rimane il TOTALE FATTURA (compenso + eventuale rivalsa
-- + bollo se addebitato), quindi l'engine fiscale esistente non cambia:
-- il bollo addebitato al cliente concorre al reddito (interpello AdE
-- 428/2022), come la rivalsa INPS. I nuovi campi sono solo
-- tracciabilita' per UI/report.
--
-- Il bollo e' un importo FISSO (2 EUR), non percentuale. Ordine di
-- composizione: compenso -> + rivalsa 4% -> + bollo 2 EUR.
-- ATTENZIONE estrazione rivalsa: su un gross che include il bollo, la
-- formula 4/104 va applicata a (gross - 2), non al gross pieno.
--
-- NESSUNA colonna su installment_plans: il bollo e' per-fattura, non
-- per-rata — fuori scope v1 (story 85-1).

-- receipts: flag + importo bollo
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS marca_bollo_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS marca_bollo_amount numeric(12,2) NOT NULL DEFAULT 0
  CHECK (marca_bollo_amount >= 0);

-- Indice per report aggregati "bollo YTD" (mirror idx rivalsa)
CREATE INDEX IF NOT EXISTS idx_receipts_user_fiscal_year_bollo
  ON public.receipts (user_id, fiscal_year)
  WHERE marca_bollo_applied = true;

COMMENT ON COLUMN public.receipts.marca_bollo_applied IS
  'True se l''incasso include la marca da bollo 2 EUR addebitata al cliente in fattura (dovuta su fatture no-IVA > 77,47 EUR).';
COMMENT ON COLUMN public.receipts.marca_bollo_amount IS
  'Importo del bollo incluso nel gross_amount (2.00 se addebitato, 0 altrimenti). Fisso, non percentuale.';
