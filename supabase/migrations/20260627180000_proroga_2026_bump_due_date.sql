-- Proroga forfettari/ISA 2026: bump delle righe tax_schedule rimaste al vecchio
-- termine ordinario 30/06 verso il termine prorogato 20/07.
--
-- CONTESTO: per il 2026 il saldo imposta sostitutiva 2025 + 1° acconto 2026 (+ INPS
-- variabile) è prorogato dal 30/06 al 20/07 (FORFETTARIO_PROROGA in src/lib/fiscal-engine.ts,
-- decreto maggio 2026). Il codice applica già 20/07 alle righe NUOVE
-- (getScadenzeFiscali(2026).taxGiugno), MA useRegenerateSchedule preserva la due_date
-- esistente (`existingJune?.due_date || scadenze.taxGiugno`) per non sovrascrivere edit
-- manuali → le righe "june" 2026 create PRIMA della proroga restano congelate al 30/06.
--
-- IMPATTO: il cron promemoria email (84-8) e il calendario/scadenziario leggono
-- tax_schedule.due_date → per quegli utenti i reminder partono sulle soglie [30,7,3,0]
-- intorno al 30/06 (sbagliato) invece che al 20/07.
--
-- SICUREZZA DEL MATCH:
--   - 30/06/2026 = martedì → le righe stale hanno ESATTAMENTE '2026-06-30' (nessuno
--     slittamento nextWorkingDay).
--   - 20/07/2026 = lunedì → = getScadenzeFiscali(2026).taxGiugno (nessuno slittamento).
--   - Nessun'altra scadenza fiscale 2026 cade il 30/06 (INPS fisse: 16/02, 16/05, 20/08,
--     16/11; 2° acconto: 30/11). Quindi una due_date 2026-06-30 è inequivocabilmente la
--     scadenza prorogata stale.
--   - L'app assume che TUTTA l'utenza forfettaria rientri nella proroga (fiscal-engine.ts:612-615);
--     gli esclusi (dipendenti/pensionati senza P.IVA al 30/06) non sono gestiti dall'app.
--
-- Idempotente: ri-eseguirla non tocca le righe già a 20/07.

UPDATE public.tax_schedule
SET due_date = '2026-07-20'
WHERE payment_year = 2026
  AND due_date = '2026-06-30';
