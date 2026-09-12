# Architettura

Note tecniche per chi vuole leggere o riusare il codice, non un tutorial completo.

## Stack

- **Frontend**: React + TypeScript + Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Edge Functions su Deno)
- **Test**: Vitest + jsdom
- **Pagamenti**: Stripe

## Principi

### 1. Calcoli monetari in centesimi, mai float

[`src/lib/money.ts`](src/lib/money.ts) tiene ogni importo come intero (centesimi), non come `number` in euro. Somme/percentuali/arrotondamenti su float accumulano errori — su un motore fiscale che calcola acconti e saldi su più anni l'errore si propaga. Tutte le funzioni fiscali passano da qui.

### 2. Motore fiscale puro, senza dipendenze React/Supabase

[`src/lib/fiscal-engine.ts`](src/lib/fiscal-engine.ts) e [`src/lib/fiscal-utils.ts`](src/lib/fiscal-utils.ts) sono funzioni pure: input → output, nessun side effect, nessun hook, nessuna chiamata di rete. I parametri (aliquote, massimali, soglie) entrano come argomenti tipizzati — non letti da uno store globale o da env impliciti.

Vantaggio diretto: si testano in isolamento (vedi `fiscal-engine.test.ts`, `fiscal-engine.stress.test.ts`) senza mock di React o Supabase, e si possono chiamare da un Edge Function, da uno script, o da un contesto React indifferentemente.

### 3. Parametri fiscali da fonte unica, zero approssimazione

Aliquote INPS, massimali, soglie: tutti da circolari ufficiali, salvati in tabella (`fiscal_rules`) e tipizzati via `Pick<FiscalRulesRow, ...>` invece di interfacce scritte a mano — se lo schema DB cambia, TypeScript segnala subito i punti da aggiornare invece di silenziare un mismatch a runtime.

### 4. Struttura `src/`

```
src/
  components/   componenti UI (shadcn/ui + custom)
  pages/        route-level components
  hooks/        data fetching, stato, side effect (React Query)
  contexts/     auth, tema, provider globali
  lib/          funzioni pure — fiscal-engine, money, export, parsing
  integrations/ client Supabase + tipi generati dal DB
```

`lib/` è la parte da leggere se interessa la logica di dominio; `components/`/`pages/`/`hooks/` sono l'orchestrazione React sopra quella logica.

### 5. Edge Functions

[`supabase/functions/`](supabase/functions) — Deno runtime. Le funzioni che scrivono con privilegi elevati (es. notifiche, PDF scadenzario, webhook Stripe) usano `SUPABASE_SERVICE_ROLE_KEY` lato server, mai esposta al client. Import via `https://esm.sh/`, non `npm:` (limite Deno).

### 6. Date/timezone

Tutte le date locali passano da `new Date("YYYY-MM-DDT00:00:00")`, mai `new Date("YYYY-MM-DD")` (quest'ultima parsa come UTC mezzanotte → shift di un giorno in fusi orari positivi). Vedi [`src/lib/schedule-helpers.ts`](src/lib/schedule-helpers.ts).

## Cosa manca in questo repo

Questo è uno snapshot decoupled da Lovable (vedi [README](README.md#nota-su-lovable-db-e-deploy)): niente automazione di deploy/DB, niente contenuti di prodotto (copy marketing, strategia, analytics interni) — solo il codice applicativo.
