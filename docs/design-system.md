# Forfettino Design System Rules

<!-- v4 (Epic 81 done — 2026-04-29): squircle utility CSS-only attiva su tutti i primitive UI. Vedi sezione 13 + docs/squircle-system.md. -->

Queste regole governano dimensioni, proporzioni, spaziatura, colori e layout di TUTTI i componenti UI.
Ogni sviluppatore (umano o AI) DEVE rispettarle. Violazioni = regressione visiva.

---

## 1. Filosofia di Design

Stile ispirato al design Apple/Ive: pulizia, profondita' tramite ombre (non bordi decorativi), gerarchia visiva tramite "materiali" diversi.

### Principi fondamentali
- **Profondita' tramite shadow sottile + ring** — le card usano ombre minimali con ring 1px per definizione. Hero ha ombre piu' pronunciate
- **Gerarchia a 3 livelli di superficie**: Hero (elevazione alta) > Card dati (elevazione media, gradiente diagonale) > Card scadenze (stessa superficie, layout diverso)
- **Accento cromatico diagonale sulle KPI card** — gradiente sbiadito (~30% opacity) dall'angolo basso-sinistro per identificare la categoria (blu=entrate, ambra=accantonamento, viola=proiezione)
- **Colore semantico nei valori** — il colore va anche sui numeri (`valueColor`) in aggiunta al gradiente diagonale
- **Sfondo con gradiente sottile** — crea profondita' ambientale e mette in risalto le card bianche
- **Squircle iOS-style come signature shape** — utility `squircle-sm/md/lg/2xl/full` su tutti i primitive UI (button, input, card, dialog, banner). Backward compat `rounded-*` funziona ma deprecato per nuovi componenti. Vedi sezione 13 + `docs/squircle-system.md` per implementazione e edge case

---

## 2. Sfondo e Superfici

### 2.1 Sfondo globale (AppLayout `<main>`)
```
bg-gradient-to-b from-slate-100 via-slate-100/80 to-slate-200/60
```
- IMPORTANT: MAI usare `bg-slate-50` piatto — il gradiente crea profondita' ambientale
- MAI duplicare lo sfondo nei componenti interni

### 2.2 Livelli di superficie (Material Hierarchy)

| Livello | Uso | Background | Shadow | Border | Radius |
|---------|-----|-----------|--------|--------|--------|
| **Hero** | SpendibileHero | `bg-white` | `shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]` hover: `shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.1)]` | `border border-slate-200/60` | Card primitive `rounded-2xl` (Story 81-2 wrapper opzionale per clip-path squircle "vero", non attivo) |
| **Card dati** | KpiCard, Chart | KPI: gradiente diagonale via `style.background` (vedi 4.3). Chart: `bg-white` | `shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]` hover: `shadow-[0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(23,23,23,0.08)]` | `border-0` + ring via shadow. Nessun `border-l` ne' `overflow-hidden` sulle KPI. | `rounded-2xl` (Card primitive backbone) |
| **Card scadenze** | ScadenzeInline | `bg-stone-50` | Nessuna ombra — superficie secondaria "appoggiata" | `border border-stone-200/40`. Righe interne: `border-b border-slate-100` | `rounded-2xl` |
| **Banner/Alert** | OnboardingBanner / ExpiredRatesBanner / SogliaInline / FirstIncomeBanner / nudge banner | Tinta specifica (teal-50, amber-50) | `shadow-md` solo onboarding | `border border-border/60` | Banner inline `squircle-md` (12px). Alert sistema `squircle-lg` (16px, OnboardingBanner standalone, ExpiredRatesBanner via `!squircle-lg` override Card primitive) |

IMPORTANT: Card primitive (`src/components/ui/card.tsx`) usa `rounded-2xl` (16px) come backbone. Banner e alert usano utility `squircle-*` (sezione 13). MAI `rounded-xl` o `rounded-lg` per card principali.

