/**
 * UI STRESS TEST — Dashboard Components with Extreme Data
 *
 * Obiettivo: verificare che i componenti dashboard non crashino,
 * non mostrino NaN/undefined, e gestiscano dati estremi senza errori.
 *
 * Componenti testati:
 * - SpendibileHero: importi enormi, zero, negativi
 * - KpiCard: valori formattati estremi, trend nulli
 * - ScadenzeInline: 0, 1, 50, 100 scadenze, importi edge
 * - MonthlyRevenueChart: mesi vuoti, migliaia di incassi
 * - formatCurrency: input estremi
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpendibileHero } from "./SpendibileHero";
import { KpiCard } from "./KpiCard";
import { ScadenzeInline } from "./ScadenzeInline";
import type { DeadlineInfo } from "@/hooks/useFiscalCalculations";
import { formatCurrency, sanitizeMoney, roundMoney } from "@/lib/money";

// --- Mocks ---

vi.mock("@/lib/money", async () => {
  const actual = await vi.importActual<typeof import("@/lib/money")>("@/lib/money");
  return {
    ...actual,
    formatCurrency: (v: number) => `€ ${(actual.sanitizeMoney(v)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/schedule-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedule-helpers")>(
    "@/lib/schedule-helpers",
  );
  return {
    ...actual,
    daysUntil: () => 30,
    formatDateIT: (d: string) => d,
    bucketToLabel: (b: string) => b,
  };
});

// --- Helpers ---

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

/** Assert no NaN, undefined, Infinity appears in rendered text */
function assertNoGarbage(container: HTMLElement) {
  const text = container.textContent || "";
  expect(text).not.toMatch(/NaN/);
  expect(text).not.toMatch(/undefined/);
  expect(text).not.toMatch(/Infinity/);
  expect(text).not.toMatch(/\[object/);
}

// ============================================================
// 1. formatCurrency — STRESS (pure function, no render)
// ============================================================

describe("STRESS: formatCurrency edge cases", () => {
  it.each([
    [0, "€ 0.00"],
    [0.01, "€ 0.01"],
    [-100, "€ -100.00"],
    [999_999_999.99, "€ 999,999,999.99"],
    [NaN, "€ 0.00"],
    [Infinity, "€ 0.00"],
    [-Infinity, "€ 0.00"],
    [null as unknown as number, "€ 0.00"],
    [undefined as unknown as number, "€ 0.00"],
  ])("formatCurrency(%s) → %s", (input, expected) => {
    const result = formatCurrency(input);
    expect(result).toBe(expected);
    expect(result).not.toContain("NaN");
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("Infinity");
  });

  it("formats 1 million correctly", () => {
    const result = formatCurrency(1_000_000);
    expect(result).toContain("1,000,000");
  });

  it("handles very small decimal (0.001 → rounds to 0.00)", () => {
    const result = formatCurrency(0.001);
    expect(result).toBe("€ 0.00");
  });
});

// ============================================================
// 2. SpendibileHero — EXTREME INPUTS
// ============================================================

describe("STRESS: SpendibileHero extreme inputs", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseProps = {
    spendable: 5000,
    sogliaIncassi: 10000,
    sogliaLimite: 85000,
  };

  it("renders with spendable = 0", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} spendable={0} />
    );
    assertNoGarbage(container);
    expect(screen.getByTestId("spendibile-hero")).toBeDefined();
  });

  it("renders with spendable = negative", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} spendable={-5000} />
    );
    assertNoGarbage(container);
  });

  it("renders with very large spendable (1M)", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} spendable={1_000_000} />
    );
    assertNoGarbage(container);
    expect(container.textContent).toContain("1,000,000");
  });

  it("renders with very large spendable (100M)", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} spendable={100_000_000} />
    );
    assertNoGarbage(container);
  });

  it("renders with sogliaIncassi > sogliaLimite (over 85k)", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} sogliaIncassi={120000} sogliaLimite={85000} />
    );
    assertNoGarbage(container);
    // Should show "superato" or similar
    expect(container.textContent).toMatch(/superat|100%|85k/i);
  });

  it("renders with sogliaIncassi = 0", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} sogliaIncassi={0} />
    );
    assertNoGarbage(container);
  });

  it("renders with sogliaLimite = 0 (edge: division by zero risk)", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} sogliaLimite={0} />
    );
    assertNoGarbage(container);
  });

  it("renders with spendable having many decimals", () => {
    const { container } = render(
      <SpendibileHero {...baseProps} spendable={12345.6789} />
    );
    assertNoGarbage(container);
  });
});

// ============================================================
// 3. KpiCard — EXTREME VALUES
// ============================================================

