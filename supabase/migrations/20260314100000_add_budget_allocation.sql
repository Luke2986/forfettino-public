-- Story 42.1: Allocazione Netto Spendibile
-- Aggiunge campo JSONB per le percentuali personalizzate di allocazione budget
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS budget_allocation jsonb DEFAULT NULL;

COMMENT ON COLUMN profiles.budget_allocation IS 'JSONB con percentuali allocazione budget: {necessita: 60, investimenti: 10, risparmio: 10, formazione: 10, svago: 10}. NULL = default.';
