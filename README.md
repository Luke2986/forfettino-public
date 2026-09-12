# Forfettino

Gestionale online per professionisti e freelance in **Regime Forfettario** (L. 190/2014).

> Snapshot pubblico del codice sorgente, rilasciato con licenza MIT a scopo di portfolio e community. Il prodotto live gira su un repository separato non pubblico; questa copia non riceve gli aggiornamenti automaticamente.

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
