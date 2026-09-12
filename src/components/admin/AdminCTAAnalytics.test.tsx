import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminCTAAnalytics } from "./AdminCTAAnalytics";
import type { CTAAnalyticsData } from "@/hooks/useAdminStats";

function makeCTAData(): CTAAnalyticsData[] {
  return [
    { metricLabel: "Click Aggiungi Incasso", today: 5, week: 30, month: 120 },
    { metricLabel: "Incassi Creati", today: 3, week: 18, month: 72 },
    { metricLabel: "Click Importa XML", today: 2, week: 10, month: 45 },
    { metricLabel: "Import Completati", today: 1, week: 6, month: 25 },
  ];
}

describe("AdminCTAAnalytics", () => {
  it("renders section title and description", () => {
    render(<AdminCTAAnalytics data={makeCTAData()} />);

    expect(screen.getByText("Funnel CTA")).toBeInTheDocument();
    expect(
      screen.getByText(/Click e completamenti — ultimi 30 giorni/),
    ).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<AdminCTAAnalytics data={makeCTAData()} />);

    expect(screen.getByText("Metrica")).toBeInTheDocument();
    expect(screen.getByText("Oggi")).toBeInTheDocument();
    expect(screen.getByText("7gg")).toBeInTheDocument();
    expect(screen.getByText("30gg")).toBeInTheDocument();
  });

  it("renders all metric labels", () => {
    render(<AdminCTAAnalytics data={makeCTAData()} />);

    expect(screen.getByText("Click Aggiungi Incasso")).toBeInTheDocument();
    expect(screen.getByText("Incassi Creati")).toBeInTheDocument();
    expect(screen.getByText("Click Importa XML")).toBeInTheDocument();
    expect(screen.getByText("Import Completati")).toBeInTheDocument();
  });

  it("renders counts correctly", () => {
    render(<AdminCTAAnalytics data={makeCTAData()} />);

    // First row: today=5, week=30, month=120
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("renders zero consistently for all columns", () => {
    const zeroData: CTAAnalyticsData[] = [
      { metricLabel: "Click Aggiungi Incasso", today: 0, week: 0, month: 0 },
    ];

    render(<AdminCTAAnalytics data={zeroData} />);

    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(3);
  });

  it("renders empty state when no data", () => {
    render(<AdminCTAAnalytics data={[]} />);

    expect(
      screen.getByText("Nessun dato CTA disponibile"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Metrica")).not.toBeInTheDocument();
  });

  it("renders single metric correctly", () => {
    const single: CTAAnalyticsData[] = [
      { metricLabel: "Click Importa XML", today: 7, week: 42, month: 180 },
    ];

    render(<AdminCTAAnalytics data={single} />);

    expect(screen.getByText("Click Importa XML")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
  });

  it("handles large counts", () => {
    const large: CTAAnalyticsData[] = [
      { metricLabel: "Click Aggiungi Incasso", today: 500, week: 3500, month: 15000 },
    ];

    render(<AdminCTAAnalytics data={large} />);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("3500")).toBeInTheDocument();
    expect(screen.getByText("15000")).toBeInTheDocument();
  });
});
