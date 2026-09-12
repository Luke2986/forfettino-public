-- Migration: Invoice Payments (Story 10.3)
-- Evoluzione fatture a rate: nuovi stati, tabella pagamenti parziali, tracciabilità receipts

-- 1. Estensione enum invoice_status con nuovi valori
-- NOTA: ALTER TYPE ADD VALUE non può essere dentro una transazione
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'ricevuta' AFTER 'emessa';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'parzialmente_incassata' AFTER 'ricevuta';

-- 2. Tabella invoice_payments (pagamenti parziali)
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  importo numeric(12,2) NOT NULL CHECK (importo > 0),
  data_incasso date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS per invoice_payments
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can SELECT own invoice_payments"
  ON public.invoice_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT own invoice_payments"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE own invoice_payments"
  ON public.invoice_payments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE own invoice_payments"
  ON public.invoice_payments FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Trigger updated_at (pattern esistente)
CREATE TRIGGER update_invoice_payments_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger anti-overpayment: impedisce SUM(importo) > importo_lordo
CREATE OR REPLACE FUNCTION public.check_invoice_payment_limit()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric(12,2);
  invoice_total numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(importo), 0) INTO total_paid
    FROM public.invoice_payments
    WHERE invoice_id = NEW.invoice_id AND id != NEW.id;

  SELECT importo_lordo INTO invoice_total
    FROM public.invoices
    WHERE id = NEW.invoice_id;

  IF (total_paid + NEW.importo) > invoice_total THEN
    RAISE EXCEPTION 'Pagamento eccede il residuo della fattura (totale pagato: %, importo fattura: %)', total_paid + NEW.importo, invoice_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_invoice_payment_limit
  BEFORE INSERT OR UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_payment_limit();

-- 6. Colonne aggiuntive su receipts per tracciabilità
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS invoice_payment_id uuid REFERENCES public.invoice_payments(id) ON DELETE SET NULL;

-- 7. Indici per FK su receipts (performance lookup)
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON public.receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_payment_id ON public.receipts(invoice_payment_id);
