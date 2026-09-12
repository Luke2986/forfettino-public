/**
 * Tests for Squircle integration on primary dashboard cards.
 * Epic 81 — Story 81-2: SpendibileHero, KpiCard, ScadenzeInline.
 *
 * Strategy:
 * - jsdom does not implement layout, so getBoundingClientRect returns 0x0
 *   by default. We mock it to return a non-zero rect so the Squircle hook
 *   produces a clipPath value (mirrors the pattern used in
 *   src/components/ui/__tests__/squircle.test.tsx).
 * - Inner Squircle is the FIRST element child of the outer wrapper —
 *   we assert clipPath inline style on it, plus the bg/style continuity.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpendibileHero } from "../SpendibileHero";
import { KpiCard, getKpiCardBackgroundStyle } from "../KpiCard";
import { ScadenzeInline } from "../ScadenzeInline";
import type { DeadlineInfo } from "@/hooks/useFiscalCalculations";

// Mock formatCurrency — jsdom Intl limitation
vi.mock("@/lib/money", async () => {
  const actual = await vi.importActual<typeof import("@/lib/money")>("@/lib/money");
  return {
    ...actual,
    formatCurrency: (v: number) => `€ ${v.toLocaleString("en-US")}`,
  };
});

// Mock react-router-dom for ScadenzeInline
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 320,
    height: 200,
    top: 0,
    left: 0,
    right: 320,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SpendibileHero — squircle wrapper", () => {
  it("inner Squircle has clip-path applied (feature flag default true)", () => {
    render(
      <SpendibileHero
        spendable={1000}
        sogliaIncassi={500}
        sogliaLimite={85000}
      />,
    );
    const outer = screen.getByTestId("spendibile-hero");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner).not.toBeNull();
    expect(inner.style.clipPath).toMatch(/^path\(/);
    // Squircle inline borderRadius fallback (Story 81-1 behavior)
    expect(inner.style.borderRadius).toBe("24px");
  });

  it("outer wrapper retains shadow + cursor + role/tabindex when interactive", () => {
    render(
      <SpendibileHero
        spendable={1000}
        sogliaIncassi={500}
        sogliaLimite={85000}
        breakdownContent={<div>details</div>}
      />,
    );
    const outer = screen.getByTestId("spendibile-hero");
    expect(outer.className).toMatch(/shadow-/);
    expect(outer.className).toMatch(/cursor-pointer/);
    expect(outer.getAttribute("role")).toBe("button");
    expect(outer.getAttribute("tabindex")).toBe("0");
  });

  it("non-interactive (no breakdownContent) drops role/tabindex/cursor", () => {
    render(
      <SpendibileHero
        spendable={1000}
        sogliaIncassi={500}
        sogliaLimite={85000}
      />,
    );
    const outer = screen.getByTestId("spendibile-hero");
    expect(outer.getAttribute("role")).toBeNull();
    expect(outer.getAttribute("tabindex")).toBeNull();
    expect(outer.className).not.toMatch(/cursor-pointer/);
  });
});

describe("KpiCard — squircle wrapper", () => {
  it("inner Squircle has clip-path applied", () => {
    render(
      <KpiCard
        label="Da accantonare"
        value="€ 2.000"
        accentColor="border-l-amber-400"
        valueColor="text-amber-700"
      />,
    );
    const outer = screen.getByTestId("kpi-Da accantonare");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner).not.toBeNull();
    expect(inner.style.clipPath).toMatch(/^path\(/);
  });

  it("outer wrapper retains ring shadow + role when interactive (breakdownContent)", () => {
    render(
      <KpiCard
        label="Entrate"
        value="€ 10.000"
        accentColor="border-l-blue-300"
        breakdownContent={<div>details</div>}
      />,
    );
    const outer = screen.getByTestId("kpi-Entrate");
    expect(outer.className).toMatch(/shadow-\[/);
    expect(outer.getAttribute("role")).toBe("button");
    expect(outer.getAttribute("tabindex")).toBe("0");
  });

  it("non-interactive KpiCard drops role/tabindex/cursor", () => {
    render(<KpiCard label="Entrate" value="€ 10.000" accentColor="border-l-blue-300" />);
    const outer = screen.getByTestId("kpi-Entrate");
    expect(outer.getAttribute("role")).toBeNull();
    expect(outer.getAttribute("tabindex")).toBeNull();
    expect(outer.className).not.toMatch(/cursor-pointer/);
  });
});

describe("KpiCard — getKpiCardBackgroundStyle (pure helper)", () => {
  // jsdom CSSOM rejects linear-gradient values silently → assert on the
  // returned style object directly (this is the value React passes to the
  // inner Squircle as the `style` prop).

  it("returns white background when accentColor is undefined", () => {
    const style = getKpiCardBackgroundStyle(undefined);
    expect(style.backgroundColor).toBe("white");
    expect(style.backgroundImage).toBeUndefined();
  });

  it("returns white background when accentColor is unknown", () => {
    const style = getKpiCardBackgroundStyle("border-l-unknown-key");
    expect(style.backgroundColor).toBe("white");
    expect(style.backgroundImage).toBeUndefined();
  });

  it("returns diagonal amber gradient + white for accentColor border-l-amber-400", () => {
    const style = getKpiCardBackgroundStyle("border-l-amber-400");
    expect(style.backgroundColor).toBe("white");
    expect(style.backgroundImage).toMatch(/linear-gradient\(to top right/);
    expect(style.backgroundImage).toMatch(/rgba\(251, 191, 36, 0\.30\)/);
    expect(style.backgroundImage).toMatch(/transparent 55%/);
  });

  it("returns diagonal blue gradient for accentColor border-l-blue-300", () => {
    const style = getKpiCardBackgroundStyle("border-l-blue-300");
    expect(style.backgroundImage).toMatch(/rgba\(147, 197, 253, 0\.30\)/);
  });

  it("returns diagonal violet gradient for accentColor border-l-violet-400", () => {
    const style = getKpiCardBackgroundStyle("border-l-violet-400");
    expect(style.backgroundImage).toMatch(/rgba\(167, 139, 250, 0\.30\)/);
  });
});

describe("ScadenzeInline — squircle wrapper preserves border", () => {
  function makeDeadline(overrides: Partial<DeadlineInfo> = {}): DeadlineInfo {
    return {
      id: "dl-1",
      bucket: "saldo_tax",
      paymentYear: 2026,
      dueDate: "2026-06-30",
      totalExpected: 3480,
      totalPaid: 0,
      remaining: 3480,
      ...overrides,
    };
  }

  it("renders empty state with squircle inner + bg-stone-50", () => {
    render(<ScadenzeInline deadlines={[]} />);
    const outer = screen.getByTestId("scadenze-inline");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner).not.toBeNull();
    expect(inner.style.clipPath).toMatch(/^path\(/);
    expect(inner.className).toMatch(/bg-stone-50/);
    // Outer keeps CSS border classico (not clipped because lives on outer rounded)
    expect(outer.className).toMatch(/border-stone-200\/40/);
  });

  it("renders 3 deadlines with squircle inner + preserved row testids", () => {
    const deadlines = [
      makeDeadline({ id: "dl-1" }),
      makeDeadline({ id: "dl-2", bucket: "acconto_tax_1" }),
      makeDeadline({ id: "dl-3", bucket: "acconto_tax_2" }),
    ];
    render(<ScadenzeInline deadlines={deadlines} />);
    const outer = screen.getByTestId("scadenze-inline");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.style.clipPath).toMatch(/^path\(/);
    expect(screen.getAllByTestId("scadenza-row")).toHaveLength(3);
  });
});

describe("Squircle feature flag disabled — fallback to border-radius", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("SpendibileHero inner falls back to border-radius (no clipPath)", async () => {
    vi.stubEnv("VITE_SQUIRCLE_ENABLED", "false");
    vi.resetModules();
    const { SpendibileHero: Disabled } = await import("../SpendibileHero");
    render(
      <Disabled
        spendable={1000}
        sogliaIncassi={500}
        sogliaLimite={85000}
      />,
    );
    const outer = screen.getByTestId("spendibile-hero");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.style.clipPath).toBe("");
    expect(inner.style.borderRadius).toBe("24px");
  });

  it("KpiCard inner falls back to border-radius (no clipPath)", async () => {
    vi.stubEnv("VITE_SQUIRCLE_ENABLED", "false");
    vi.resetModules();
    const { KpiCard: Disabled } = await import("../KpiCard");
    render(
      <Disabled
        label="Entrate"
        value="€ 10.000"
        accentColor="border-l-blue-300"
      />,
    );
    const outer = screen.getByTestId("kpi-Entrate");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.style.clipPath).toBe("");
    expect(inner.style.borderRadius).toBe("16px");
  });

  it("ScadenzeInline inner falls back to border-radius (no clipPath)", async () => {
    vi.stubEnv("VITE_SQUIRCLE_ENABLED", "false");
    vi.resetModules();
    const { ScadenzeInline: Disabled } = await import("../ScadenzeInline");
    render(<Disabled deadlines={[]} />);
    const outer = screen.getByTestId("scadenze-inline");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.style.clipPath).toBe("");
    expect(inner.style.borderRadius).toBe("16px");
  });
});
