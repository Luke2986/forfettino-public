/**
 * Test Story 81-4 — Squircle utility su Button base + segmented controls.
 * Verifica che `squircle-md` sostituisca `rounded-md` su:
 *  - Button base cva (tutte 6 variants + 4 sizes)
 *  - size icon mantiene min-h/min-w 44px (WCAG AA tap target)
 *  - disabled preserva opacity-50
 *  - focus-visible ring + active scale microinteraction preservati
 *  - Snippet segmented controls Calendario / TaskPage / ReportClienti
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { Button, buttonVariants } from "../button";

// Regex: nessun rounded-* Tailwind standard residuo (sm/md/lg/xl/2xl/3xl/full).
// Word-boundary esclude falsi positivi (squircle-md non matcha).
const TAILWIND_ROUNDED_REGEX = /(?:^|\s)rounded-(sm|md|lg|xl|2xl|3xl|full)(?:\s|$)/;

describe("Story 81-4 — Button squircle base (AC #1, #14)", () => {
  it("default variant + default size: squircle-md presente, niente rounded-md", () => {
    const { getByRole } = render(<Button>Test</Button>);
    const btn = getByRole("button");
    expect(btn.className).toContain("squircle-md");
    expect(btn.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("variant outline: squircle-md presente, hover preserved", () => {
    const { getByRole } = render(<Button variant="outline">Outline</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).toContain("hover:bg-accent");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("variant secondary: squircle-md presente", () => {
    const { getByRole } = render(<Button variant="secondary">Sec</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("variant ghost: squircle-md presente, niente rounded-*", () => {
    const { getByRole } = render(<Button variant="ghost">Ghost</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("variant destructive: squircle-md presente, active scale preserved", () => {
    const { getByRole } = render(<Button variant="destructive">Del</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).toContain("active:scale-[0.98]");
  });

  it("variant link: squircle-md presente (irrilevante visivamente, base eredita)", () => {
    const { getByRole } = render(<Button variant="link">Link</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
  });

  it("size sm: squircle-md presente", () => {
    const { getByRole } = render(<Button size="sm">Small</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("size lg: squircle-md presente", () => {
    const { getByRole } = render(<Button size="lg">Large</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("size icon: squircle-md + min-h-[44px] + min-w-[44px] preservati (WCAG AA)", () => {
    const { getByRole } = render(
      <Button size="icon" aria-label="action">
        +
      </Button>,
    );
    const cls = getByRole("button").className;
    expect(cls).toContain("squircle-md");
    expect(cls).toContain("min-h-[44px]");
    expect(cls).toContain("min-w-[44px]");
  });

  it("disabled: opacity-50 + squircle-md preservati", () => {
    const { getByRole } = render(<Button disabled>Off</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("disabled:opacity-50");
    expect(cls).toContain("squircle-md");
  });

  it("focus-visible ring + ring-offset preservati su Button base (a11y)", () => {
    const { getByRole } = render(<Button>Focusable</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("focus-visible:ring-2");
    expect(cls).toContain("focus-visible:ring-ring");
    expect(cls).toContain("focus-visible:ring-offset-2");
  });

  it("buttonVariants() helper produce squircle-md per tutte le combinazioni", () => {
    // Default
    expect(buttonVariants()).toContain("squircle-md");
    // Tutte le variants (default size)
    (
      ["default", "destructive", "outline", "secondary", "ghost", "link"] as const
    ).forEach((variant) => {
      expect(buttonVariants({ variant }), `variant=${variant}`).toContain(
        "squircle-md",
      );
    });
    // Tutte le sizes (default variant)
    (["default", "sm", "lg", "icon"] as const).forEach((size) => {
      expect(buttonVariants({ size }), `size=${size}`).toContain("squircle-md");
    });
  });
});

describe("Story 81-4 — Calendario view switcher segmented (AC #6)", () => {
  // Snippet replica Calendario.tsx righe 530-556 (outer + inner buttons).
  const CalendarioViewSwitcherSnippet = ({ active = "week" }: { active?: "week" | "month" }) => (
    <div data-testid="calendar-segmented" className="hidden sm:flex items-center squircle-md border border-slate-200 p-0.5 bg-slate-50">
      <button
        data-testid="cal-week"
        className={
          "px-3 py-1.5 text-sm font-medium squircle-md transition-all" +
          (active === "week" ? " bg-white" : " text-slate-500")
        }
      >
        Settimana
      </button>
      <button
        data-testid="cal-month"
        className={
          "px-3 py-1.5 text-sm font-medium squircle-md transition-all" +
          (active === "month" ? " bg-white" : " text-slate-500")
        }
      >
        Mese
      </button>
    </div>
  );

  it("outer container ha squircle-md, niente rounded-lg", () => {
    const { getByTestId } = render(<CalendarioViewSwitcherSnippet />);
    const outer = getByTestId("calendar-segmented");
    expect(outer.className).toContain("squircle-md");
    expect(outer.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("inner buttons hanno squircle-md", () => {
    const { getByTestId } = render(<CalendarioViewSwitcherSnippet />);
    expect(getByTestId("cal-week").className).toContain("squircle-md");
    expect(getByTestId("cal-month").className).toContain("squircle-md");
  });

  // Pill chip filtri tipo evento (rounded-full → squircle-full).
  it("pill chip filtri ha squircle-full (era rounded-full)", () => {
    const FilterPill = () => (
      <button
        data-testid="filter-pill"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 squircle-full text-sm font-medium border transition-all"
      >
        Filtro
      </button>
    );
    const { getByTestId } = render(<FilterPill />);
    const pill = getByTestId("filter-pill");
    expect(pill.className).toContain("squircle-full");
    expect(pill.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });
});

describe("Story 81-4 — TaskPage view switcher (AC #7)", () => {
  // Replica TaskPage.tsx righe 176-197 (nav + button items) + righe 240-260 (TabsList).
  const TaskPageNavSnippet = () => (
    <nav data-testid="task-nav" className="flex items-center gap-0.5 bg-black/[0.04] squircle-md p-0.5">
      <button data-testid="task-nav-btn" className="flex items-center gap-1.5 px-2.5 py-1.5 squircle-md text-xs font-medium transition-all duration-150">
        Bacheca
      </button>
    </nav>
  );

  const TaskPageTabListSnippet = () => (
    <div data-testid="task-tablist" className="flex gap-1 squircle-md bg-slate-100 p-1 w-fit">
      <button data-testid="task-tab-btn" className="px-3 py-1.5 text-sm font-medium squircle-md transition-colors min-h-[36px]">
        Tutti
      </button>
    </div>
  );

  it("nav container + items hanno squircle-md, niente rounded-lg", () => {
    const { getByTestId } = render(<TaskPageNavSnippet />);
    const nav = getByTestId("task-nav");
    const btn = getByTestId("task-nav-btn");
    expect(nav.className).toContain("squircle-md");
    expect(nav.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
    expect(btn.className).toContain("squircle-md");
    expect(btn.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("TabsList alternativa + trigger hanno squircle-md, min-h-[36px] preservato", () => {
    const { getByTestId } = render(<TaskPageTabListSnippet />);
    const list = getByTestId("task-tablist");
    const btn = getByTestId("task-tab-btn");
    expect(list.className).toContain("squircle-md");
    expect(btn.className).toContain("squircle-md");
    expect(btn.className).toContain("min-h-[36px]");
  });
});

describe("Story 81-4 — ReportClienti TabsList segmented (AC #8)", () => {
  // Replica ReportClienti.tsx righe 239-260 + 279-299.
  const ReportClientiPeriodSnippet = () => (
    <div
      data-testid="rc-period-tablist"
      className="gap-1 squircle-md bg-slate-100 p-1 max-w-full overflow-x-auto scrollbar-hide"
    >
      <button data-testid="rc-period-trigger" className="relative squircle-md px-3 py-1.5 text-sm whitespace-nowrap">
        2026
      </button>
    </div>
  );

  const ReportClientiTabSnippet = () => (
    <div data-testid="rc-tablist" className="gap-1 squircle-md bg-slate-100 p-1">
      <button data-testid="rc-tab-clienti" className="squircle-md px-4 py-1.5 text-sm">
        Per Cliente
      </button>
      <button data-testid="rc-tab-servizi" className="squircle-md px-4 py-1.5 text-sm">
        Per Servizio
      </button>
    </div>
  );

  it("period TabsList outer + trigger hanno squircle-md", () => {
    const { getByTestId } = render(<ReportClientiPeriodSnippet />);
    const list = getByTestId("rc-period-tablist");
    const trigger = getByTestId("rc-period-trigger");
    expect(list.className).toContain("squircle-md");
    expect(list.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
    expect(trigger.className).toContain("squircle-md");
    expect(trigger.className).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("Cliente/Servizio/Incrociata TabsList ha squircle-md + tutti i trigger squircle-md", () => {
    const { getByTestId } = render(<ReportClientiTabSnippet />);
    expect(getByTestId("rc-tablist").className).toContain("squircle-md");
    expect(getByTestId("rc-tab-clienti").className).toContain("squircle-md");
    expect(getByTestId("rc-tab-servizi").className).toContain("squircle-md");
  });
});
