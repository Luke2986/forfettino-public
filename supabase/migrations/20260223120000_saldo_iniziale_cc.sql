-- Story 19-1: Saldo Iniziale Conto Corrente
-- Aggiunge colonna per il saldo iniziale del conto corrente a fiscal_year_settings

ALTER TABLE fiscal_year_settings
  ADD COLUMN saldo_iniziale_cc numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE fiscal_year_settings
  ADD CONSTRAINT saldo_iniziale_cc_non_negative CHECK (saldo_iniziale_cc >= 0);
