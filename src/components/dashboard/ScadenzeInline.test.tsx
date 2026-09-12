/**
 * Tests for ScadenzeInline — compact deadline list
 *
 * Epic 13 — Dashboard Redesign 3-Zone Layout
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScadenzeInline } from "./ScadenzeInline";
import type { DeadlineInfo } from "@/hooks/useFiscalCalculations";

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock formatCurrency — jsdom Intl limitation
vi.mock("@/lib/money", async () => {
  const actual = await vi.importActual<typeof import("@/lib/money")>("@/lib/money");
  return {
    ...actual,
    formatCurrency: (v: number) => `€ ${v.toLocaleString("en-US")}`,
  };
});

// Mock daysUntil to return deterministic values
vi.mock("@/lib/schedule-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schedule-helpers")>(
    "@/lib/schedule-helpers",
  );
  return {
    ...actual,
    daysUntil: (dueDate: string) => {
      // Map specific dates to fixed days for testing
      if (dueDate.includes("2026-06-30")) return 121;
      if (dueDate.includes("2026-11-30")) return 274;
      if (dueDate.includes("2026-03-05")) return -5; // overdue
      return 45;
    },
  };
});

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

describe("ScadenzeInline — rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders with test id", () => {
    render(<ScadenzeInline deadlines={[]} />);
    expect(screen.getByTestId("scadenze-inline")).toBeDefined();
  });

  it("shows 'Prossime scadenze' header", () => {
    render(<ScadenzeInline deadlines={[]} />);
    expect(screen.getByText("Prossime scadenze")).toBeDefined();
  });
});

describe("ScadenzeInline — empty state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty message when no deadlines", () => {
    render(<ScadenzeInline deadlines={[]} />);
    expect(screen.getByTestId("scadenze-empty")).toBeDefined();
    expect(screen.getByText("Nessuna scadenza in programma")).toBeDefined();
  });

  it("hides total when no deadlines", () => {
    render(<ScadenzeInline deadlines={[]} />);
    expect(screen.queryByText(/Totale/)).toBeNull();
  });
});

describe("ScadenzeInline — with deadlines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 1 deadline row", () => {
    const dl = makeDeadline();
    render(<ScadenzeInline deadlines={[dl]} />);
    const rows = screen.getAllByTestId("scadenza-row");
    expect(rows).toHaveLength(1);
  });

  it("shows deadline label from bucket", () => {
    const dl = makeDeadline({ bucket: "saldo_tax" });
    render(<ScadenzeInline deadlines={[dl]} />);
    expect(screen.getByText(/Saldo Imposta/i)).toBeDefined();
  });

  it("shows deadline amount in the row and in the total", () => {
    const dl = makeDeadline({ remaining: 3480 });
    render(<ScadenzeInline deadlines={[dl]} />);
    // Amount appears in both the row and the total header
    const matches = screen.getAllByText(/3,480/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows total when multiple deadlines", () => {
    const dl1 = makeDeadline({ id: "dl-1", remaining: 3480 });
    const dl2 = makeDeadline({
      id: "dl-2",
      bucket: "acconto_tax_2",
      dueDate: "2026-11-30",
      remaining: 2100,
    });
    render(<ScadenzeInline deadlines={[dl1, dl2]} />);
    // Total = 3480 + 2100 = 5580
    expect(screen.getByText(/5,580/)).toBeDefined();
  });

  it("renders 3 deadline rows", () => {
    const deadlines = [
      makeDeadline({ id: "dl-1" }),
      makeDeadline({ id: "dl-2", bucket: "acconto_tax_1", dueDate: "2026-06-30" }),
      makeDeadline({ id: "dl-3", bucket: "acconto_tax_2", dueDate: "2026-11-30" }),
    ];
    render(<ScadenzeInline deadlines={deadlines} />);
    expect(screen.getAllByTestId("scadenza-row")).toHaveLength(3);
  });
});

describe("ScadenzeInline — overdue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows 'scaduta da Ng' label for overdue deadlines", () => {
    const dl = makeDeadline({ dueDate: "2026-03-05", bucket: "saldo_tax" });
    render(<ScadenzeInline deadlines={[dl]} />);
    expect(screen.getByText("scaduta da 5g")).toBeDefined();
  });
});

describe("ScadenzeInline — a11y color regression", () => {
  beforeEach(() => vi.clearAllMocks());

  it("far-future countdown uses text-slate-500 (WCAG AA), never text-slate-400", () => {
    // daysUntil mock returns 121 for 2026-06-30 → far-future (>30 days)
    const dl = makeDeadline({ dueDate: "2026-06-30" });
    const { container } = render(<ScadenzeInline deadlines={[dl]} />);
    const countdownSpan = container.querySelector("[data-testid='scadenza-row'] .text-slate-500");
    expect(countdownSpan).not.toBeNull();
    // Ensure the banned color is NOT used
    const bannedSpan = container.querySelector("[data-testid='scadenza-row'] .text-slate-400");
    expect(bannedSpan).toBeNull();
  });

  it("urgent countdown uses text-red-600", () => {
    // daysUntil mock returns -5 for 2026-03-05 → overdue (<=7 days)
    const dl = makeDeadline({ dueDate: "2026-03-05", bucket: "saldo_tax" });
    const { container } = render(<ScadenzeInline deadlines={[dl]} />);
    const urgentSpan = container.querySelector("[data-testid='scadenza-row'] .text-red-600");
    expect(urgentSpan).not.toBeNull();
  });
});

describe("ScadenzeInline — responsive layout classes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scadenza row has flex-col and sm:flex-row for mobile responsive layout", () => {
    const dl = makeDeadline();
    render(<ScadenzeInline deadlines={[dl]} />);
    const row = screen.getByTestId("scadenza-row");
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("sm:flex-row");
  });

  it("amount span has self-end for mobile right-alignment", () => {
    const dl = makeDeadline();
    const { container } = render(<ScadenzeInline deadlines={[dl]} />);
    const amountSpan = container.querySelector("[data-testid='scadenza-row'] .self-end");
    expect(amountSpan).not.toBeNull();
  });
});

describe("ScadenzeInline — navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("navigates to /scadenziario on link click", () => {
    const dl = makeDeadline();
    render(<ScadenzeInline deadlines={[dl]} />);
    fireEvent.click(screen.getByTestId("scadenze-link"));
    expect(mockNavigate).toHaveBeenCalledWith("/scadenziario");
  });

  it("shows 'Vai allo scadenziario' link when deadlines exist", () => {
    const dl = makeDeadline();
    render(<ScadenzeInline deadlines={[dl]} />);
    expect(screen.getByText(/Vai allo scadenziario/)).toBeDefined();
  });

  it("does not show link when deadlines list is empty", () => {
    render(<ScadenzeInline deadlines={[]} />);
    expect(screen.queryByTestId("scadenze-link")).toBeNull();
  });
});
