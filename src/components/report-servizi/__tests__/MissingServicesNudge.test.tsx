/**
 * Story 55.3 — Test MissingServicesNudge
 * Threshold 30%, numeri concreti (X su Y), link corretto.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MissingServicesNudge } from "../MissingServicesNudge";
import type { ServiceRevenue } from "@/hooks/useServiceRevenueReport";

function makeData(nullPct: number, nullCount: number, totalCount: number): ServiceRevenue[] {
  const result: ServiceRevenue[] = [];
  if (nullPct > 0) {
    result.push({
      serviceId: null,
      serviceName: "Non categorizzato",
      serviceColor: "#94a3b8",
      totalGross: 1000,
      totalNet: 800,
      receiptCount: nullCount,
      firstReceiptDate: "2026-01-01",
      lastReceiptDate: "2026-03-01",
      percentage: nullPct,
    });
  }
  if (totalCount > nullCount) {
    result.push({
      serviceId: "s1",
      serviceName: "Consulenza",
      serviceColor: "#14b8a6",
      totalGross: 5000,
      totalNet: 4000,
      receiptCount: totalCount - nullCount,
      firstReceiptDate: "2026-01-01",
      lastReceiptDate: "2026-03-01",
      percentage: 100 - nullPct,
    });
  }
  return result;
}

function renderNudge(data: ServiceRevenue[]) {
  return render(
    <MemoryRouter>
      <MissingServicesNudge data={data} />
    </MemoryRouter>,
  );
}

describe("MissingServicesNudge", () => {
  it("non mostra nulla se percentuale <= 30%", () => {
    const { container } = renderNudge(makeData(30, 3, 10));
    expect(container.textContent).toBe("");
  });

  it("non mostra nulla se non ci sono incassi non categorizzati", () => {
    const { container } = renderNudge(makeData(0, 0, 10));
    expect(container.textContent).toBe("");
  });

  it("mostra nudge quando percentuale > 30%", () => {
    renderNudge(makeData(50, 5, 10));
    expect(screen.getByText(/incassi su/)).toBeTruthy();
  });

  it("mostra numeri concreti: conteggio e totale", () => {
    renderNudge(makeData(60, 6, 10));
    expect(screen.getByText(/6 incassi su 10/)).toBeTruthy();
    expect(screen.getByText(/60%/)).toBeTruthy();
  });

  it("mostra singolare 'incasso' per 1 solo", () => {
    renderNudge(makeData(50, 1, 2));
    expect(screen.getByText(/1 incasso su 2/)).toBeTruthy();
  });

  it("contiene link a /incassi", () => {
    renderNudge(makeData(50, 5, 10));
    const link = screen.getByText(/categorizzali/i).closest("a");
    expect(link).toBeTruthy();
    expect(link!.getAttribute("href")).toBe("/incassi");
  });
});
