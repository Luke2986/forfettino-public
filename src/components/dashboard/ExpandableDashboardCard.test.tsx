import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpandableDashboardCard } from "./ExpandableDashboardCard";
import { Wallet } from "lucide-react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

const defaultProps = {
  title: "Spendibile oggi",
  value: "€ 1.234,00",
  description: "Disponibilità attuale stimata",
  icon: Wallet,
  breakdownContent: <div data-testid="breakdown">Dettaglio calcolo</div>,
};

describe("ExpandableDashboardCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  // ── 1. Render base ──
  it("renders title, value, and description", () => {
    render(<ExpandableDashboardCard {...defaultProps} />);

    expect(screen.getByText("Spendibile oggi")).toBeInTheDocument();
    expect(screen.getByText("€ 1.234,00")).toBeInTheDocument();
    expect(screen.getByText("Disponibilità attuale stimata")).toBeInTheDocument();
  });

  // ── 2. isHero styling (border-l-primary rimosso per design system 2026-04 — gradiente diagonale) ──
  it("applies shadow-elevated and bg-primary tint when isHero", () => {
    const { container } = render(
      <ExpandableDashboardCard {...defaultProps} isHero />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("shadow-elevated");
    expect(card.className).toContain("bg-primary/[0.02]");
  });

  // ── 3. font-display hero ──
  it("applies font-display to value when isHero", () => {
    render(<ExpandableDashboardCard {...defaultProps} isHero />);

    const valueEl = screen.getByText("€ 1.234,00");
    expect(valueEl.className).toContain("font-display");
    expect(valueEl.className).toContain("text-2xl");
  });

  // ── 4. tabular-nums always present ──
  it("applies tabular-nums to value for all cards", () => {
    render(<ExpandableDashboardCard {...defaultProps} />);

    const valueEl = screen.getByText("€ 1.234,00");
    expect(valueEl.className).toContain("tabular-nums");
  });

  // ── 5. accentBorder: prop mantenuta per backward-compat ma IGNORATA (design system 2026-04) ──
  it("ignora la prop accentBorder (deprecata, nessun border-l applicato)", () => {
    const { container } = render(
      <ExpandableDashboardCard
        {...defaultProps}
        accentBorder="border-l-amber-500"
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("border-l-[3px]");
    expect(card.className).not.toContain("border-l-amber-500");
  });

  // ── 6. accentBorder ignorata anche in isHero ──
  it("ignora accentBorder anche in modalita' isHero", () => {
    const { container } = render(
      <ExpandableDashboardCard
        {...defaultProps}
        isHero
        accentBorder="border-l-amber-500"
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("border-l-amber-500");
  });

  // ── 7. cursor-pointer always ──
  it("has cursor-pointer on all cards", () => {
    const { container } = render(
      <ExpandableDashboardCard {...defaultProps} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("cursor-pointer");
    expect(card.className).not.toContain("cursor-default");
  });

  // ── 8. expand/collapse ──
  it("toggles breakdown visibility on click", () => {
    const { container } = render(
      <ExpandableDashboardCard {...defaultProps} />
    );

    // Initially collapsed
    expect(screen.queryByTestId("breakdown")).toBeInTheDocument();
    const card = container.firstChild as HTMLElement;

    // The expandable container should have max-h-0 (collapsed)
    const expandableDiv = card.querySelector(".max-h-0");
    expect(expandableDiv).toBeTruthy();

    // Click to expand
    fireEvent.click(card);

    // After expand, should have max-h-[2000px]
    const expandedDiv = card.querySelector('[class*="max-h-[2000px]"]');
    expect(expandedDiv).toBeTruthy();
  });

  // ── 9. aria-expanded ──
  it("has correct aria-expanded attribute", () => {
    const { container } = render(
      <ExpandableDashboardCard {...defaultProps} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-expanded", "false");
  });

  // ── 10. persistKey ──
  it("reads and writes localStorage when persistKey is set", () => {
    // Pre-set localStorage to expanded
    localStorageMock.setItem("test-key", "true");

    const { container } = render(
      <ExpandableDashboardCard {...defaultProps} persistKey="test-key" />
    );

    const card = container.firstChild as HTMLElement;
    // Should start expanded (read from localStorage)
    expect(card).toHaveAttribute("aria-expanded", "true");

    // Click to collapse
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-expanded", "false");

    // localStorage should be updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith("test-key", "false");
  });

  // ── 11. highlight pulse ──
  it("shows highlight ring when highlight prop is true", () => {
    const { container } = render(
      <ExpandableDashboardCard {...defaultProps} highlight />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("ring-2");
    expect(card.className).toContain("ring-emerald-400");
  });

  // ── 12. emptyState ──
  it("shows empty state text and CTA when isEmpty is true", () => {
    const onCtaClick = vi.fn();

    render(
      <ExpandableDashboardCard
        {...defaultProps}
        isEmpty
        emptyState={{
          text: "Nessun dato disponibile",
          cta: { label: "Aggiungi ora", onClick: onCtaClick },
        }}
      />
    );

    expect(screen.getByText("Nessun dato disponibile")).toBeInTheDocument();
    expect(screen.getByText("Aggiungi ora")).toBeInTheDocument();

    // Value should NOT be visible in empty state
    expect(screen.queryByText("€ 1.234,00")).not.toBeInTheDocument();

    // Click CTA
    fireEvent.click(screen.getByText("Aggiungi ora"));
    expect(onCtaClick).toHaveBeenCalledOnce();
  });
});