---

## 3. Gerarchia Larghezze (Width Tiers)

Il sistema ha 3 livelli di larghezza. MAI creare nuovi livelli o bypassare quelli esistenti.

| Tier | Token CSS | Tailwind | Pixel max | Uso |
|------|-----------|----------|-----------|-----|
| **Full** | — | `max-w-5xl` | 1024px | AppLayout (SOLO qui, NON nei componenti) |
| **Content** | `--v2-max-content` | `max-w-4xl` | 896px | Dashboard grid, card zone, tabelle dati |
| **Narrow** | `--v2-max-narrow` | `max-w-3xl` | 768px | Prose, form, guide (PageContainer `narrow`) |

### Regola fondamentale
- IMPORTANT: I componenti interni alla pagina (card, grid, banner, chart) NON devono MAI raggiungere `max-w-5xl`. Quel livello e' SOLO per AppLayout.
- Il contenuto principale delle pagine deve vivere entro `max-w-4xl` (896px).
- `PageContainer` default dovrebbe applicare `max-w-4xl mx-auto` come vincolo di contenuto.

---

## 4. Card — Regole Dimensionali

### 4.1 Base Card (`src/components/ui/card.tsx`)
- Il componente base `Card` NON ha e NON deve avere width/max-width.
- La larghezza e' SEMPRE governata dal container genitore (grid cell, flex wrapper, PageContainer).

### 4.2 Hero Card (SpendibileHero)
- Max-width: ereditato dal container content-tier (`max-w-4xl`)
- Padding interno: `p-6 sm:p-8`
- **NESSUN border-top accent** — la profondita' viene dalla shadow, non dai bordi
- Radius: `rounded-2xl` (16px)
- Shadow: livello Hero (vedi sezione 2.2)
- Il contenuto interno (gauge Soglia 85k, savings banner) e' `w-full` relativo alla card

