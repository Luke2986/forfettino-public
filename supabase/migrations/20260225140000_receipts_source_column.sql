-- Aggiunge colonna `source` alla tabella receipts per distinguere
-- incassi manuali da quelli importati via XML.
-- Necessaria per il tracking reale del contatore import Free/Pro.

-- Aggiungi colonna con default 'manual'
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Best-effort backfill: i receipts PRE-migration con notes "Fattura n."
-- sono stati creati via XML import (useImportFatture).
-- NOTA: euristica basata sul formato notes. Solo record esistenti prima di
-- questa migration. I nuovi insert settano `source` esplicitamente.
UPDATE receipts
  SET source = 'xml_import'
  WHERE notes LIKE 'Fattura n.%'
    AND source = 'manual'
    AND created_at < '2026-02-25T14:00:00Z';

-- Indice per query di conteggio import per anno (usato da useSubscription)
CREATE INDEX IF NOT EXISTS idx_receipts_source_fiscal_year
  ON receipts (user_id, fiscal_year, source)
  WHERE source = 'xml_import';
