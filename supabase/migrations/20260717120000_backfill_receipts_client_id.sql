-- BACKFILL: riassocia receipts.client_id per gli incassi orfani.
-- Story 86-1 (feedback tester DD26264GD, 16/07/2026).
--
-- CONTESTO: fino al 17/07/2026 solo NuovoIncasso (inserimento diretto) scriveva
-- receipts.client_id. Modifica incasso e import fatture scrivevano solo
-- client_name, lasciando client_id NULL. Il report clienti raggruppa per
-- client_id (get_client_revenue_report: GROUP BY r.client_id) e Clienti.tsx
-- scarta le righe con client_id NULL: quegli incassi non sono "non collegati",
-- sono INVISIBILI nel per-cliente e confluiscono in "Senza cliente".
--
-- ONE-SHOT PER SCELTA (non idempotente-per-design): client_id IS NULL conflaga
-- due stati che lo schema non distingue:
--   (a) mai collegato        -> il bersaglio di questo backfill
--   (b) scollegato di proposito / cliente cancellato, via FK ON DELETE SET NULL
-- Un backfill ripetibile non sa distinguerli e, alla lunga, ricollegherebbe
-- incassi storici a un cliente OMONIMO ma NUOVO creato mesi dopo dall'import.
-- Il bound su created_at congela il target alle righe pre-fix: anche rieseguita,
-- questa migration non puo' toccare nulla creato dal 18/07/2026 in poi.
--
-- PERCHE' 18 E NON 17: il fix viene deployato il 17/07 a ora imprecisata. Un
-- bound al 17 lascerebbe orfani per sempre gli incassi creati il 17 PRIMA del
-- deploy — e il tester sta usando l'app proprio in quelle ore. Il 18 copre
-- tutto il giorno del deploy. Il rischio residuo e' trascurabile: le righe
-- create il 17 dopo il deploy hanno gia' client_id valorizzato e sono escluse
-- dalla guardia client_id IS NULL; resterebbe scoperto solo il caso di un
-- utente che il 17 scollega deliberatamente un cliente E la migration viene
-- rieseguita.
--
-- MATCH AMBIGUI: SALTATI, mai indovinati. Il prodotto permette clienti omonimi
-- di proposito (Clienti.tsx avvisa ma non blocca: due entita' legali possono
-- condividere il display name), quindi non esiste unicita' su display_name.
-- UPDATE ... FROM con piu' righe corrispondenti sceglierebbe una riga ARBITRARIA
-- e IN SILENZIO, con esito non riproducibile tra ambienti. Le righe ambigue
-- restano NULL e visibili per risoluzione manuale.

BEGIN;

WITH matched AS (
  UPDATE public.receipts r
  SET client_id = m.client_id
  FROM (
    SELECT c.user_id,
           lower(btrim(c.display_name)) AS name_key,
           min(c.id)                    AS client_id,
           count(*)                     AS n
    FROM public.clients c
    GROUP BY 1, 2
  ) m
  WHERE m.user_id = r.user_id                          -- guardia tenant: NON negoziabile
    AND m.n = 1                                        -- ambiguo => salta
    AND lower(btrim(r.client_name)) = m.name_key
    AND btrim(r.client_name) <> ''
    AND r.client_id IS NULL                            -- non sovrascrivere link esistenti
    AND r.created_at < '2026-07-18'::timestamptz       -- congela il target alle righe pre-fix
  RETURNING r.id
)
SELECT count(*) AS reassociati FROM matched;

DO $$
DECLARE
  orfani_residui INT;
BEGIN
  SELECT count(*) INTO orfani_residui
  FROM public.receipts
  WHERE client_id IS NULL
    AND btrim(coalesce(client_name, '')) <> '';
  RAISE NOTICE 'Backfill client_id completato. Orfani residui (ambigui o senza match in anagrafica): %', orfani_residui;
END $$;

COMMIT;
