import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminDerivedMetrics } from "./AdminDerivedMetrics";
import type { DerivedMetrics } from "@/hooks/useAdminStats";

const renderWithProviders = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

function sampleMetrics(): DerivedMetrics {
  return {
    retentionRate: 72.5,
    avgReceiptsPerUser: 4.3,
    freeReceiptDistribution: [
      { bucket: "0", count: 150, percent: 60 },
      { bucket: "1", count: 40, percent: 16 },
      { bucket: "2", count: 30, percent: 12 },
      { bucket: "3", count: 15, percent: 6 },
      { bucket: "4", count: 10, percent: 4 },
      { bucket: "5+", count: 5, percent: 2 },
    ],
  };
}

describe("AdminDerivedMetrics", () => {
  it("renders section title and description", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText("Metriche Derivate")).toBeInTheDocument();
    expect(screen.getByText(/Retention e frequenza/)).toBeInTheDocument();
  });

  it("renders retention rate card", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText("72.5%")).toBeInTheDocument();
    expect(screen.getByText("Retention Rate")).toBeInTheDocument();
    expect(screen.getByText("Utenti attivi in 2+ mesi")).toBeInTheDocument();
  });

  it("renders avg receipts per user card", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("Media Incassi / Utente")).toBeInTheDocument();
  });

  it("renders distribution section with title and total", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText("Distribuzione Incassi — Utenti Free")).toBeInTheDocument();
    expect(screen.getByText(/250 utenti free/)).toBeInTheDocument();
  });

  it("renders all bucket labels", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5+")).toBeInTheDocument();
  });

  it("renders at-limit badge when users at limit", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText(/5 al limite/)).toBeInTheDocument();
  });

  it("does not render at-limit badge when zero at limit", () => {
    const metrics = sampleMetrics();
    metrics.freeReceiptDistribution[5] = { bucket: "5+", count: 0, percent: 0 };
    renderWithProviders(<AdminDerivedMetrics data={metrics} />);

    expect(screen.queryByText(/al limite/)).not.toBeInTheDocument();
  });

  it("renders correctly with zero values", () => {
    const emptyMetrics: DerivedMetrics = {
      retentionRate: 0,
      avgReceiptsPerUser: 0,
      freeReceiptDistribution: [],
    };

    renderWithProviders(<AdminDerivedMetrics data={emptyMetrics} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("Distribuzione Incassi")).not.toBeInTheDocument();
  });

  it("renders both stat cards", () => {
    renderWithProviders(<AdminDerivedMetrics data={sampleMetrics()} />);

    expect(screen.getByText("Retention Rate")).toBeInTheDocument();
    expect(screen.getByText("Media Incassi / Utente")).toBeInTheDocument();
  });
});
