/**
 * Story 55.3 — Test hook useServiceRevenueReport
 * Mock RPC, verifica metriche HHI e mapping dati.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase
const mockRpcData: any[] = [];
let mockRpcError: Error | null = null;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: mockRpcData, error: mockRpcError })),
  },
}));

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

import { useServiceRevenueReport } from "./useServiceRevenueReport";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useServiceRevenueReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcError = null;
  });

  it("mappa correttamente i dati della RPC", async () => {
    (mockRpcData as any).length = 0;
    mockRpcData.push(
      {
        service_id: "s1",
        service_name: "Consulenza",
        service_color: "#14b8a6",
        total_gross: 7000,
        total_net: 5600,
        receipt_count: 3,
        first_receipt_date: "2026-01-01",
        last_receipt_date: "2026-03-01",
        percentage: 70,
      },
      {
        service_id: null,
        service_name: "Non categorizzato",
        service_color: "#94a3b8",
        total_gross: 3000,
        total_net: 2400,
        receipt_count: 2,
        first_receipt_date: "2026-02-01",
        last_receipt_date: "2026-03-01",
        percentage: 30,
      },
    );

    const { result } = renderHook(() => useServiceRevenueReport(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(2);
    });

    const first = result.current.data![0];
    expect(first.serviceId).toBe("s1");
    expect(first.serviceName).toBe("Consulenza");
    expect(first.serviceColor).toBe("#14b8a6");
    expect(first.totalGross).toBe(7000);
    expect(first.receiptCount).toBe(3);
    expect(first.percentage).toBe(70);

    const second = result.current.data![1];
    expect(second.serviceId).toBeNull();
    expect(second.serviceName).toBe("Non categorizzato");
  });

  it("calcola metriche HHI correttamente", async () => {
    (mockRpcData as any).length = 0;
    mockRpcData.push(
      { service_id: "s1", service_name: "A", service_color: "#000", total_gross: 7000, total_net: 5600, receipt_count: 3, first_receipt_date: "2026-01-01", last_receipt_date: "2026-03-01", percentage: 70 },
      { service_id: "s2", service_name: "B", service_color: "#111", total_gross: 3000, total_net: 2400, receipt_count: 2, first_receipt_date: "2026-02-01", last_receipt_date: "2026-03-01", percentage: 30 },
    );

    const { result } = renderHook(() => useServiceRevenueReport(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.metrics).toBeDefined();
    });

    // HHI = 70^2 + 30^2 = 4900 + 900 = 5800
    expect(result.current.metrics!.hhi).toBe(5800);
    expect(result.current.metrics!.concentration).toBe("molto_concentrato");
    expect(result.current.metrics!.topServicePct).toBe(70);
    expect(result.current.metrics!.serviceCount).toBe(2);
    expect(result.current.metrics!.totalGross).toBe(10000);
  });

  it("restituisce metriche con serviceCount 0 quando la RPC ritorna vuoto", async () => {
    (mockRpcData as any).length = 0;

    const { result } = renderHook(() => useServiceRevenueReport(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.metrics).toBeDefined();
    expect(result.current.metrics!.serviceCount).toBe(0);
    expect(result.current.metrics!.hhi).toBe(0);
  });

  it("gestisce errore della RPC", async () => {
    mockRpcError = new Error("DB error");
    (mockRpcData as any).length = 0;

    const { result } = renderHook(() => useServiceRevenueReport(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
