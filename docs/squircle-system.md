# Squircle Design System — Guida Tecnica

> Documento target: **developer / agente AI** che mantiene o estende il design system Forfettino.
> Rules user-facing: `.claude/rules/design-system.md` sezione 13. Questa guida espande implementazione e edge case.

---

## 1. Overview

Lo **squircle** (squared circle, "superellisse") e' una forma intermedia tra rettangolo e cerchio, signature dell'estetica iOS Apple. La curvatura cambia in modo continuo, mai con stacco netto fra retta e arco — risultato visivo piu' "morbido" e premium di un `border-radius` standard.

**Forfettino lo adotta** come signature shape per dare coerenza visiva globale (premium feel allineato all'ispirazione Apple/Ive del design system, vedi `.claude/rules/design-system.md` sezione 1).

**Architettura scelta**: utility CSS-only (`squircle-sm/md/lg/2xl/full`) + component escape hatch `<Squircle>` (clip-path superellisse "vero", non usato attualmente).

Razionale: il border-radius standard CSS, ai tagli usati da Forfettino (8-24px), ha resa visiva indistinguibile dallo squircle reale. Il vantaggio in coerenza nominale (tutti i primitive condividono il sistema `squircle-*`) supera il costo di mantenere un component clip-path.

---

## 2. Tabella Radius

Single source of truth: [`.claude/rules/design-system.md`](../.claude/rules/design-system.md) sezione 13.1. Replicata qui per quick reference:

| Utility | CSS variable | Pixel | Use case |
|---|---|---|---|
| `squircle-sm` | `--squircle-radius-sm` | 8px | Sub-element nested |
| `squircle-md` | `--squircle-radius-md` | 12px | **Default**: button, input, segmented, banner inline, popover, dropdown, toast, tooltip |
| `squircle-lg` | `--squircle-radius-lg` | 16px | Card primitive, alert sistema |
| `squircle-2xl` | `--squircle-radius-2xl` | 24px | Modal/Dialog premium |
| `squircle-full` | (literal `9999px`) | 9999px | Progress bar, micro-pill (alias `rounded-full`) |

---

## 3. Implementazione tecnica

### 3.1 Tailwind plugin

[`tailwind.config.ts:6-19`](../tailwind.config.ts):

```ts
const squirclePlugin = plugin(({ addUtilities }) => {
  addUtilities({
    ".squircle-sm": { borderRadius: "var(--squircle-radius-sm)" },
    ".squircle-md": { borderRadius: "var(--squircle-radius-md)" },
    ".squircle-lg": { borderRadius: "var(--squircle-radius-lg)" },
    ".squircle-2xl": { borderRadius: "var(--squircle-radius-2xl)" },
    ".squircle-full": { borderRadius: "9999px" },
  });
});
```

Il plugin e' caricato globalmente — utility disponibili in tutto il codebase senza import esplicito.

### 3.2 CSS variables

[`src/index.css:115-120`](../src/index.css):

```css
--squircle-smoothing: 0.6;
--squircle-radius-sm: 8px;
--squircle-radius-md: 12px;
--squircle-radius-lg: 16px;
--squircle-radius-2xl: 24px;
```

`--squircle-smoothing` e' usata SOLO dal component `<Squircle>` (parametro lib `figma-squircle`). Le utility CSS leggono solo `--squircle-radius-*`.

### 3.3 Component (escape hatch)

[`src/components/ui/squircle.tsx`](../src/components/ui/squircle.tsx) esporta:

- `<Squircle>` — wrapper React che applica clip-path superellisse iOS-style via lib `figma-squircle`
- `useSquirclePath` hook — calcola SVG path data
- `useElementSize` hook — ResizeObserver per re-render on resize

> **Stato attuale**: zero consumer in produzione. Disponibile come escape hatch per casi futuri. Non e' API pubblica stabile, breaking change ammessa.

### 3.4 Feature flag `VITE_SQUIRCLE_ENABLED`

Build-time, default `true`. Disabilita SOLO il rendering clip-path del `<Squircle>` component (degrada a `border-radius` standard). Non influenza le utility CSS, sempre presenti.

Irrelevante runtime finche' non esistono consumer di `<Squircle>` clip-path.

---

## 4. Quando usare `<Squircle>` component vs utility

### 4.1 Default: utility CSS

Usare sempre `squircle-md` (o variante) come prima scelta:

```tsx
<button className="squircle-md bg-teal-600 text-white px-4 py-2">
  Calcola tasse
</button>

<div className="squircle-lg bg-white shadow-md p-6">
  Card content
</div>
```

Vantaggi:

- Zero JS runtime (no ResizeObserver, no React state)
- Bundle impact: 0 byte CSS aggiuntivo (utility classes sono ~20 byte gzipped totali)
- Funziona nativamente in tutti gli stati (hover, focus, disabled, active)
- Compatibile con qualsiasi shadow, border, ring CSS
- Compatibile con prerender SSG (no hydration mismatch)

### 4.2 Escape hatch: component clip-path

Usare SOLO se serve forma squircle "vera" (curvatura continua, non border-radius standard) E hai shadow critica che richiede pattern wrapper:

```tsx
import { Squircle } from "@/components/ui/squircle";

// Esempio teorico — nessun consumer attuale
<Squircle radius={24} cornerSmoothing={0.6} className="bg-white p-6">
  Premium card content
</Squircle>
```

**Quando NON usare il component**:

- Se `border-radius` standard rende visivamente equivalente — usa utility
- Se hai animazioni `border-radius` interpolato — clip-path non interpola fluido
- Se hai overflow critico (es. `overflow-x-auto`) — clip-path puo' tagliare in modo inatteso

---

## 5. Pattern wrapper shadow + squircle

### 5.1 Caso utility (nessun problema)

```tsx
<div className="squircle-md bg-white shadow-md">
  Content
</div>
```

`box-shadow` rende correttamente attorno al `border-radius` CSS. Nessun wrapper necessario.

### 5.2 Caso component clip-path (escape hatch futuro)

Il `<Squircle>` component usa `clip-path: path(...)`, che **clippa anche lo `box-shadow`**. Per preservare la shadow esterna, applicare il pattern wrapper:

```tsx
// Wrapper esterno: shadow + border-radius standard (per shadow visibile)
<div className="shadow-md rounded-2xl">
  {/* Squircle interno: clip-path real */}
  <Squircle radius={24} cornerSmoothing={0.6} className="bg-white p-6">
    Content
  </Squircle>
</div>
```

Il wrapper esterno definisce la "silhouette" visibile della shadow (border-radius standard, equivalente percepito) e il clip-path interno definisce la forma del contenuto.

> Pattern documentato per completezza. Zero consumer attuali in Forfettino.

---

## 6. Pattern border + squircle

### 6.1 Utility (nessun problema)

```tsx
<input className="squircle-md border border-slate-300 px-3 py-2" />
```

`border` CSS standard segue il `border-radius`. Nessun trick necessario.

### 6.2 Component clip-path

`border` CSS NON e' visibile sotto un `clip-path` (viene clippato fuori). Sostituire con `outline` o ring shadow:

```tsx
// NON funziona — border invisibile
<Squircle radius={12} className="border border-slate-300 ...">

// OK — outline sostituisce border
<Squircle radius={12} className="outline outline-1 outline-slate-300 ...">

// OK — ring shadow simula border
<Squircle radius={12} className="shadow-[0_0_0_1px_rgba(203,213,225,1)] ...">
```

---

## 7. Componenti aggiornati Epic 81 (mappa primitive → utility)

| Primitive | File | Utility applicata | Story |
|---|---|---|---|
| Card backbone | `src/components/ui/card.tsx` | `rounded-2xl` (invariato) — wrapper opt-in via Story 81-2 | 81-2 |
| SpendibileHero | `src/components/dashboard/SpendibileHero.tsx` | wrapper Card primitive `rounded-2xl` | 81-2 |
| KpiCard | `src/components/dashboard/KpiCard.tsx` | wrapper `rounded-2xl` | 81-2 |
| ScadenzeInline | `src/components/dashboard/ScadenzeInline.tsx` | wrapper `rounded-2xl` | 81-2 |
| MonthlyRevenueChart wrapper | `src/components/dashboard/MonthlyRevenueChart.tsx` | wrapper `rounded-2xl` | 81-2 |
| Sidebar nav active + child | `src/components/layout/AppSidebar.tsx` | `squircle-md` | 81-3 |
| Logo box | `src/components/layout/AppSidebar.tsx`, mobile header | `squircle-md` | 81-3 |
| Button base (cva) | `src/components/ui/button.tsx` | `squircle-md` (size sm/lg overrides), `squircle-full` (alias rounded-full) | 81-4 |
| Tabs / Segmented control | Calendario, TaskPage, ReportClienti | `squircle-md` / `squircle-full` | 81-4 |
| MobileHeader hamburger | `src/components/layout/MobileHeader.tsx` | `squircle-md` | 81-4 |
| Dialog / AlertDialog | `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx` | `sm:squircle-2xl` | 81-5 |
| BlockingModal | `src/components/notifications/BlockingModal.tsx` | `sm:squircle-2xl` | 81-5 |
| Popover | `src/components/ui/popover.tsx` | `squircle-md` | 81-5 |
| Tooltip | `src/components/ui/tooltip.tsx` | `squircle-md` | 81-5 |
| DropdownMenuContent | `src/components/ui/dropdown-menu.tsx` | `squircle-md` | 81-5 |
| Toast (Radix) / Sonner | `src/components/ui/toast.tsx`, `sonner.tsx` | `squircle-md` | 81-5 |
| Input / Textarea / Select / PasswordInput / Command | `src/components/ui/*` | `squircle-md` | 81-6 |
| Banner inline | SogliaInline, FirstIncomeBanner, BenchmarkNudgeBanner, PricingSurveyNudge, InactiveSurveyBanner | `squircle-md` | 81-6 |
| Alert sistema | OnboardingBanner | `squircle-lg` (standalone) | 81-6 |
| Alert sistema (override Card) | ExpiredRatesBanner | `!squircle-lg` (`!` per override Card primitive) | 81-6 |
| Progress | `src/components/ui/progress.tsx` | `squircle-full` (alias rounded-full) | 81-6 |

---

## 8. Componenti NON squirclati (intenzionalmente)

Decisioni esplicite Epic 81. NON modificare senza motivazione documentata:

- **Checkbox, Radio** — troppo piccoli (<20px), percezione zero
- **InputOTP cells** — split radius nativo `<InputOTP>` Radix, design tokens primitivi mantenuti
- **Calendar day cells** — sub-element 32x32px, sub-radius standard
- **Avatar** — `rounded-full` (alias semantico equivalente a `squircle-full`)
- **Badge / Status pill** — decisione 81-7 Opzione A: `rounded-full`. Squircle non percepibile <30px
- **Sheet / Drawer Vaul** — primitive consumer-driven (utility applicata caso per caso al consumer, non al primitive)
- **Drawer drag handle** — `rounded-full` micro 8x100, percezione nulla

---

## 9. Test coverage

88 test squircle in 6 file. Suite invariata baseline post-81-7 (4094 pass + 13 skipped / 4107 totali).

| File | Test count | Scope |
|---|---|---|
| `src/components/ui/__tests__/squircle.test.tsx` | 17 | Foundation (component, hooks, utility CSS variables) |
| `src/components/dashboard/__tests__/squircle-cards.test.tsx` | 16 | SpendibileHero, KpiCard, ScadenzeInline, chart wrapper |
| `src/components/layout/__tests__/squircle-identity.test.tsx` | 10 | Sidebar nav + logo box + AvatarDropdown no-op |
| `src/components/ui/__tests__/squircle-interactive.test.tsx` | 19 | Button base + Tabs + segmented controls |
| `src/components/ui/__tests__/squircle-overlay.test.tsx` | 11 | Dialog, AlertDialog, BlockingModal, Popover, Tooltip, DropdownMenuContent, Toast, Sonner |
| `src/components/ui/__tests__/squircle-form-feedback.test.tsx` | 15 | Input/Textarea/Select/Command, banner, alert, Progress, Badge no-op |

---

## 10. Decisioni architetturali e tradeoff

### 10.1 Utility-only vs component clip-path

**Decisione**: utility CSS-only attiva. Component `<Squircle>` disponibile come escape hatch, zero consumer.

**Razionale**:

- Performance: `border-radius` nativo CSS = zero costo runtime. `<Squircle>` clip-path richiede ResizeObserver + path SVG re-computation
- Bundle: utility plugin = ~50 byte CSS gzipped totali. `figma-squircle` lib = +29 byte JS gzipped (residuo dead code accettabile, non rimosso per preservare escape hatch)
- Visual: a 8-24px border-radius, la differenza visiva tra `border-radius` CSS standard e clip-path superellisse "vero" e' indistinguibile a occhio nudo
- Compatibilita': utility funziona ovunque (hover/focus/disabled, prerender SSG, qualsiasi shadow/border)

### 10.2 Backward compat `rounded-*`

**Decisione**: `rounded-*` continua a funzionare. Deprecato per nuovi componenti, lasciato invariato per legacy.

**Razionale**: zero rischio regressione, no big-bang migration. Refactor incrementale solo quando si tocca il primitive per altre ragioni.

### 10.3 Feature flag `VITE_SQUIRCLE_ENABLED`

**Decisione**: build-time, default `true`. Disabilita SOLO il rendering clip-path del `<Squircle>` component.

**Razionale**: irrilevante runtime finche' non esistono consumer di `<Squircle>` clip-path. Riservato a futuri rollout/rollback rapidi se mai un consumer adottasse il component e si manifestasse un bug.

### 10.4 `squircle-full` come alias di `rounded-full`

**Decisione**: `squircle-full` = `9999px` (esattamente come `rounded-full`).

**Razionale**: un cerchio perfetto e' geometricamente un caso degenere di squircle. Non c'e' shape change da fare. Mantenuto sotto namespace `squircle-*` per coerenza nominale del design system.

---

## 11. Riferimenti

- Regole user-facing: [`.claude/rules/design-system.md`](../.claude/rules/design-system.md) sezione 13
- Changelog Epic 81: [`docs/CHANGELOG-DESIGN.md`](./CHANGELOG-DESIGN.md)
- Epic doc: `_bmad-output/implementation-artifacts/epic-81-squircle-design-system.md`
- Stories Epic 81:
  - 81-1: `_bmad-output/implementation-artifacts/81-1-foundation-lib-component-tailwind-plugin.md`
  - 81-2: `_bmad-output/implementation-artifacts/81-2-card-primarie-hero-kpi-scadenze-chart.md`
  - 81-3: `_bmad-output/implementation-artifacts/81-3-identita-avatar-logo-sidebar-nav.md`
  - 81-4: `_bmad-output/implementation-artifacts/81-4-interattivi-bottoni-tab-segmented.md`
  - 81-5: `_bmad-output/implementation-artifacts/81-5-overlay-modal-sheet-dialog-popover.md`
  - 81-6: `_bmad-output/implementation-artifacts/81-6-form-feedback-input-banner-alert-badge.md`
  - 81-7: `_bmad-output/implementation-artifacts/81-7-mobile-validation-performance-a11y.md`
  - 81-8: `_bmad-output/implementation-artifacts/81-8-documentation-design-system-rules-update.md`
- Test files (mappa sezione 9 sopra)
- Audit script 81-7: `_bmad-output/implementation-artifacts/axe-scan-81-7.mjs`
