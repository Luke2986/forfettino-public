# Forfettino

[![Test](https://github.com/Luke2986/forfettino-public/actions/workflows/test.yml/badge.svg)](https://github.com/Luke2986/forfettino-public/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)

Gestionale online per professionisti e freelance in **Regime Forfettario** (L. 190/2014).

> Snapshot pubblico del codice sorgente, rilasciato con licenza MIT a scopo di portfolio e community. Il prodotto live gira su un repository separato non pubblico; questa copia non riceve gli aggiornamenti automaticamente.

## Perché questo progetto

Il regime forfettario ha regole non banali — gestioni INPS diverse, soglia 85.000€, acconti e saldi che si incastrano tra un anno fiscale e l'altro, aliquote agevolate con scadenze. Tanti liberi professionisti le gestiscono a mano o con fogli Excel improvvisati, con margine d'errore reale.

Forfettino nasce per portare zero approssimazione nei calcoli (parametri sempre dalle circolari ufficiali, mai stimati) dentro un prodotto usabile. Questo repo pubblico esiste per mostrare come è costruito il motore di calcolo — vedi [ARCHITECTURE.md](ARCHITECTURE.md) — a chi vuole studiarlo, riusarlo, o imparare da un'app fiscale reale scritta in TypeScript.

## Funzionalità

- Calcolo netto spendibile in tempo reale
- Previsione imposta sostitutiva (5% o 15%)
- Calcolo contributi INPS Gestione Separata
- Gestione incassi e fatture
- Scadenziario fiscale con promemoria
- Monitoraggio soglia 85.000 EUR
- Gestione anagrafica clienti
- Import XML FatturaPA
- Export Excel per commercialista
- Navigazione multi-anno
- Autenticazione a due fattori (MFA)

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Payments**: Stripe

## Nota su Lovable, DB e deploy

Il prodotto live è costruito e ospitato su [Lovable](https://lovable.dev), che gestisce automaticamente il progetto Supabase collegato (DB, Auth, Edge Functions) e il deploy. **Questo repo pubblico non ha quel collegamento**: è codice sorgente puro, sganciato da Lovable.

Per farlo girare devi portare tu:
- **Database**: un tuo progetto Supabase (self-hosted o cloud). Schema e migrazioni sono in [`supabase/migrations`](supabase/migrations), le Edge Functions in [`supabase/functions`](supabase/functions) — vanno applicate/deployate con la [Supabase CLI](https://supabase.com/docs/guides/cli), non c'è automazione inclusa.
- **Deploy**: nessun vincolo di hosting. [`vercel.json`](vercel.json) è incluso come esempio funzionante, ma qualsiasi hosting per app Vite/React va bene.

## Configurazione

Il progetto non funziona senza le proprie chiavi — questo repo non contiene credenziali reali (rimosse dallo snapshot pubblico). Copia `.env.example` in `.env` e compila con un tuo progetto Supabase (obbligatorio) e, opzionalmente, PostHog/Sentry:

```sh
cp .env.example .env
```

## Sviluppo locale

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Test

```sh
npm test
```

## Altro

- [ARCHITECTURE.md](ARCHITECTURE.md) — decisioni tecniche e struttura del codice
- [DECISIONS.md](DECISIONS.md) — perché certe scelte, cosa è stato scartato e perché, bug reali e lezioni
- [docs/design-system.md](docs/design-system.md) — regole UI: gerarchia superfici, palette accessibile (WCAG AA), squircle system
- [CONTRIBUTING.md](CONTRIBUTING.md) — come contribuire
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
