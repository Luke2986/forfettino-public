-- Migration: Installment Plans (Epic 18 — Incassi Redesign)
-- Nuove tabelle per piani rate che sostituiscono il modello fatture nella UI.
-- Le tabelle invoices/invoice_payments NON vengono toccate (backward compat).

-- 1. Tabella installment_plans (piano rate)
CREATE TABLE public.installment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  client_name text,
  description text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  fiscal_year integer NOT NULL,
  status text NOT NULL DEFAULT 'in_corso' CHECK (status IN ('in_corso', 'completato')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabella installment_deadlines (singole scadenze rate)
CREATE TABLE public.installment_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_plan_id uuid NOT NULL REFERENCES public.installment_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Rata',
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount > 0),
  due_date date NOT NULL,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS per installment_plans
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can SELECT own installment_plans"
  ON public.installment_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT own installment_plans"
  ON public.installment_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE own installment_plans"
  ON public.installment_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE own installment_plans"
  ON public.installment_plans FOR DELETE
  USING (auth.uid() = user_id);

-- 4. RLS per installment_deadlines
ALTER TABLE public.installment_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can SELECT own installment_deadlines"
  ON public.installment_deadlines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT own installment_deadlines"
  ON public.installment_deadlines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE own installment_deadlines"
  ON public.installment_deadlines FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE own installment_deadlines"
  ON public.installment_deadlines FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Trigger updated_at (pattern esistente)
CREATE TRIGGER update_installment_plans_updated_at
  BEFORE UPDATE ON public.installment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_installment_deadlines_updated_at
  BEFORE UPDATE ON public.installment_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Colonne aggiuntive su receipts per tracciabilità piani rate
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS installment_plan_id uuid REFERENCES public.installment_plans(id) ON DELETE SET NULL;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS installment_deadline_id uuid REFERENCES public.installment_deadlines(id) ON DELETE SET NULL;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS invoice_number text;

-- 7. Indici per FK su receipts (performance lookup)
CREATE INDEX IF NOT EXISTS idx_receipts_installment_plan_id ON public.receipts(installment_plan_id);
CREATE INDEX IF NOT EXISTS idx_receipts_installment_deadline_id ON public.receipts(installment_deadline_id);

-- 8. Indici per query frequenti
CREATE INDEX IF NOT EXISTS idx_installment_plans_user_fiscal_year ON public.installment_plans(user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_installment_plans_user_status ON public.installment_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_installment_deadlines_plan_id ON public.installment_deadlines(installment_plan_id);
CREATE INDEX IF NOT EXISTS idx_installment_deadlines_user_due_date ON public.installment_deadlines(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_installment_deadlines_unpaid ON public.installment_deadlines(user_id, is_paid) WHERE is_paid = false;
