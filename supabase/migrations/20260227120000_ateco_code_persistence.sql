-- Story 13.14: Fix Persistenza Codice ATECO nelle Impostazioni
-- Aggiunge colonna ateco_code a fiscal_year_settings per persistere
-- il codice ATECO selezionato dall'utente (non solo il coefficiente).
-- Colonna nullable per backward compatibility con utenti esistenti.
-- NO foreign key verso profit_coeff_presets (utenti possono inserire codici manuali).

ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS ateco_code TEXT;
