-- Migration: Ghost Invoices (Story 10.2)
-- Tabella separata per fatture emesse non ancora incassate

-- Enum per stato fattura (estendibile in 10.3 con stati intermedi)
CREATE TYPE public.invoice_status AS ENUM ('emessa', 'incassata');

-- Tabella invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_fattura text NOT NULL,
  importo_lordo numeric(12,2) NOT NULL CHECK (importo_lordo > 0),
  cliente text,
  data_emissione date NOT NULL DEFAULT CURRENT_DATE,
  data_incasso date,
  stato public.invoice_status NOT NULL DEFAULT 'emessa',
  note text,
  fiscal_year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can SELECT own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE own invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at (pattern esistente)
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
