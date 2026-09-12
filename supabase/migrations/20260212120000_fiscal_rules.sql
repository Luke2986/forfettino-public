-- ============================================
-- FISCAL_RULES: Parametri Normativi INPS per Anno Fiscale
-- Story 1.1 — PRINCIPIO ZERO APPROSSIMAZIONE
-- Ogni valore proviene da circolare INPS ufficiale.
-- ============================================

-- ============================================
-- 1. TABELLA fiscal_rules
-- ============================================
CREATE TABLE public.fiscal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL,

  -- =============================================
  -- GESTIONE SEPARATA
  -- Fonte: Circolare INPS n. 8 del 03/02/2026
  -- =============================================
  inps_rate_separata NUMERIC(6,4) NOT NULL,           -- 26.0700% (IVS 25% + accessorie 0.72% + ISCRO 0.35%)
  massimale_separata NUMERIC(12,2) NOT NULL,          -- 122295.00

  -- =============================================
  -- GESTIONE ARTIGIANI
  -- Fonte: Circolare INPS n. 14 del 09/02/2026
  -- =============================================
  inps_rate_artigiani NUMERIC(6,4) NOT NULL,          -- 24.0000% (fino a soglia_reddito_prima_fascia)
  inps_rate_artigiani_alta NUMERIC(6,4) NOT NULL,     -- 25.0000% (oltre soglia_reddito_prima_fascia)
  minimale_artigiani NUMERIC(12,2) NOT NULL,          -- 4521.36 (IVS 4513.92 + maternita 7.44)
  massimale_artigiani NUMERIC(12,2) NOT NULL,         -- 93707.00 (pre-1996) / 122295.00 (post-1996)

  -- =============================================
  -- GESTIONE COMMERCIANTI
  -- Fonte: Circolare INPS n. 14 del 09/02/2026
  -- =============================================
  inps_rate_commercianti NUMERIC(6,4) NOT NULL,       -- 24.4800% (fino a soglia_reddito_prima_fascia)
  inps_rate_commercianti_alta NUMERIC(6,4) NOT NULL,  -- 25.4800% (oltre soglia_reddito_prima_fascia)
  minimale_commercianti NUMERIC(12,2) NOT NULL,       -- 4611.64 (IVS 4604.20 + maternita 7.44)
  massimale_commercianti NUMERIC(12,2) NOT NULL,      -- 93707.00 (pre-1996) / 122295.00 (post-1996)

  -- =============================================
  -- PARAMETRI COMUNI ART/COMM
  -- =============================================
  reddito_minimale NUMERIC(12,2) NOT NULL,            -- 18808.00
  soglia_reddito_prima_fascia NUMERIC(12,2) NOT NULL, -- 56224.00
  maternita_annuale NUMERIC(8,2) NOT NULL,            -- 7.44 (0.62/mese x 12)

  -- =============================================
  -- IMPOSTA SOSTITUTIVA E REGIME FORFETTARIO
  -- =============================================
  aliquota_sostitutiva_5 NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  aliquota_sostitutiva_15 NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  soglia_forfettario NUMERIC(12,2) NOT NULL DEFAULT 85000.00,

  -- =============================================
  -- TRACCIABILITA FONTE NORMATIVA
  -- =============================================
  source_url_separata TEXT,
  source_url_artigiani_commercianti TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fiscal_rules_fiscal_year_key UNIQUE (fiscal_year)
);

-- ============================================
-- 2. RLS POLICIES
-- ============================================
ALTER TABLE public.fiscal_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: tutti gli utenti autenticati possono leggere
CREATE POLICY "Authenticated users can read fiscal rules"
  ON public.fiscal_rules FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: solo admin (usa funzione has_role esistente da migration 20260208080932)
CREATE POLICY "Admins can insert fiscal rules"
  ON public.fiscal_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- UPDATE: solo admin
CREATE POLICY "Admins can update fiscal rules"
  ON public.fiscal_rules FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE: solo admin
CREATE POLICY "Admins can delete fiscal rules"
  ON public.fiscal_rules FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. TRIGGER updated_at (riusa funzione esistente)
-- ============================================
CREATE TRIGGER update_fiscal_rules_updated_at
  BEFORE UPDATE ON public.fiscal_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. SEED: Parametri INPS 2026 — VALORI UFFICIALI
-- Gestione Separata: Circolare INPS n. 8 del 03/02/2026
-- Artigiani/Commercianti: Circolare INPS n. 14 del 09/02/2026
-- ZERO APPROSSIMAZIONE: NON modificare senza circolare aggiornata
-- ============================================
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
  2026,
  -- Gestione Separata (Circ. n. 8/2026)
  26.0700, 122295.00,
  -- Gestione Artigiani (Circ. n. 14/2026)
  24.0000, 25.0000,
  4521.36, 93707.00,
  -- Gestione Commercianti (Circ. n. 14/2026)
  24.4800, 25.4800,
  4611.64, 93707.00,
  -- Parametri comuni (Circ. n. 14/2026)
  18808.00, 56224.00, 7.44,
  -- Imposta e regime
  5.00, 15.00, 85000.00,
  -- Source URLs
  'https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.gestione-separata-le-aliquote-contributive-per-il-2026.html',
  'https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.gestioni-artigiani-e-commercianti-i-contributi-per-il-2026.html'
);
