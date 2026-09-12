-- DATA_APERTURA_PIVA: data completa di apertura della partita IVA.
-- Story 88-1 (suggerimento tester DD26264GD, 16/07/2026).
--
-- CONTESTO: il ragguaglio ad anno della soglia forfettaria richiede il GIORNO
-- di apertura (L. 190/2014 art. 1 c. 54 lett. a: «ricavi [...] ragguagliati ad
-- anno»; Circ. AdE 10/E/2016 §2.2: «Tale limite deve essere ragguagliato
-- all'anno nel caso di attività iniziata in corso di anno.»). Finora il
-- profilo salvava solo anno_apertura_piva INTEGER (mig 20260215120000): giorno
-- e mese non esistevano nello schema, quindi il ragguaglio non era calcolabile.
--
-- COESISTENZA (non sostituzione): anno_apertura_piva RESTA. E' consumato dalla
-- logica acconti/primo anno (story 1-8, detectFirstYearArtComm) e da
-- deriveAliquotaSostitutiva, che ragionano a granularità anno. Sostituirlo
-- trascinerebbe logica fiscale estranea dentro questa story.
--
-- NULLABLE E NESSUN BACKFILL: gli utenti esistenti hanno l'anno ma non il
-- giorno, e il giorno non è ricostruibile. NULL significa "giorno ignoto" ed è
-- gestito a livello applicativo (calcolaSogliaRagguagliata ritorna la soglia
-- piena): comportamento identico a prima della story, zero falsi allarmi.
-- Sbagliare per eccesso di limite è meno grave che dire a qualcuno che ha
-- sforato quando non è vero.

BEGIN;

ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS data_apertura_piva DATE;

COMMENT ON COLUMN public.fiscal_year_settings.data_apertura_piva IS
  'Data di apertura della partita IVA (modello AA9). Serve al ragguaglio ad anno della soglia forfettaria per attività iniziate in corso d''anno. NULL = utente pre-88-1 con solo l''anno: nessun ragguaglio, soglia piena. Coesiste con anno_apertura_piva, usato da acconti e aliquota sostitutiva.';

-- I due campi non possono contraddirsi.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_year_settings_data_apertura_coerente'
  ) THEN
    ALTER TABLE public.fiscal_year_settings
      ADD CONSTRAINT fiscal_year_settings_data_apertura_coerente
      CHECK (
        data_apertura_piva IS NULL
        OR anno_apertura_piva IS NULL
        OR EXTRACT(YEAR FROM data_apertura_piva) = anno_apertura_piva
      );
  END IF;
END $$;

COMMIT;
