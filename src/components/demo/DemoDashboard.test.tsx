/**
 * Tests for DemoDashboard — onboarding demo component.
 *
 * Story 38-1: Dashboard Demo Onboarding
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";

// ── Mocks (before component import) ──

const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock formatCurrency — jsdom doesn't fully support Intl.NumberFormat("it-IT")
vi.mock("@/lib/money", async () => {
  const actual = await vi.importActual("@/lib/money");
  return {
    ...actual,
    formatCurrency: (v: number | null | undefined) => {
      if (v == null) return "0,00\u00A0\u20AC";
      return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00A0\u20AC";
    },
  };
});

// Stub SpendibileHero to avoid complex inner rendering
vi.mock("@/components/dashboard/SpendibileHero", () => ({
  SpendibileHero: (props: { spendable: number; breakdownContent?: React.ReactNode }) =>
    createElement(
      "div",
      { "data-testid": "spendibile-hero" },
      `Hero: ${props.spendable}`,
      props.breakdownContent
        ? createElement("span", { "data-testid": "hero-has-breakdown" })
        : null,
    ),
}));

// Stub SpotlightCard to transparent wrapper
vi.mock("@/components/ui/spotlight-card", () => ({
  SpotlightCard: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "spotlight-wrapper" }, children),
}));

// ── Component import (after mocks) ──

import { DemoDashboard } from "./DemoDashboard";

const YEAR = new Date().getFullYear();

// ── Tests ──

describe("DemoDashboard", () => {
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Render tests ──

  it("renders with data-testid 'demo-dashboard'", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    expect(screen.getByTestId("demo-dashboard")).toBeDefined();
  });

  it("renders SpendibileHero with Separata spendibile", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    expect(screen.getByTestId("spendibile-hero")).toBeDefined();
    expect(screen.getByTestId("spendibile-hero").textContent).toContain("7678.21");
  });

  it("renders SpendibileHero with Art/Comm spendibile", () => {
    render(<DemoDashboard gestioneINPS="artigiani" onDismiss={onDismiss} />);
    expect(screen.getByTestId("spendibile-hero").textContent).toContain("6818.06");
  });

  it("renders 3 KPI cards", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    // Entrate, Da coprire, Proiezione labels
    expect(screen.getByText(`Entrate ${YEAR}`)).toBeDefined();
    expect(screen.getByText("Da coprire")).toBeDefined();
    expect(screen.getByText(new RegExp(`Proiezione ${YEAR + 1}`))).toBeDefined();
  });

  it("renders KPI values for Separata variant", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    // KPI card values are in elements with role="button" (KpiCard)
    const entrateCard = screen.getByTestId(`kpi-Entrate ${YEAR}`);
    expect(entrateCard.textContent).toContain("10.000");
    const daCoprireCard = screen.getByTestId("kpi-Da coprire");
    expect(daCoprireCard.textContent).toContain("2.321");
  });

  it("renders KPI values for Art/Comm variant", () => {
    render(<DemoDashboard gestioneINPS="artigiani" onDismiss={onDismiss} />);
    const entrateCard = screen.getByTestId(`kpi-Entrate ${YEAR}`);
    expect(entrateCard.textContent).toContain("10.000");
    const daCoprireCard = screen.getByTestId("kpi-Da coprire");
    expect(daCoprireCard.textContent).toContain("3.181");
  });

  it("renders KPI subtitles", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    expect(screen.getByText("Incassi da inizio anno")).toBeDefined();
    expect(screen.getByText("Tra imposte e contributi")).toBeDefined();
    expect(screen.getByText("Uscite previste dal conto")).toBeDefined();
  });

  it("passes breakdownContent to SpendibileHero (AC6: Hero click opens sheet)", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    expect(screen.getByTestId("hero-has-breakdown")).toBeDefined();
  });

  // ── Disclaimer card (below cards) ──

  it("renders disclaimer card with data-testid", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    expect(screen.getByTestId("demo-disclaimer")).toBeDefined();
  });

  it("disclaimer contains 'esempio' text for Separata", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    expect(screen.getByText(/esempio/)).toBeDefined();
    expect(screen.getByText(/7\.678/)).toBeDefined();
  });

  it("disclaimer contains 'riduzione 35%' text for Art/Comm", () => {
    render(<DemoDashboard gestioneINPS="commercianti" onDismiss={onDismiss} />);
    expect(screen.getByText(/riduzione 35%/)).toBeDefined();
  });

  it("disclaimer card renders AFTER the KPI cards (show first, explain after)", () => {
    const { container } = render(
      <DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />,
    );
    const demoRoot = container.querySelector("[data-testid='demo-dashboard']")!;
    const children = Array.from(demoRoot.children);
    // First child: section with cards. Disclaimer is second child (or later).
    const disclaimerIndex = children.findIndex(
      (el) => (el as HTMLElement).dataset.testid === "demo-disclaimer",
    );
    expect(disclaimerIndex).toBeGreaterThan(0);
  });

  // ── CTA and navigation ──

  it("CTA 'Registra il primo incasso' navigates to /incassi/nuovo", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    const cta = screen.getByTestId("demo-cta-register");
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith("/incassi/nuovo");
  });

  // ── Card click shows toast message ──

  it("clicking a KPI card shows toast with 'esempio' message", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    // Click the "Da coprire" KPI card
    const daCopireCard = screen.getByText("Da coprire").closest("[role='button']");
    expect(daCopireCard).toBeDefined();
    if (daCopireCard) fireEvent.click(daCopireCard);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Questo \u00E8 un esempio",
        description: expect.stringContaining("breakdown INPS"),
      }),
    );
  });

  // ── Dismiss behaviors ──

  it("X button calls onDismiss (localStorage managed by parent)", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    const xBtn = screen.getByTestId("demo-dismiss-x");
    fireEvent.click(xBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("'Salta demo' calls onDismiss (localStorage managed by parent)", () => {
    render(<DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />);
    const skipBtn = screen.getByTestId("demo-skip");
    fireEvent.click(skipBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ── Blur placeholders ──

  it("renders blurred placeholder zones with aria-hidden", () => {
    const { container } = render(
      <DemoDashboard gestioneINPS="separata" onDismiss={onDismiss} />,
    );
    const blurZone = container.querySelector(".demo-blur-zone");
    expect(blurZone).toBeDefined();
    expect(blurZone?.getAttribute("aria-hidden")).toBe("true");
  });
});
