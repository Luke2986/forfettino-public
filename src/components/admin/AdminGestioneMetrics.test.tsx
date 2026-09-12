import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminGestioneMetrics } from "./AdminGestioneMetrics";
import type { GestioneMetrics } from "@/hooks/useAdminStats";

function mockGestioneMetrics(overrides?: Partial<Record<string, Partial<GestioneMetrics["separata"]>>>): GestioneMetrics {
  return {
    separata: { users: 42, onboarded: 38, onboardingRate: 90.48, pro: 5, conversionRate: 11.9, receiptCount: 100, receiptAmount: 50000, ...overrides?.separata },
    artigiani: { users: 12, onboarded: 10, onboardingRate: 83.33, pro: 2, conversionRate: 16.67, receiptCount: 30, receiptAmount: 15000, ...overrides?.artigiani },
    commercianti: { users: 8, onboarded: 6, onboardingRate: 75.0, pro: 1, conversionRate: 12.5, receiptCount: 20, receiptAmount: 10000, ...overrides?.commercianti },
  };
}

describe("AdminGestioneMetrics", () => {
  it("renders stat cards for all three gestioni", () => {
    render(<AdminGestioneMetrics data={mockGestioneMetrics()} />);

    expect(screen.getByText("Separata")).toBeInTheDocument();
    expect(screen.getByText("Artigiani")).toBeInTheDocument();
    expect(screen.getByText("Commercianti")).toBeInTheDocument();
  });

  it("renders user counts correctly", () => {
    render(<AdminGestioneMetrics data={mockGestioneMetrics()} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders section title", () => {
    render(<AdminGestioneMetrics data={mockGestioneMetrics()} />);

    expect(screen.getByText("Distribuzione per Gestione INPS")).toBeInTheDocument();
  });

  it("returns null when all gestioni have zero users", () => {
    const emptyData: GestioneMetrics = {
      separata: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0, receiptCount: 0, receiptAmount: 0 },
      artigiani: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0, receiptCount: 0, receiptAmount: 0 },
      commercianti: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0, receiptCount: 0, receiptAmount: 0 },
    };

    const { container } = render(<AdminGestioneMetrics data={emptyData} />);

    expect(container.innerHTML).toBe("");
  });

  it("renders subLabel with percentages for each gestione", () => {
    render(<AdminGestioneMetrics data={mockGestioneMetrics()} />);

    // 42/62 ≈ 68%
    expect(screen.getByText(/68% del totale/)).toBeInTheDocument();
    // 12/62 ≈ 19%
    expect(screen.getByText(/19% del totale/)).toBeInTheDocument();
    // 8/62 ≈ 13%
    expect(screen.getByText(/13% del totale/)).toBeInTheDocument();
  });

  it("renders conversion rates for each gestione (FR39)", () => {
    render(<AdminGestioneMetrics data={mockGestioneMetrics()} />);

    expect(screen.getByText(/Pro 11\.9%/)).toBeInTheDocument();
    expect(screen.getByText(/Pro 16\.67%/)).toBeInTheDocument();
    expect(screen.getByText(/Pro 12\.5%/)).toBeInTheDocument();
  });
});
