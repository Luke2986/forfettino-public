-- Story 4-3: Aggiunge colonna per dismiss del banner fallback commercialista
-- Persistenza dello stato di dismiss per-utente, per-anno fiscale
ALTER TABLE fiscal_year_settings
ADD COLUMN banner_fallback_commercialista_dismissed boolean NOT NULL DEFAULT false;
