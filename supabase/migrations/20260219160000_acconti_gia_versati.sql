-- Story 11.1: Aggiunge colonne per acconti imposta e INPS già versati
-- Permettono di calcolare il saldo netto (imposta/INPS dovuta - acconti versati)

ALTER TABLE fiscal_year_settings
  ADD COLUMN acconti_imposta_versati numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN acconti_inps_eccedenza_versati numeric(12,2) NOT NULL DEFAULT 0;

-- Vincoli: gli acconti non possono essere negativi
ALTER TABLE fiscal_year_settings
  ADD CONSTRAINT acconti_imposta_versati_non_negative CHECK (acconti_imposta_versati >= 0),
  ADD CONSTRAINT acconti_inps_eccedenza_versati_non_negative CHECK (acconti_inps_eccedenza_versati >= 0);
