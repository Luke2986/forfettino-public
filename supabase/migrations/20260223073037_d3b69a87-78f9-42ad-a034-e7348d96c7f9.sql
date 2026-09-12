-- Migration: Convert invoices → installment_plans (Epic 18 — Story 18.2)
-- IDEMPOTENTE: sicura da ri-eseguire senza creare duplicati.

-- CASO 1: Fatture 'incassata' → copia numero_fattura su receipts
UPDATE public.receipts r
SET invoice_number = i.numero_fattura
FROM public.invoices i
WHERE r.invoice_id = i.id
  AND i.stato = 'incassata'
  AND r.invoice_number IS NULL;

-- CASO 2a: Creare piani rate per fatture emessa/ricevuta senza pagamenti
INSERT INTO public.installment_plans (id, user_id, total_amount, client_name, description, start_date, fiscal_year, status)
SELECT
  gen_random_uuid(),
  i.user_id,
  i.importo_lordo,
  i.cliente,
  'Migrato da fattura #' || i.numero_fattura,
  i.data_emissione,
  i.fiscal_year,
  'in_corso'
FROM public.invoices i
WHERE i.stato IN ('emessa', 'ricevuta')
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_payments ip WHERE ip.invoice_id = i.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.installment_plans ip2
    WHERE ip2.user_id = i.user_id
      AND ip2.description = 'Migrato da fattura #' || i.numero_fattura
      AND ip2.fiscal_year = i.fiscal_year
  );

-- CASO 2b: Creare deadline per piani caso 2
INSERT INTO public.installment_deadlines (id, installment_plan_id, user_id, label, expected_amount, due_date, is_paid)
SELECT
  gen_random_uuid(),
  ip.id,
  ip.user_id,
  'Saldo',
  ip.total_amount,
  ip.start_date,
  false
FROM public.installment_plans ip
WHERE ip.description LIKE 'Migrato da fattura #%'
  AND NOT EXISTS (
    SELECT 1 FROM public.installment_deadlines id2 WHERE id2.installment_plan_id = ip.id
  );

-- CASO 3a: Creare piani rate per fatture parzialmente_incassata
INSERT INTO public.installment_plans (id, user_id, total_amount, client_name, description, start_date, fiscal_year, status)
SELECT
  gen_random_uuid(),
  i.user_id,
  i.importo_lordo,
  i.cliente,
  'Migrato da fattura #' || i.numero_fattura,
  i.data_emissione,
  i.fiscal_year,
  'in_corso'
FROM public.invoices i
WHERE i.stato = 'parzialmente_incassata'
  AND NOT EXISTS (
    SELECT 1 FROM public.installment_plans ip2
    WHERE ip2.user_id = i.user_id
      AND ip2.description = 'Migrato da fattura #' || i.numero_fattura
      AND ip2.fiscal_year = i.fiscal_year
  );

-- CASO 3b: Creare deadline pagate per invoice_payments con receipt
INSERT INTO public.installment_deadlines (id, installment_plan_id, user_id, label, expected_amount, due_date, receipt_id, is_paid)
SELECT
  gen_random_uuid(),
  ip.id,
  i.user_id,
  CASE
    WHEN ROW_NUMBER() OVER (PARTITION BY ipay.invoice_id ORDER BY ipay.data_incasso) = 1 THEN 'Anticipo'
    ELSE 'Rata ' || ROW_NUMBER() OVER (PARTITION BY ipay.invoice_id ORDER BY ipay.data_incasso)
  END,
  ipay.importo,
  ipay.data_incasso,
  r.id,
  true
FROM public.invoice_payments ipay
JOIN public.invoices i ON i.id = ipay.invoice_id AND i.stato = 'parzialmente_incassata'
JOIN public.installment_plans ip ON ip.user_id = i.user_id
  AND ip.description = 'Migrato da fattura #' || i.numero_fattura
  AND ip.total_amount = i.importo_lordo
  AND ip.fiscal_year = i.fiscal_year
JOIN public.receipts r ON r.invoice_payment_id = ipay.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.installment_deadlines id2
  WHERE id2.installment_plan_id = ip.id AND id2.receipt_id = r.id
);

-- CASO 3c: Aggiornare receipts con FK installment_plan_id e installment_deadline_id
UPDATE public.receipts r
SET
  installment_plan_id = idl.installment_plan_id,
  installment_deadline_id = idl.id,
  invoice_number = i.numero_fattura
FROM public.installment_deadlines idl
JOIN public.installment_plans ip ON ip.id = idl.installment_plan_id
  AND ip.description LIKE 'Migrato da fattura #%'
JOIN public.invoices i ON ip.user_id = i.user_id
  AND ip.description = 'Migrato da fattura #' || i.numero_fattura
  AND ip.total_amount = i.importo_lordo
  AND ip.fiscal_year = i.fiscal_year
  AND i.stato = 'parzialmente_incassata'
WHERE r.id = idl.receipt_id
  AND idl.is_paid = true
  AND r.installment_plan_id IS NULL;

-- CASO 3d: Creare deadline residuo non pagata
INSERT INTO public.installment_deadlines (id, installment_plan_id, user_id, label, expected_amount, due_date, is_paid)
SELECT
  gen_random_uuid(),
  ip.id,
  ip.user_id,
  'Saldo',
  ip.total_amount - COALESCE(paid.total_paid, 0),
  ip.start_date + INTERVAL '30 days',
  false
FROM public.installment_plans ip
LEFT JOIN (
  SELECT installment_plan_id, SUM(expected_amount) AS total_paid
  FROM public.installment_deadlines
  WHERE is_paid = true
  GROUP BY installment_plan_id
) paid ON paid.installment_plan_id = ip.id
WHERE ip.description LIKE 'Migrato da fattura #%'
  AND ip.status = 'in_corso'
  AND (ip.total_amount - COALESCE(paid.total_paid, 0)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.installment_deadlines id2
    WHERE id2.installment_plan_id = ip.id AND id2.is_paid = false
  );

-- Copiare numero_fattura su receipts per fatture parzialmente_incassata
UPDATE public.receipts r
SET invoice_number = i.numero_fattura
FROM public.invoices i
WHERE r.invoice_id = i.id
  AND i.stato = 'parzialmente_incassata'
  AND r.invoice_number IS NULL;