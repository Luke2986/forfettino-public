/**
 * Tests for SpendibileHero — primary dashboard hero card
 *
 * Epic 13 — Dashboard Redesign 3-Zone Layout
 * Tests rendering, soglia gauge, sheet breakdown, and highlight animation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpendibileHero } from "./SpendibileHero";

// Mock formatCurrency — jsdom doesn't support Intl.NumberFormat("it-IT") fully
vi.mock("@/lib/money", () => ({
  formatCurrency: (v: number) => `€ ${v.toLocaleString("en-US")}`,
}));

const defaultProps = {
  spendable: 6296.54,
  sogliaIncassi: 10000,
  sogliaLimite: 85000,
  breakdownContent: <div data-testid="breakdown-content">Breakdown</div>,
  helpText: "Quanto puoi spendere oggi",
};

describe("SpendibileHero — rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders with test id", () => {
    render(<SpendibileHero {...defaultProps} />);
    expect(screen.getByTestId("spendibile-hero")).toBeDefined();
  });

  it("shows 'Netto Spendibile' label", () => {
    render(<SpendibileHero {...defaultProps} />);
    expect(screen.getByText("Netto Spendibile")).toBeDefined();
  });

  it("displays the formatted spendable amount", () => {
    render(<SpendibileHero {...defaultProps} />);
    expect(screen.getByText(/6,296/)).toBeDefined();
  });

  it("shows the 'Dettagli' link when breakdown exists", () => {
    render(<SpendibileHero {...defaultProps} />);
    expect(screen.getByText("Dettagli")).toBeDefined();
  });

  it("hides 'Dettagli' link when no breakdown", () => {
    render(<SpendibileHero {...defaultProps} breakdownContent={undefined} />);
    expect(screen.queryByText("Dettagli")).toBeNull();
  });
});

describe("SpendibileHero — soglia 85k gauge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows soglia percentage", () => {
    render(<SpendibileHero {...defaultProps} />);
    // 10000/85000 = ~12%
    expect(screen.getByText(/12% di 85k/)).toBeDefined();
  });

  it("shows '85k superato' when incassi exceed limit", () => {
    render(<SpendibileHero {...defaultProps} sogliaIncassi={90000} />);
    expect(screen.getByText("85k superato")).toBeDefined();
  });

  it("renders the progress bar", () => {
    render(<SpendibileHero {...defaultProps} />);
    expect(screen.getByTestId("soglia-bar")).toBeDefined();
  });
});

describe("SpendibileHero — sheet breakdown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens sheet on click", () => {
    render(<SpendibileHero {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spendibile-hero"));
    expect(screen.getByText("Breakdown")).toBeDefined();
  });

  it("opens sheet on Enter key", () => {
    render(<SpendibileHero {...defaultProps} />);
    fireEvent.keyDown(screen.getByTestId("spendibile-hero"), { key: "Enter" });
    expect(screen.getByText("Breakdown")).toBeDefined();
  });

  it("opens sheet on Space key", () => {
    render(<SpendibileHero {...defaultProps} />);
    fireEvent.keyDown(screen.getByTestId("spendibile-hero"), { key: " " });
    expect(screen.getByText("Breakdown")).toBeDefined();
  });
});

describe("SpendibileHero — highlight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies highlight ring class when shouldHighlight is true", () => {
    render(<SpendibileHero {...defaultProps} shouldHighlight />);
    const card = screen.getByTestId("spendibile-hero");
    // ring-teal-400 is the highlight-specific ring (distinct from focus-visible:ring-2 which is always present)
    expect(card.className).toMatch(/ring-teal-400/);
    expect(card.className).toMatch(/motion-safe:animate-pulse/);
  });

  it("does not apply highlight ring by default", () => {
    render(<SpendibileHero {...defaultProps} />);
    const card = screen.getByTestId("spendibile-hero");
    // ring-teal-400 is the highlight ring; focus-visible:ring-2 is the accessibility ring (always present)
    expect(card.className).not.toMatch(/ring-teal-400/);
    expect(card.className).not.toMatch(/motion-safe:animate-pulse/);
  });
});

describe("SpendibileHero — accessibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has button role on the hero card", () => {
    render(<SpendibileHero {...defaultProps} />);
    const hero = screen.getByTestId("spendibile-hero");
    expect(hero.getAttribute("role")).toBe("button");
    expect(hero.getAttribute("tabindex")).toBe("0");
  });

  it("has info icon hidden from a11y tree (nested-interactive fix)", () => {
    render(<SpendibileHero {...defaultProps} />);
    // Info tooltip trigger is aria-hidden to avoid nested-interactive violation
    // (card has role="button" so children must not be focusable)
    const infoSpan = document.querySelector('[aria-hidden="true"] .lucide-info') ??
      document.querySelector('.lucide-info');
    expect(infoSpan).toBeDefined();
  });
});
