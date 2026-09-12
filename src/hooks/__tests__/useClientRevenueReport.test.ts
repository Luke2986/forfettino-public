import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock supabase RPC
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

// Mock useAuth
const mockUser = { id: "user-123" };
let mockAuthUser: typeof mockUser | null = mockUser;
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

import { useClientRevenueReport } from "../useClientRevenueReport";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const MOCK_RPC_DATA = [
  {
    client_id: "c1",
    client_name: "Alpha Corp",
    total_gross: "5000",
    total_net: "4000",
    receipt_count: 3,
    first_receipt_date: "2026-01-15",
    last_receipt_date: "2026-03-10",
    percentage: "50.00",
  },
  {
    client_id: "c2",
    client_name: "Beta LLC",
    total_gross: "3000",
    total_net: "2400",
    receipt_count: 2,
    first_receipt_date: "2026-02-01",
    last_receipt_date: "2026-03-01",
    percentage: "30.00",
  },
  {
    client_id: null,
    client_name: "Senza cliente",
    total_gross: "2000",
    total_net: "1600",
    receipt_count: 4,
    first_receipt_date: "2026-01-05",
    last_receipt_date: "2026-02-20",
    percentage: "20.00",
  },
];

describe("useClientRevenueReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it("maps RPC response fields correctly with Number() coercion", async () => {
    mockRpc.mockResolvedValue({ data: MOCK_RPC_DATA, error: null });

    const { result } = renderHook(() => useClientRevenueReport(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toEqual({
      clientId: "c1",
      clientName: "Alpha Corp",
      totalGross: 5000,
      totalNet: 4000,
      receiptCount: 3,
      firstReceiptDate: "2026-01-15",
      lastReceiptDate: "2026-03-10",
      percentage: 50,
    });
    // Null client_id preserved
    expect(result.current.data![2].clientId).toBeNull();
  });

  it("calculates derived metrics (HHI and classification)", async () => {
    mockRpc.mockResolvedValue({ data: MOCK_RPC_DATA, error: null });

    const { result } = renderHook(() => useClientRevenueReport(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // HHI = 50² + 30² + 20² = 2500 + 900 + 400 = 3800
    expect(result.current.metrics?.hhi).toBe(3800);
    expect(result.current.metrics?.concentration).toBe("concentrato");
    expect(result.current.metrics?.topClientPct).toBe(50);
    expect(result.current.metrics?.clientCount).toBe(3);
    expect(result.current.metrics?.totalGross).toBe(10000);
  });

  it("does not run query when user is null (enabled: !!user)", async () => {
    mockAuthUser = null;

    const { result } = renderHook(() => useClientRevenueReport(2026), {
      wrapper: createWrapper(),
    });

    // Should stay in pending state, never call RPC
    expect(result.current.isLoading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes correct parameters to RPC", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useClientRevenueReport(2025), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith("get_client_revenue_report", {
      p_user_id: "user-123",
      p_fiscal_year: 2025,
    });
  });

  it("returns null metrics for empty data", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useClientRevenueReport(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.metrics?.hhi).toBe(0);
    expect(result.current.metrics?.clientCount).toBe(0);
  });

  it("passes p_fiscal_year: null to RPC when fiscalYear is null (Totale)", async () => {
    mockRpc.mockResolvedValue({ data: MOCK_RPC_DATA, error: null });

    const { result } = renderHook(() => useClientRevenueReport(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith("get_client_revenue_report", {
      p_user_id: "user-123",
      p_fiscal_year: null,
    });
    // Dati mappati correttamente anche con null
    expect(result.current.data).toHaveLength(3);
    expect(result.current.metrics?.totalGross).toBe(10000);
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const { result } = renderHook(() => useClientRevenueReport(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
