-- ============================================
-- FISCAL_RULES: Parametri Normativi INPS Anno 2025
-- Necessari per calcolo scadenziario quando si inseriscono incassi dell'anno precedente.
-- PRINCIPIO ZERO APPROSSIMAZIONE: tutti i valori da circolari INPS ufficiali.
-- ============================================

-- Gestione Separata: Circolare INPS n. 27 del 30/01/2025
-- Artigiani/Commercianti: Circolare INPS n. 38 del 07/02/2025

INSERT INTO public.fiscal_rules (
  fiscal_year,
  -- Gestione Separata
  inps_rate_separata, massimale_separata,
  -- Gestione Artigiani
  inps_rate_artigiani, inps_rate_artigiani_alta,
  minimale_artigiani, massimale_artigiani,
  -- Gestione Commercianti
  inps_rate_commercianti, inps_rate_commercianti_alta,
  minimale_commercianti, massimale_commercianti,
  -- Parametri comuni
  reddito_minimale, soglia_reddito_prima_fascia, maternita_annuale,
  -- Imposta e regime
  aliquota_sostitutiva_5, aliquota_sostitutiva_15, soglia_forfettario,
  -- Source URLs
  source_url_separata, source_url_artigiani_commercianti
) VALUES (
  2025,
  -- Gestione Separata (Circ. n. 27/2025)
  26.0700, 120607.00,
  -- Gestione Artigiani (Circ. n. 38/2025)
  24.0000, 25.0000,
  4460.64, 92413.00,
  -- Gestione Commercianti (Circ. n. 38/2025)
  24.4800, 25.4800,
  4549.70, 92413.00,
  -- Parametri comuni (Circ. n. 38/2025)
  18555.00, 55448.00, 7.44,
  -- Imposta e regime (invariati)
  5.00, 15.00, 85000.00,
  -- Source URLs
  'https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2025.01.gestione-separata-le-aliquote-contributive-per-il-2025.html',
  'https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2025.02.gestione-artigiani-e-commercianti-contributi-per-il-2025.html'
) ON CONFLICT (fiscal_year) DO NOTHING;
