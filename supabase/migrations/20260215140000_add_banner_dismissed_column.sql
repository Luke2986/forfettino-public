-- Story 4-1: Banner rate scadute al primo accesso Art/Comm
-- Adds a dismiss flag for the expired rates banner per user per fiscal year
ALTER TABLE fiscal_year_settings
ADD COLUMN banner_rate_scadute_dismissed boolean NOT NULL DEFAULT false;
