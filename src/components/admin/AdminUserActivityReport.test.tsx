import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminUserActivityReport } from "./AdminUserActivityReport";
import type { ActivityKpi, TrendData } from "@/hooks/useAdminStats";

// Mock recharts to avoid canvas issues in jsdom
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

const mockActivityKpi: ActivityKpi = {
  dau: 5,
  dauPrev: 3,
  wau: 15,
  wauPrev: 12,
  mau: 40,
  mauPrev: 35,
};

const mockTrendData: TrendData = {
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-02-${String(i + 1).padStart(2, "0")}`,
    count: i + 1,
  })),
  weekly: Array.from({ length: 12 }, (_, i) => ({
    week: `2026-01-${String(i * 7 + 1).padStart(2, "0")}`,
    count: i + 1,
  })),
  monthly: Array.from({ length: 12 }, (_, i) => ({
    month: `${["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"][i]} 26`,
    count: i + 1,
  })),
};

describe("AdminUserActivityReport", () => {
  it("renders section header", () => {
    renderWithProviders(
      <AdminUserActivityReport
        activityKpi={mockActivityKpi}
        signupTrend={mockTrendData}
        activityTrend={mockTrendData}
      />
    );
    expect(screen.getByText("Report Attività Utenti")).toBeInTheDocument();
  });

  it("renders DAU/WAU/MAU KPI cards with values", () => {
    renderWithProviders(
      <AdminUserActivityReport
        activityKpi={mockActivityKpi}
        signupTrend={mockTrendData}
        activityTrend={mockTrendData}
      />
    );
    // KPI values may appear in multiple places (chart data + card) — use getAllByText
    expect(screen.getAllByText("5").length).toBeGreaterThan(0); // DAU
    expect(screen.getAllByText("15").length).toBeGreaterThan(0); // WAU
    expect(screen.getAllByText("40").length).toBeGreaterThan(0); // MAU
    expect(screen.getByText(/Utenti Oggi/)).toBeInTheDocument();
    expect(screen.getByText(/Ultimi 7gg/)).toBeInTheDocument();
    expect(screen.getByText(/Ultimi 30gg/)).toBeInTheDocument();
  });

  it("shows percentage change in sublabels", () => {
    renderWithProviders(
      <AdminUserActivityReport
        activityKpi={mockActivityKpi}
        signupTrend={mockTrendData}
        activityTrend={mockTrendData}
      />
    );
    // DAU: 5 vs 3 = +67%
    expect(screen.getByText(/\+67% vs ieri/)).toBeInTheDocument();
    // WAU: 15 vs 12 = +25%
    expect(screen.getByText(/\+25% vs sett\. scorsa/)).toBeInTheDocument();
    // MAU: 40 vs 35 = +14%
    expect(screen.getByText(/\+14% vs mese scorso/)).toBeInTheDocument();
  });

  it("renders chart titles", () => {
    renderWithProviders(
      <AdminUserActivityReport
        activityKpi={mockActivityKpi}
        signupTrend={mockTrendData}
        activityTrend={mockTrendData}
      />
    );
    expect(screen.getByText("Nuove Registrazioni")).toBeInTheDocument();
    expect(screen.getByText("Utenti Attivi")).toBeInTheDocument();
  });

  it("renders gracefully with undefined data", () => {
    renderWithProviders(<AdminUserActivityReport />);
    // Should render section header but no KPI cards or charts
    expect(screen.getByText("Report Attività Utenti")).toBeInTheDocument();
    expect(screen.queryByText(/Utenti Oggi/)).not.toBeInTheDocument();
    expect(screen.queryByText("Nuove Registrazioni")).not.toBeInTheDocument();
  });

  it("renders with only activityKpi (no charts)", () => {
    renderWithProviders(<AdminUserActivityReport activityKpi={mockActivityKpi} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("Nuove Registrazioni")).not.toBeInTheDocument();
  });

  it("handles zero previous values (100% change)", () => {
    const kpi: ActivityKpi = {
      dau: 3,
      dauPrev: 0,
      wau: 0,
      wauPrev: 0,
      mau: 10,
      mauPrev: 0,
    };
    renderWithProviders(<AdminUserActivityReport activityKpi={kpi} />);
    // DAU: 3 vs 0 = +100%
    expect(screen.getByText(/\+100% vs ieri/)).toBeInTheDocument();
    // WAU: 0 vs 0 = "="
    expect(screen.getByText(/= vs sett\. scorsa/)).toBeInTheDocument();
    // MAU: 10 vs 0 = +100%
    expect(screen.getByText(/\+100% vs mese scorso/)).toBeInTheDocument();
  });

  it("handles negative change", () => {
    const kpi: ActivityKpi = {
      dau: 2,
      dauPrev: 5,
      wau: 10,
      wauPrev: 20,
      mau: 30,
      mauPrev: 40,
    };
    renderWithProviders(<AdminUserActivityReport activityKpi={kpi} />);
    // DAU: 2 vs 5 = -60%
    expect(screen.getByText(/-60% vs ieri/)).toBeInTheDocument();
    // WAU: 10 vs 20 = -50%
    expect(screen.getByText(/-50% vs sett\. scorsa/)).toBeInTheDocument();
  });

  it("renders granularity toggle buttons on charts", () => {
    renderWithProviders(
      <AdminUserActivityReport
        activityKpi={mockActivityKpi}
        signupTrend={mockTrendData}
        activityTrend={mockTrendData}
      />
    );
    // Each chart has G/S/M buttons = 6 total
    const gButtons = screen.getAllByText("G");
    const sButtons = screen.getAllByText("S");
    const mButtons = screen.getAllByText("M");
    expect(gButtons.length).toBe(2);
    expect(sButtons.length).toBe(2);
    expect(mButtons.length).toBe(2);
  });

  it("toggles granularity on chart", () => {
    renderWithProviders(
      <AdminUserActivityReport
        activityKpi={mockActivityKpi}
        signupTrend={mockTrendData}
        activityTrend={mockTrendData}
      />
    );
    // Default for signup chart is "M" (monthly), activity chart is "G" (daily)
    // So we have 1x "Ultimi 12 mesi" and 1x "Ultimi 30 giorni"
    expect(screen.getByText("Ultimi 12 mesi")).toBeInTheDocument();

    // Click "S" (weekly) on the first chart (signup)
    const sButtons = screen.getAllByText("S");
    fireEvent.click(sButtons[0]);
    expect(screen.getByText("Ultime 12 settimane")).toBeInTheDocument();
  });
});
