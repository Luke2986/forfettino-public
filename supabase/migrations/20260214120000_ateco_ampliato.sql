-- ============================================
-- Story 2.5: ATECO Ampliato con Catalogo e Fallback Manuale
-- Aggiunge colonna category, unique constraint su ateco_code,
-- e 40 nuovi preset per Artigiani e Commercianti
-- ============================================

-- 1. Aggiungere colonna category (nullable per backward compat)
ALTER TABLE public.profit_coeff_presets
  ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Aggiungere UNIQUE constraint su ateco_code (necessario per ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profit_coeff_presets_ateco_code_key'
  ) THEN
    ALTER TABLE public.profit_coeff_presets
      ADD CONSTRAINT profit_coeff_presets_ateco_code_key UNIQUE (ateco_code);
  END IF;
END $$;

-- 3. Aggiornare preset esistenti come "professionisti"
UPDATE public.profit_coeff_presets
SET category = 'professionisti'
WHERE category IS NULL;

-- 4. Inserire 20 preset Artigiani (fonte: docs/ateco-codes-artcom.md + Legge 190/2014 Allegato 4)
INSERT INTO public.profit_coeff_presets (ateco_code, description, coefficient, category) VALUES
  ('43.21.01', 'Installazione di impianti di illuminazione e fotovoltaici in edifici', 86, 'artigiani'),
  ('43.21.02', 'Installazione di cablaggi per telecomunicazioni e altre reti', 86, 'artigiani'),
  ('43.22.05', 'Installazione di altri impianti termo-idraulici', 86, 'artigiani'),
  ('43.22.07', 'Installazione di impianti di riscaldamento e di condizionamento dell''aria', 86, 'artigiani'),
  ('43.23.00', 'Installazione di sistemi per l''isolamento', 86, 'artigiani'),
  ('43.24.01', 'Installazione di ascensori e scale mobili', 86, 'artigiani'),
  ('43.31.01', 'Posa in opera di cartongesso', 86, 'artigiani'),
  ('43.32.02', 'Posa in opera di porte non blindate, finestre, arredi, controsoffitti, pareti mobili e simili', 86, 'artigiani'),
  ('43.34.01', 'Tinteggiatura', 86, 'artigiani'),
  ('43.41.00', 'Realizzazione di coperture', 86, 'artigiani'),
  ('43.91.00', 'Lavori di muratura', 86, 'artigiani'),
  ('43.99.09', 'Altri lavori vari di costruzione specializzati n.c.a.', 86, 'artigiani'),
  ('95.10.10', 'Riparazione e manutenzione di computer e periferiche', 67, 'artigiani'),
  ('95.22.01', 'Riparazione e manutenzione di elettrodomestici', 67, 'artigiani'),
  ('95.23.00', 'Riparazione e manutenzione di calzature e articoli in pelle', 67, 'artigiani'),
  ('95.29.30', 'Riparazione e modifica di articoli di abbigliamento', 67, 'artigiani'),
  ('95.31.10', 'Riparazione e manutenzione meccanica, elettrica e di sistemi di alimentazione e iniezione per autoveicoli', 67, 'artigiani'),
  ('95.31.20', 'Riparazione e manutenzione di carrozzerie di autoveicoli', 67, 'artigiani'),
  ('96.21.00', 'Servizi di parrucchieri e barbieri', 67, 'artigiani'),
  ('96.22.09', 'Altri servizi di cura della bellezza e altri trattamenti di bellezza', 67, 'artigiani')
ON CONFLICT (ateco_code) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  coefficient = EXCLUDED.coefficient;

-- 5. Inserire 20 preset Commercianti (fonte: docs/ateco-codes-artcom.md + Legge 190/2014 Allegato 4)
INSERT INTO public.profit_coeff_presets (ateco_code, description, coefficient, category) VALUES
  ('46.90.00', 'Commercio all''ingrosso non specializzato', 40, 'commercianti'),
  ('46.31.10', 'Commercio all''ingrosso di frutta e ortaggi freschi', 40, 'commercianti'),
  ('46.42.10', 'Commercio all''ingrosso di abbigliamento e di accessori per l''abbigliamento', 40, 'commercianti'),
  ('47.11.02', 'Commercio al dettaglio non specializzato con prevalenza di altri prodotti alimentari, bevande o tabacchi', 40, 'commercianti'),
  ('47.21.01', 'Commercio al dettaglio di frutta e verdura fresca', 40, 'commercianti'),
  ('47.22.00', 'Commercio al dettaglio di carne e prodotti a base di carne', 40, 'commercianti'),
  ('47.24.20', 'Commercio al dettaglio di pasticceria e dolciumi', 40, 'commercianti'),
  ('47.25.00', 'Commercio al dettaglio di bevande', 40, 'commercianti'),
  ('47.26.01', 'Commercio al dettaglio di tabacco in qualsiasi forma', 40, 'commercianti'),
  ('47.30.00', 'Commercio al dettaglio di carburanti per autotrazione', 40, 'commercianti'),
  ('47.40.10', 'Commercio al dettaglio di computer, unità periferiche e software', 40, 'commercianti'),
  ('47.12.30', 'Commercio al dettaglio non specializzato con prevalenza di ferramenta, materiali da costruzione e piante', 40, 'commercianti'),
  ('47.55.10', 'Commercio al dettaglio di mobili per la casa', 40, 'commercianti'),
  ('47.61.00', 'Commercio al dettaglio di libri', 40, 'commercianti'),
  ('47.71.10', 'Commercio al dettaglio di articoli di abbigliamento', 40, 'commercianti'),
  ('47.72.11', 'Commercio al dettaglio di calzature e accessori per calzature per adulti', 40, 'commercianti'),
  ('47.75.00', 'Commercio al dettaglio di cosmetici e di articoli di profumeria', 40, 'commercianti'),
  ('47.81.10', 'Commercio al dettaglio di automobili e autoveicoli leggeri', 40, 'commercianti'),
  ('56.11.11', 'Attività di ristoranti con servizio al tavolo, escluse gelaterie e pasticcerie', 40, 'commercianti'),
  ('56.30.01', 'Attività di somministrazione di bevande in bar e caffè', 40, 'commercianti')
ON CONFLICT (ateco_code) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  coefficient = EXCLUDED.coefficient;