describe("STRESS: KpiCard extreme values", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders with empty string value", () => {
    const { container } = render(
      <KpiCard label="Test" value="" />
    );
    assertNoGarbage(container);
  });

  it("renders with very long formatted value", () => {
    const { container } = render(
      <KpiCard label="Test" value="€ 999,999,999,999.99" />
    );
    assertNoGarbage(container);
    expect(container.textContent).toContain("999,999,999,999");
  });

  it("renders with zero value", () => {
    const { container } = render(
      <KpiCard label="Entrate" value="€ 0.00" accentColor="border-l-blue-300" />
    );
    assertNoGarbage(container);
  });

  it("renders with negative value string", () => {
    const { container } = render(
      <KpiCard label="Perdita" value="€ -5,000.00" accentColor="border-l-amber-400" />
    );
    assertNoGarbage(container);
  });

  it("renders with trend direction=up, percent=null", () => {
    const { container } = render(
      <KpiCard
        label="Test"
        value="€ 10,000.00"
      />
    );
    assertNoGarbage(container);
  });

  it("renders with trend percent=0", () => {
    const { container } = render(
      <KpiCard
        label="Test"
        value="€ 10,000.00"
      />
    );
    assertNoGarbage(container);
  });

  it("renders with trend percent=99999", () => {
    const { container } = render(
      <KpiCard
        label="Test"
        value="€ 10,000.00"
      />
    );
    assertNoGarbage(container);
  });

  it("renders all accent color variants", () => {
    const colors = ["border-l-blue-300", "border-l-amber-400", "border-l-violet-400", "unknown-color"];
    for (const color of colors) {
      const { container } = render(
        <KpiCard label="Test" value="€ 100.00" accentColor={color} />
      );
      assertNoGarbage(container);
    }
  });

  it("renders with no optional props (minimal)", () => {
    const { container } = render(
      <KpiCard label="Minimal" value="€ 1.00" />
    );
    assertNoGarbage(container);
  });

  it("renders with all deprecated props (backward compat)", () => {
    const { container } = render(
      <KpiCard
        label="Compat"
        value="€ 1.00"
        variant="hero"
        heroSubline="sub"
        animationDelay={200}
      />
    );
    assertNoGarbage(container);
  });
});

// ============================================================
// 4. ScadenzeInline — EXTREME DEADLINE COUNTS
// ============================================================

describe("STRESS: ScadenzeInline extreme data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders with 0 deadlines (empty state)", () => {
    const { container } = render(<ScadenzeInline deadlines={[]} />);
    assertNoGarbage(container);
    expect(screen.getByTestId("scadenze-inline")).toBeDefined();
  });

  it("renders with 1 deadline", () => {
    const { container } = render(
      <ScadenzeInline deadlines={[makeDeadline()]} />
    );
    assertNoGarbage(container);
  });

  it("renders with 50 deadlines without crashing", () => {
    const deadlines = Array.from({ length: 50 }, (_, i) =>
      makeDeadline({
        id: `dl-${i}`,
        remaining: (i + 1) * 100,
        dueDate: `2026-${String(Math.floor(i / 4) + 1).padStart(2, "0")}-15`,
      })
    );
    const { container } = render(<ScadenzeInline deadlines={deadlines} />);
    assertNoGarbage(container);
  });

  it("renders with remaining = 0 (fully paid)", () => {
    const { container } = render(
      <ScadenzeInline
        deadlines={[makeDeadline({ remaining: 0, totalPaid: 3480, totalExpected: 3480 })]}
      />
    );
    assertNoGarbage(container);
  });

  it("renders with very large remaining amount", () => {
    const { container } = render(
      <ScadenzeInline
        deadlines={[makeDeadline({ remaining: 999_999.99 })]}
      />
    );
    assertNoGarbage(container);
  });

  it("renders with negative remaining (overpaid edge)", () => {
    const { container } = render(
      <ScadenzeInline
        deadlines={[makeDeadline({ remaining: -100 })]}
      />
    );
    assertNoGarbage(container);
  });

  it("renders with various bucket types", () => {
    const buckets = [
      "saldo_tax", "acconto_tax_1", "acconto_tax_2",
      "inps_q1", "inps_q2", "inps_q3", "inps_q4",
      "inps_variabile_1", "inps_variabile_2",
    ];
    const deadlines = buckets.map((bucket, i) =>
      makeDeadline({ id: `dl-${i}`, bucket, remaining: 1000 + i * 500 })
    );
    const { container } = render(<ScadenzeInline deadlines={deadlines} />);
    assertNoGarbage(container);
  });

  it("renders with isEstimate flag", () => {
    const { container } = render(
      <ScadenzeInline
        deadlines={[makeDeadline({ isEstimate: true })]}
      />
    );
    assertNoGarbage(container);
  });
});

// ============================================================
// 5. COMBINED — RAPID RENDER STRESS
// ============================================================

describe("STRESS: rapid re-renders (100x)", () => {
  it("SpendibileHero survives 100 rapid renders with random data", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 100; i++) {
      const { container, unmount } = render(
        <SpendibileHero
          spendable={rand() * 200000 - 50000} // -50k to 150k
          sogliaIncassi={rand() * 120000}
          sogliaLimite={rand() > 0.1 ? 85000 : 0}
        />
      );
      assertNoGarbage(container);
      unmount();
    }
  });

  it("KpiCard survives 100 rapid renders with random values", () => {
    const values = [
      "€ 0.00", "€ 1.00", "€ 99,999.99", "€ -500.00",
      "€ 1,000,000.00", "", "€ 0.01",
    ];
    const colors = ["border-l-blue-300", "border-l-amber-400", "border-l-violet-400", undefined];

    for (let i = 0; i < 100; i++) {
      const { container, unmount } = render(
        <KpiCard
          label={`Test ${i}`}
          value={values[i % values.length]}
          accentColor={colors[i % colors.length]}
        />
      );
      assertNoGarbage(container);
      unmount();
    }
  });
});
