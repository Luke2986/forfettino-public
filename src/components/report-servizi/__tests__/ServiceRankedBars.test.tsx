/**
 * Story 55.3 + 55.5 — Test ServiceRankedBars
 * Rendering con dati, gating Free (top 3), blur items 4+.
 * Story 55.5: expansion click (Pro), no expansion (Free/Totale), chevron, reset on period change.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// Mock hooks
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Mock UpgradeCTA
vi.mock("@/components/subscription/UpgradeCTA", () => ({
  UpgradeCTA: ({ feature }: { feature: string }) => (
    <div data-testid="upgrade-cta">{feature}</div>
  ),
}));

// Mock ServiceMonthlyTrendChart
vi.mock("../ServiceMonthlyTrendChart", () => ({
  ServiceMonthlyTrendChart: ({ serviceId, serviceName, fiscalYear }: any) => (
    <div data-testid={`mock-trend-chart-${serviceId ?? "__null__"}`}>
      {serviceName} - {fiscalYear}
    </div>
  ),
}));

import { ServiceRankedBars } from "../ServiceRankedBars";
import type { ServiceRevenue } from "@/hooks/useServiceRevenueReport";

const mockData: ServiceRevenue[] = [
  { serviceId: "s1", serviceName: "Consulenza", serviceColor: "#14b8a6", totalGross: 5000, totalNet: 4000, receiptCount: 5, firstReceiptDate: "2026-01-01", lastReceiptDate: "2026-03-01", percentage: 50 },
  { serviceId: "s2", serviceName: "Sviluppo", serviceColor: "#3b82f6", totalGross: 3000, totalNet: 2400, receiptCount: 3, firstReceiptDate: "2026-01-15", lastReceiptDate: "2026-02-15", percentage: 30 },
  { serviceId: "s3", serviceName: "Formazione", serviceColor: "#f59e0b", totalGross: 1000, totalNet: 800, receiptCount: 1, firstReceiptDate: "2026-02-01", lastReceiptDate: "2026-02-01", percentage: 10 },
  { serviceId: "s4", serviceName: "Supporto", serviceColor: "#8b5cf6", totalGross: 500, totalNet: 400, receiptCount: 1, firstReceiptDate: "2026-03-01", lastReceiptDate: "2026-03-01", percentage: 5 },
  { serviceId: null, serviceName: "Non categorizzato", serviceColor: "#94a3b8", totalGross: 500, totalNet: 400, receiptCount: 1, firstReceiptDate: "2026-01-01", lastReceiptDate: "2026-01-01", percentage: 5 },
];

function renderBars(props: Partial<React.ComponentProps<typeof ServiceRankedBars>> = {}) {
  return render(
    <MemoryRouter>
      <ServiceRankedBars
        data={mockData}
        hasFullAccess={true}
        selectedPeriod={2026}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("ServiceRankedBars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza tutte le barre con accesso completo", () => {
    renderBars();
    expect(screen.getAllByTestId(/^bar-row-/)).toHaveLength(5);
  });

  it("mostra nomi dei servizi", () => {
    renderBars();
    expect(screen.getByText("Consulenza")).toBeTruthy();
    expect(screen.getByText("Sviluppo")).toBeTruthy();
    expect(screen.getByText("Formazione")).toBeTruthy();
  });

  it("mostra percentuali", () => {
    renderBars();
    expect(screen.getByText("50.0%")).toBeTruthy();
    expect(screen.getByText("30.0%")).toBeTruthy();
  });

  it("mostra 'Non categorizzato' per servizi senza ID", () => {
    renderBars();
    expect(screen.getByText(/Non categorizzato/)).toBeTruthy();
  });

  it("mostra dot colorato per ogni servizio (via style backgroundColor)", () => {
    const { container } = renderBars();
    const dots = container.querySelectorAll(".w-3.h-3.rounded-full");
    expect(dots.length).toBeGreaterThanOrEqual(5);
  });

  it("non mostra UpgradeCTA con accesso completo", () => {
    renderBars();
    expect(screen.queryByTestId("upgrade-cta")).toBeNull();
  });

  describe("Free tier gating", () => {
    it("mostra UpgradeCTA per utenti Free con più di 3 servizi", () => {
      renderBars({ hasFullAccess: false });
      expect(screen.getByTestId("upgrade-cta")).toBeTruthy();
      expect(screen.getByText(/sblocca tutti i servizi/i)).toBeTruthy();
    });

    it("applica blur alle barre dalla 4a in poi per utenti Free", () => {
      const { container } = renderBars({ hasFullAccess: false });
      const rows = container.querySelectorAll("[data-testid^='bar-row-']");
      expect(rows[0].classList.contains("blur-[4px]")).toBe(false);
      expect(rows[1].classList.contains("blur-[4px]")).toBe(false);
      expect(rows[2].classList.contains("blur-[4px]")).toBe(false);
      expect(rows[3].classList.contains("blur-[4px]")).toBe(true);
      expect(rows[4].classList.contains("blur-[4px]")).toBe(true);
    });

    it("non mostra UpgradeCTA se ci sono 3 o meno servizi", () => {
      renderBars({
        hasFullAccess: false,
        data: mockData.slice(0, 3),
      });
      expect(screen.queryByTestId("upgrade-cta")).toBeNull();
    });
  });

  describe("Expansion (Story 55.5)", () => {
    it("mostra chevron su barre Pro con anno selezionato", () => {
      const { container } = renderBars({ hasFullAccess: true, selectedPeriod: 2026 });
      // Chevron icons should be present (one per visible bar)
      const chevrons = container.querySelectorAll("[aria-hidden='true']");
      // Filter only the ChevronDown SVGs (not the color dots)
      const svgChevrons = Array.from(chevrons).filter(el => el.tagName.toLowerCase() === "svg");
      expect(svgChevrons.length).toBeGreaterThan(0);
    });

    it("non mostra chevron per utenti Free", () => {
      const { container } = renderBars({ hasFullAccess: false, selectedPeriod: 2026 });
      // No clickable bars for Free users
      const buttons = container.querySelectorAll("[role='button']");
      // First 3 are not blurred but Free has no canExpand
      expect(buttons.length).toBe(0);
    });

    it("non mostra chevron quando periodo è Totale (null)", () => {
      const { container } = renderBars({ hasFullAccess: true, selectedPeriod: null });
      const buttons = container.querySelectorAll("[role='button']");
      expect(buttons.length).toBe(0);
    });

    it("espande e mostra trend chart al click su barra Pro", () => {
      renderBars({ hasFullAccess: true, selectedPeriod: 2026 });
      // Click on first bar
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);
      // Trend chart should appear
      expect(screen.getByTestId("mock-trend-chart-s1")).toBeTruthy();
    });

    it("chiude expansion al secondo click (toggle)", () => {
      renderBars({ hasFullAccess: true, selectedPeriod: 2026 });
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);
      expect(screen.getByTestId("mock-trend-chart-s1")).toBeTruthy();
      // Click again to close
      fireEvent.click(buttons[0]);
      expect(screen.queryByTestId("mock-trend-chart-s1")).toBeNull();
    });

    it("espande barra 'Non categorizzato' (serviceId null) correttamente", () => {
      renderBars({ hasFullAccess: true, selectedPeriod: 2026 });
      // "Non categorizzato" is last — find its button
      const buttons = screen.getAllByRole("button");
      const nullButton = buttons[buttons.length - 1];
      fireEvent.click(nullButton);
      expect(screen.getByTestId("mock-trend-chart-__null__")).toBeTruthy();
    });

    it("espande con tastiera Enter", () => {
      renderBars({ hasFullAccess: true, selectedPeriod: 2026 });
      const buttons = screen.getAllByRole("button");
      fireEvent.keyDown(buttons[0], { key: "Enter" });
      expect(screen.getByTestId("mock-trend-chart-s1")).toBeTruthy();
    });

    it("espande con tastiera Space", () => {
      renderBars({ hasFullAccess: true, selectedPeriod: 2026 });
      const buttons = screen.getAllByRole("button");
      fireEvent.keyDown(buttons[0], { key: " " });
      expect(screen.getByTestId("mock-trend-chart-s1")).toBeTruthy();
    });

    it("resetta expansion al cambio periodo", () => {
      const { rerender } = render(
        <MemoryRouter>
          <ServiceRankedBars
            data={mockData}
            hasFullAccess={true}
            selectedPeriod={2026}
          />
        </MemoryRouter>,
      );
      // Expand first bar
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);
      expect(screen.getByTestId("mock-trend-chart-s1")).toBeTruthy();

      // Change period
      rerender(
        <MemoryRouter>
          <ServiceRankedBars
            data={mockData}
            hasFullAccess={true}
            selectedPeriod={2025}
          />
        </MemoryRouter>,
      );
      // Expansion should be reset
      expect(screen.queryByTestId("mock-trend-chart-s1")).toBeNull();
    });
  });

  it("non mostra badge dormiente", () => {
    renderBars();
    expect(screen.queryByText("Dormiente")).toBeNull();
  });
});
