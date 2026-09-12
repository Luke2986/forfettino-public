# Forfettino — Design System Changelog

> Timeline dei cambiamenti significativi del design system globale (regole, primitive UI, token).
> NON e' una cronologia commit. Solo decisioni che impattano la coerenza visiva trasversale.
>
> Riferimento regole: [`.claude/rules/design-system.md`](../.claude/rules/design-system.md)

---

## 2026-04-29 — Epic 81 Squircle Design System DONE

### Stories implementate

- **81-1** — Foundation: lib `figma-squircle`, `<Squircle>` component (escape hatch), Tailwind plugin `squirclePlugin`, CSS variables `--squircle-radius-*`, feature flag `VITE_SQUIRCLE_ENABLED`
- **81-2** — Card primarie: SpendibileHero, KpiCard, ScadenzeInline, MonthlyRevenueChart wrapper. Pattern wrapper Card primitive (`rounded-2xl` invariato)
- **81-3** — Identita': sidebar nav active + child + logo box (`squircle-md`). AvatarDropdown no-op (`rounded-full` legacy mantenuto)
- **81-4** — Interattivi: Button base cva, Tabs/Segmented control consumer (Calendario, TaskPage, ReportClienti) — `squircle-md` / `squircle-full`
- **81-5** — Overlay: Dialog, AlertDialog, BlockingModal (`sm:squircle-2xl`), Popover, Tooltip, DropdownMenuContent, Toast, Sonner (`squircle-md`). Sheet + Drawer Vaul invariati (consumer-driven)
- **81-6** — Form/feedback/banner: Input, Textarea, Select, PasswordInput, Command (`squircle-md`), banner inline (SogliaInline, FirstIncomeBanner, BenchmarkNudgeBanner, PricingSurveyNudge, InactiveSurveyBanner — `squircle-md`), alert sistema (OnboardingBanner `squircle-lg`, ExpiredRatesBanner `!squircle-lg` override Card), Progress (`squircle-full` alias). Checkbox/Radio/InputOTP/Calendar/Badge invariati per AC esplicite
- **81-7** — Validation, performance, a11y: bundle delta +0 CSS / +29B JS gzipped, vitest 4094 pass + 13 skipped (4107 totali), axe-core scan 18 page x viewport. Zero violations introdotte da squircle. Decisione Badge Opzione A confermata (`rounded-full`)
- **81-8** — Documentation: design-system.md v4 consolidato, `docs/squircle-system.md` created (guida tecnica developer), `docs/CHANGELOG-DESIGN.md` created (questo file)

### Decisione architetturale chiave

**Utility CSS-only attiva** su tutti i primitive UI. `<Squircle>` component disponibile come escape hatch (zero consumer attuali, dead code accettabile +29B JS gzipped per preservare escape hatch).

Razionale: a 8-24px `border-radius`, la differenza visiva tra `border-radius` CSS standard e clip-path superellisse "vero" e' indistinguibile a occhio nudo. Vantaggio: zero costo runtime, bundle impact minimo, compatibilita' totale (hover/focus/SSG/shadow/border).

### Bundle impact

- CSS gzipped: **+0 byte** (utility classes assorbite nel build Tailwind)
- JS gzipped: **+29 byte** (residuo dead code lib `figma-squircle`, accettabile per preservare escape hatch)

### Test coverage

88 test squircle in 6 file (17 + 16 + 10 + 19 + 11 + 15). Suite invariata baseline post-81-7: **4094 pass + 13 skipped / 4107 totali**.

### Tech debt flagged Epic 32 follow-up (NON squircle-introduced, pre-esistente)

- `button-name` critical 5 nodes — Landing page, Calcolatore
- ProBanner X close 16x16 hit-area ([`src/components/subscription/ProBanner.tsx:97`](../src/components/subscription/ProBanner.tsx))
- `html-has-lang` 15 nodes — prerender SSG
- `color-contrast` 10 nodes — pre-esistente
- `scrollable-region-focusable` 1 node — Blog post desktop

### Validation gap (demandato post-merge utente, NON blocking dev-story)

- Lighthouse score device fisico
- Device test fisico iOS Safari + Android Chrome
- Screen reader smoke (VoiceOver / TalkBack)
- README screenshot before/after

---

## 2026-04-29 — Story 81-8 DONE

design-system.md v4 consolidato (rimossi 5 commenti incrementali v3..v3.4 sparsi, nota unica header). Aggiunta sezione 13 "Squircle System — Quando e Come Applicarlo". Anti-pattern voce 17 (no mix `rounded-*` + `squircle-*` su stesso elemento). Sezione 2.2 con colonna Radius. `docs/squircle-system.md` created (11 sezioni: overview, tabella, implementazione tecnica, when component vs utility, pattern shadow + clip-path, pattern border + clip-path, mappa primitive, componenti N/A, test coverage, decisioni architetturali, riferimenti). `docs/CHANGELOG-DESIGN.md` created (questo file).

AC originali Epic 81 §81-8 marcati N/A con razionale:

- **#4 Storybook OR `/dev/squircle` admin demo gallery**: nessuno Storybook nel repo, no route admin demo. Costo setup > beneficio per gallery di 5 utility. Demandato a futuro Epic
- **#5 Snapshot test Vitest**: 88 test squircle gia' coprono varianti. Snapshot duplicherebbe assertion senza ROI

Story chiude **Epic 81 Squircle Design System**: in-progress → done.

---

<!-- Format guidance: per ogni voce nuova, usare header `## YYYY-MM-DD — Titolo`. Lasciare l'entry piu' recente in cima. -->
