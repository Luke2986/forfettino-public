-- ============================================
-- FISCAL_RULES: correzione massimali artigiani/commercianti a valori post-1996
--
-- Il seed originale ha popolato il massimale pre-1996 (93.707/92.413) mentre
-- tutti i forfettari sono iscritti post-1996 (regime nato nel 2015). Il valore
-- corretto e' quello post-1996 (Circolare INPS n.14/2026 e n.38/2025):
--   2025: 120.607,00 EUR
--   2026: 122.295,00 EUR
--
-- Impatto pratico: il massimale e' cap sul variabile INPS (eccedenza oltre
-- reddito minimale). Con tetto forfettario 85k e coefficiente massimo ~78%,
-- l'imponibile non supera mai 93.707 per utenti "puri", ma nei casi limite
-- (anno di uscita dal regime, ricavi > 85k) il cap errato sottostima
-- i contributi dovuti. Fix applicato via UPDATE (i seed sono immutabili una
-- volta mergeati).
-- ============================================

UPDATE public.fiscal_rules
SET
  massimale_artigiani = 120607.00,
  massimale_commercianti = 120607.00,
  updated_at = now()
WHERE fiscal_year = 2025
  AND massimale_artigiani = 92413.00
  AND massimale_commercianti = 92413.00;

UPDATE public.fiscal_rules
SET
  massimale_artigiani = 122295.00,
  massimale_commercianti = 122295.00,
  updated_at = now()
WHERE fiscal_year = 2026
  AND massimale_artigiani = 93707.00
  AND massimale_commercianti = 93707.00;