### 4.3 KPI Card (KpiCard)
- Disposizione: griglia `grid-cols-2 sm:grid-cols-3 gap-4` (2 colonne mobile, 3 desktop). La terza card usa `col-span-2 sm:col-span-1` per occupare tutta la riga su mobile
- Larghezza singola card: 1/3 del container content su desktop (circa 280px), 1/2 su mobile
- Padding interno: `p-4 sm:p-5` (16px mobile, 20px desktop)
- **Gradiente diagonale sbiadito**: `linear-gradient(to top right, ${accentRgba} 0%, transparent 55%), white` via `style.background`. Nessun `border-l` ne' `overflow-hidden`.
- Colori gradiente (30% opacity): `rgba(147,197,253,0.30)` (entrate/blue), `rgba(251,191,36,0.30)` (accantonamento/amber), `rgba(167,139,250,0.30)` (proiezione/violet). La prop `accentColor` accetta le chiavi legacy (`"border-l-blue-300"` ecc.) mappate internamente via `ACCENT_GRADIENTS`.
- Colori valore: `valueColor` prop per testo numerico (`text-slate-800`, `text-amber-700`, `text-violet-700`)
- Shadow: `shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]` (ring simulato via spread shadow)
- Border: `border-0` (il contorno e' dato dal ring shadow, non da border CSS)
- Radius: `rounded-2xl`
- Tipografia valore: `text-xl font-bold` (MAI piu' grande)
- IMPORTANT: Le KPI card NON vanno mai in layout a colonna singola su desktop

### 4.4 Card Scadenze (ScadenzeInline)
- Max-width: ereditato dal container content-tier
- Background: `bg-stone-50` (superficie secondaria calda — "carta naturale")
- Border: `border border-stone-200/40` (sottile, nessuna ombra)
- **NESSUNA shadow** — si distingue dalle card bianche per materiale, non per elevazione
- Padding: `p-6 sm:p-8` (piu' generoso delle KPI card)
- Layout interno: header (titolo + totale), righe deadline con `border-b border-slate-100`, footer link
- Ogni riga: dot colorato + data bold + descrizione + countdown (due righe), importo a destra
- Footer: "Vai allo scadenziario" link a destra
- Radius: `rounded-2xl`

### 4.5 Card Grafici (MonthlyRevenueChart wrapper)
- Max-width: ereditato dal container content-tier
- Altezza chart compatto (Dashboard): `h-[180px]`
- Altezza chart espanso: `h-[300px]`
- Padding: `pt-4 pb-3 px-4` per CardContent
- Shadow: livello Card dati (vedi sezione 2.2)

---

## 5. Colori Semantici

Le KPI card usano un doppio sistema cromatico: gradiente diagonale (angolo basso-sinistro) + colore valore numerico.

| Card/Sezione | Gradiente diagonale | Colore valore | Gradient rgba | Tailwind value |
|--------------|---------------------|---------------|---------------|----------------|
| Hero (Spendibile) | Nessuno | Slate scuro | — | `text-slate-900` |
| KPI Entrate | Blu 30% | Slate scuro | `rgba(147,197,253,0.30)` | `text-slate-800` |
| KPI Accantonare | Ambra 30% | Amber/warning | `rgba(251,191,36,0.30)` | `text-amber-700` |
| KPI Proiezione | Viola 30% | Violet | `rgba(167,139,250,0.30)` | `text-violet-700` |

### Label "Netto Spendibile"
- Classe: `text-sm font-semibold text-teal-700 uppercase tracking-wider`
- IMPORTANT: Il teal e' riservato SOLO a questa label sulla Hero card

---

## 6. Banner e Alert — Regole

### 6.1 Banner inline (SogliaInline, savings tip, FirstIncomeBanner)
- Max-width: ereditato dal container content-tier
- IMPORTANT: I banner con sfondo colorato (amber, blue, green) devono avere `rounded-lg` e padding `px-4 py-3`
- NON devono avere ombre (no shadow)

### 6.2 Alert di sistema (OnboardingBanner, ExpiredRatesBanner)
- Full-width del container content-tier
- Background distintivo (gradient teal per onboarding, amber/red per warning)
- IMPORTANT: Gli alert NON devono competere visivamente con la Hero card

---

## 7. Tipografia Gerarchica

| Livello | Uso | Classe | Esempio |
|---------|-----|--------|---------|
| Hero value | SpendibileHero importo | `text-4xl sm:text-5xl font-bold tabular-nums` | 5.852,54 EUR |
| KPI value | KpiCard importo | `text-xl font-bold tabular-nums` | 10.000,00 EUR |
| Section title | Titoli pagina (h1) | `text-2xl font-bold` | Incassi |
| Card label | Label KPI card | `text-sm text-slate-600` | Entrate 2026 |
| Hero label | Label Hero card | `text-sm font-semibold text-teal-700 uppercase tracking-wider` | NETTO SPENDIBILE |
| Section label | Scadenze header | `text-sm font-semibold text-slate-900` | Prossime scadenze |
| Body | Testo normale, tooltip, dettagli | `text-sm` | Descrizioni |
| Caption | Badge, chip, note molto secondarie | `text-xs text-slate-600` | Solo dove strettamente necessario |

IMPORTANT: I valori monetari nelle KPI card usano SEMPRE `text-xl font-bold`. MAI `text-2xl` o superiore (riservato alla Hero).

---

## 8. Accessibilita' (WCAG 2.1 AA) — Regole Colore e Tipografia

### 8.1 Colori testo VIETATI su sfondo chiaro
- **`text-slate-400`** — VIETATO (ratio ~3.2:1, FAIL AA). Minimo: `text-slate-500`
- **`text-slate-300`** — VIETATO come colore testo
- **Qualsiasi colore con ratio < 4.5:1** su `bg-white` o `bg-slate-50` — VIETATO per testo informativo

### 8.2 Dimensioni minime testo
- **`text-xs` (12px)** — SOLO per badge, chip, caption puramente decorativa. MAI per label card, body text, o testo che l'utente deve leggere
- **`text-[11px]` e `text-[10px]`** — ELIMINATI dal codebase. MAI usarli
- **Minimo per label e body**: `text-sm` (14px)

### 8.3 Palette sicura (ratio ≥ 4.5:1 su bg-white)

| Classe | Ratio | Uso |
|--------|-------|-----|
| `text-slate-900` | ~15.4:1 | Valori primari, titoli |
| `text-slate-800` | ~11.8:1 | Valori KPI, testo forte |
| `text-slate-700` | ~8.6:1 | Testo corpo principale |
| `text-slate-600` | ~5.7:1 | Label card, testo secondario |
| `text-slate-500` | ~4.6:1 | Icone, placeholder, testo meno prominente |
| `text-teal-700` | ~5.4:1 | Label Hero, accenti teal |
| `text-amber-700` | ~4.8:1 | Warning, KPI accantonamento |
| `text-violet-700` | ~5.2:1 | KPI proiezione |
| `text-red-600` | ~4.6:1 | Errori, scadenze urgenti |

IMPORTANT: Per icone informative (Info, tooltip trigger), usare minimo `text-slate-500` (non `text-slate-400`).

---

## 9. Griglia e Spacing — Regole

### 9.1 Dashboard Grid Layout
```
PageContainer (p-4 sm:p-5, space-y-5)
  └── content-zone (max-w-4xl mx-auto)
        ├── Header row (greeting + CTA)
        ├── Banner zone (alert, onboarding)
        ├── Hero card (SpendibileHero) — full content-width, bg-white, shadow Hero
        ├── KPI grid (grid-cols-2 sm:grid-cols-3 gap-4) — bg-white, ring shadow, diagonal gradient accent
        ├── Scadenze (ScadenzeInline) — bg-white, ring shadow, row separators
        └── Chart card — bg-white, shadow Card
```

### 9.2 Spacing tra sezioni
| Contesto | Gap | Tailwind |
|----------|-----|----------|
| Dashboard sezioni | 20px | `space-y-5` |
| Pagine standard | 24px | `space-y-6` (default PageContainer) |
| Pagine prose/guide | 32px | `space-y-8` (override via className) |
| Interno card | 12-16px | `space-y-3` o `space-y-4` |
| Grid KPI gap | 16px | `gap-4` |

### 9.3 Padding
| Contesto | Mobile | Desktop | Tailwind |
|----------|--------|---------|----------|
| PageContainer esterno | 16px | 20px | `p-4 sm:p-5` |
| Hero card interno | 24px | 32px | `p-6 sm:p-8` |
| KPI card interno | 16px | 20px | `p-4 sm:p-5` |
| Card scadenze | 24px | 32px | `p-6 sm:p-8` |
| Banner/alert | 12-16px | 16px | `px-4 py-3` |

---

## 10. Responsive Breakpoints

| Breakpoint | Tailwind | Comportamento |
|------------|----------|---------------|
| < 640px (mobile) | default | 1 colonna, padding ridotto, MobileHeader visibile |
| >= 640px (sm) | `sm:` | KPI grid 3 colonne, padding aumentato |
| >= 768px (md) | `md:` | Desktop header visibile, sidebar espansa |
| >= 1024px (lg) | `lg:` | Layout finale, max-w-5xl attivo |

### Regole responsive per card
- IMPORTANT: Le card NON cambiano mai la propria struttura interna ai breakpoint (no card flip, no card reorder)
- Solo la GRIGLIA genitore cambia: `grid-cols-1` -> `sm:grid-cols-3`
- Il padding interno delle card rimane fisso (non cambia per breakpoint, eccetto Hero che ha `p-6 sm:p-8`)

---

## 11. Anti-Pattern (NON FARE MAI)

1. **MAI** usare `border-t-[3px]`, `border-l-[3px]` o bordi colorati sulle card — l'accento KPI e' un gradiente diagonale via `style.background`, non un border CSS
2. **MAI** usare `text-slate-400` per testo leggibile — minimo `text-slate-500`
3. **MAI** usare `text-xs` per label card o body text — minimo `text-sm`
4. **MAI** usare `text-[11px]` o `text-[10px]` — eliminati dal design system
5. **MAI** hardcodare `max-w-5xl` su un componente card/banner — quel livello e' SOLO per AppLayout
6. **MAI** usare `w-screen` o `w-full` su una card che vive dentro PageContainer
7. **MAI** creare card senza un container genitore che ne limiti la larghezza
8. **MAI** usare font-size superiore a `text-xl` per valori KPI (solo la Hero ha `text-4xl+`)
9. **MAI** usare `min-h-screen` dentro PageContainer (gia' gestito da AppLayout)
10. **MAI** duplicare lo sfondo gradient (gia' su `<main>` in AppLayout)
11. **MAI** aggiungere `animate-page-enter` ai componenti (gia' in AppLayout wrapper)
12. **MAI** usare padding > `p-6` sulle card standard (Hero e ScadenzeInline possono avere `p-8`)
13. **MAI** usare `rounded-xl` per card principali — usare sempre `rounded-2xl`
14. **MAI** usare `shadow-sm` o `shadow-md` generici — usare i livelli shadow definiti nella sezione 2.2
15. **MAI** usare `border` standard sulle KPI/Scadenze card — il contorno e' dato dal ring shadow (`0 0 0 1px`), non da CSS border
16. **MAI** usare `overflow-hidden` sulle KPI card — non piu' necessario (il border-left e' stato sostituito dal gradiente)
17. **MAI** mischiare `rounded-*` e `squircle-*` sullo stesso elemento — scegliere UNA convenzione. Per nuovi componenti usare `squircle-*` per coerenza Epic 81. Per legacy `rounded-*` lasciare invariato finche' non si refattorizza il primitive

---

## 12. Implementazione Pratica

### PageContainer — aggiornamento necessario
Il componente `PageContainer` attualmente NON applica `max-w-4xl` nel variant default.
Per risolvere il problema delle card troppo larghe, il default deve diventare:

```tsx
// PROPOSTA: PageContainer con content-tier
className={cn(
  "p-4 sm:p-5 space-y-6",
  "max-w-4xl mx-auto",              // content-tier: 896px
  narrow && "max-w-3xl",            // narrow override: 768px
  className
)}
```

Questo garantisce che TUTTE le pagine (Dashboard incluso) abbiano card proporzionate entro 896px, senza dover toccare ogni singolo componente.

### Alternative per Dashboard specifico
Se il PageContainer default deve restare full-width per alcune pagine, creare un wrapper `content-zone` nel Dashboard:

```tsx
<PageContainer className="space-y-5">
  <div className="max-w-4xl mx-auto space-y-5">
    {/* Hero, KPI grid, chart, etc */}
  </div>
</PageContainer>
```

### Squircle utility import
Le utility `squircle-sm/md/lg/2xl/full` sono auto-disponibili tramite il `squirclePlugin` registrato in [tailwind.config.ts:6-19](../tailwind.config.ts). Le CSS variables `--squircle-radius-*` sono definite in [src/index.css:115-120](../src/index.css). Nessun import richiesto in `.tsx` — basta usare le classi.

```tsx
<div className="squircle-md bg-white shadow-md p-4">...</div>
<button className="squircle-md bg-teal-600 text-white px-4 py-2">...</button>
```

Per il dettaglio completo (component escape hatch, casi edge, pattern shadow + clip-path), vedi sezione 13 + [`docs/squircle-system.md`](squircle-system.md).

---

## 13. Squircle System — Quando e Come Applicarlo

Il **Squircle Design System** (Epic 81) e' il sistema di border-radius unificato di Forfettino. Implementato come **utility CSS-only** (zero costo runtime), applicato a tutti i primitive UI (button, input, card, dialog, banner). Backward compat `rounded-*` continua a funzionare ma e' deprecato per nuovi componenti.

### 13.1 Tabella utility standard

| Utility | CSS variable | Pixel | Use case |
|---|---|---|---|
| `squircle-sm` | `--squircle-radius-sm` | 8px | Sub-element nested (calendar cells legacy, micro-pill se mai) |
| `squircle-md` | `--squircle-radius-md` | 12px | **Default**: button, input, segmented control, banner inline, popover, dropdown, toast, tooltip |
| `squircle-lg` | `--squircle-radius-lg` | 16px | Card primitive, alert sistema (OnboardingBanner, ExpiredRatesBanner) |
| `squircle-2xl` | `--squircle-radius-2xl` | 24px | Modal/Dialog/AlertDialog/BlockingModal (bordo arrotondato premium) |
| `squircle-full` | (literal `9999px`) | 9999px | Progress bar, drag handle, micro-pill (degenera a cerchio — alias `rounded-full`) |

Le CSS variables sono definite in [src/index.css:115-120](../src/index.css). Override globale possibile lato design system.

### 13.2 Quando usare `<Squircle>` component vs utility

- **Default: utility CSS** — sempre prima scelta. Performance zero-cost (no JS runtime, no ResizeObserver), bundle impact 0 byte CSS aggiuntivo. Funziona ovunque, anche in stati hover/focus/disabled
- **Escape hatch: `<Squircle>` component** ([src/components/ui/squircle.tsx](../src/components/ui/squircle.tsx)) — SOLO se serve forma squircle "vera" (clip-path superellisse iOS-style geometricamente corretta) E componente ha shadow critica che richiede pattern wrapper. **Zero consumer attuali in Forfettino — riservato a casi futuri ad-hoc**

> Il `<Squircle>` component esiste come escape hatch. Non e' API pubblica stabile: breaking change ammessa.

### 13.3 Componenti N/A (intenzionalmente NON squirclati)

Decisioni esplicite Epic 81:

- **Checkbox, Radio** — troppo piccoli (<20px), percezione zero della differenza
- **InputOTP cells** — split radius nativo `<InputOTP>` Radix, design tokens primitivi mantenuti
- **Calendar day cells** — sub-element 32x32px, sub-radius standard, nessun valore visivo da squircle
- **Avatar** — `rounded-full` = `squircle-full` sintatticamente (cerchio = squircle degenere). Scelta storica AvatarDropdown mantenuta
- **Badge / Status pill** — decisione 81-7 Opzione A: `rounded-full` (pill aesthetic universale). Squircle non percepibile <30px

### 13.4 Casi edge documentati

- **Dialog/Sheet/AlertDialog X close button**: `rounded-sm` su button 28px hit-area dentro 44x44 wrapper — micro-button OK, decisione 81-5
- **SogliaForfettarioBanner progress bar interne** (4 occorrenze `rounded-full`): equivalenti `squircle-full` (alias sintattico)
- **Drawer Vaul drag handle**: `rounded-full` micro 8x100, percezione nulla — invariato

### 13.5 Backward compatibility

`rounded-sm/md/lg/xl/2xl/full` continuano a funzionare. Per legacy, lasciare invariato finche' non si refattorizza il primitive (vedi Anti-Pattern voce 17). Per nuovi componenti, usare `squircle-*`.

### 13.6 Riferimenti

- Guida tecnica completa: [`docs/squircle-system.md`](squircle-system.md) (component vs utility, pattern shadow + clip-path, mappa primitive → utility)
- Changelog Epic 81: [`docs/CHANGELOG-DESIGN.md`](CHANGELOG-DESIGN.md)
