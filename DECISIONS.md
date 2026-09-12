# Decisioni tecniche

`ARCHITECTURE.md` descrive lo stato attuale. Questo file racconta il percorso: il problema, l'alternativa scartata, perché, cosa ne è uscito. Solo decisioni verificabili nel codice o nei test di questo repo — niente ricostruito a posteriori.

## 1. Denaro in centesimi (interi), non float

**Problema**: calcoli fiscali che si incastrano su più anni (acconti anno N calcolati su saldo anno N-1, rate, arrotondamenti su percentuali diverse per gestione INPS).

**Alternativa scartata**: `number` in euro con virgola (`100.50`). Più leggibile, meno conversioni.

**Perché scartata**: l'errore di arrotondamento in floating point è piccolo su una singola operazione, ma questi calcoli concatenano somme, percentuali e split su più step e più anni — l'errore si accumula invece di cancellarsi. Su un motore che calcola quanto un professionista deve versare allo Stato, "quasi giusto" non è un'opzione.

**Scelta**: [`src/lib/money.ts`](src/lib/money.ts) — tutti gli importi come interi (centesimi) internamente, conversione a euro solo in UI. Ogni funzione fiscale passa da qui.

## 2. Motore fiscale come funzioni pure, non hook/servizi accoppiati

**Problema**: la logica di calcolo (aliquote, massimali, split acconti) doveva essere richiamabile da almeno tre punti diversi — UI React, Edge Function per notifiche/PDF, script di verifica — senza triplicare il codice.

**Alternativa scartata**: calcolo dentro gli hook React (`useFiscalCalculations` fa fetch *e* calcola), pattern comune quando si parte in fretta.

**Perché scartata**: accoppiare calcolo e fetching costringe a mockare Supabase e React solo per testare una formula, e rende impossibile riusare la stessa logica in un'Edge Function Deno.

**Scelta**: [`src/lib/fiscal-engine.ts`](src/lib/fiscal-engine.ts) e [`fiscal-utils.ts`](src/lib/fiscal-utils.ts) sono funzioni pure — input tipizzato, output tipizzato, zero dipendenze da React o dal client Supabase. Si testano in isolamento ([`fiscal-engine.test.ts`](src/lib/fiscal-engine.test.ts), [`fiscal-engine.stress.test.ts`](src/lib/fiscal-engine.stress.test.ts)) e si chiamano identiche da hook o da Edge Function.

## 3. Tipi derivati dallo schema DB via `Pick<>`, non interfacce scritte a mano

**Problema**: i parametri fiscali (aliquote, massimali, soglie) vivono in una tabella Postgres. Serviva un tipo TypeScript per passarli alle funzioni pure.

**Alternativa scartata**: un'interfaccia scritta a mano che rispecchia le colonne rilevanti.

**Perché scartata**: un'interfaccia manuale diverge in silenzio — se una colonna cambia nome o tipo nello schema, l'interfaccia resta com'è e il mismatch si scopre a runtime, nel peggiore dei casi in produzione.

**Scelta**: `FiscalRulesParams = Pick<FiscalRulesRow, ...>` ([fiscal-engine.ts:24](src/lib/fiscal-engine.ts#L24)) — il tipo deriva da quello generato dallo schema DB. Se una colonna sparisce, TypeScript rompe la build nel punto esatto, a compile-time.

## 4. Un bug di massimale trovato due volte → diventato regola di review fissa

**Problema**: l'enforcement del tetto massimo contributivo (massimale) per una gestione INPS è stato dimenticato in un'implementazione — poi si è ripresentato, stessa classe di bug, in una gestione diversa implementata dopo.

**Cosa è cambiato**: non un fix isolato — la verifica "il massimale è rispettato oltre la soglia" è diventata un controllo esplicito da fare per ogni nuova gestione contributiva, non solo un test caso per caso. Si vede nella copertura ripetuta su tutte le gestioni in [`fiscal-engine.test.ts`](src/lib/fiscal-engine.test.ts) e [`fiscal-engine.stress.test.ts`](src/lib/fiscal-engine.stress.test.ts).

**Lezione**: un bug che si ripete non è "sfortuna" — è un segnale che manca una checklist, non un test.

## 5. Empty-state della dashboard: guardia esplicita su due condizioni, non una

**Problema**: la dashboard nasconde le sezioni se l'utente non ha ancora incassi nell'anno corrente. Controllare solo "incassi anno corrente = 0" nascondeva anche le obbligazioni fiscali generate dall'anno precedente (reddito N-1 → tasse dovute nell'anno N) — un utente con zero incassi nel 2026 ma tasse 2025 da pagare vedeva una dashboard vuota, silenziosamente.

**Alternativa scartata**: `hasZeroIncassi = incassiYTD === 0`.

**Scelta**: `hasZeroIncassi = incassiYTD === 0 && !currentYearObligations.hasData` — entrambe le condizioni devono essere vere. Bloccato con un test di regressione dedicato ([`useFiscalCalculations.crossyear.test.tsx`](src/hooks/__tests__/useFiscalCalculations.crossyear.test.tsx), blocco `[REGRESSION]`) marcato esplicitamente come non modificabile senza motivo.

## 6. Una formula, due punti di lettura → unificata in un'unica fonte

**Problema**: "Netto Spendibile" veniva calcolato sia in Dashboard che nell'anteprima di Impostazioni — le due implementazioni erano divergenti, un cambiamento in una non si rifletteva nell'altra.

**Scelta**: estratte funzioni pure condivise (`computeNetSpendable`, `computeBufferAmount`, `computeMonthlyToolCost`, ecc.) come unica fonte di verità, richiamate da entrambi i punti. Test dedicato ([`net-spendable.test.ts`](src/lib/__tests__/net-spendable.test.ts)).

**Lezione**: se lo stesso numero si calcola in due posti, prima o poi diverge. La domanda giusta non è "dove ho sbagliato" ma "perché esistono due implementazioni".
