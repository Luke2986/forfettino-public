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

import { useClientMonthlyTrend } from "../useClientMonthlyTrend";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const MOCK_TREND_DATA = [
  { month: 1, gross_amount: "3000", receipt_count: 2 },
  { month: 3, gross_amount: "5000", receipt_count: 3 },
  { month: 6, gross_amount: "1500", receipt_count: 1 },
];

describe("useClientMonthlyTrend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it("maps RPC response fields with Number() coercion", async () => {
    mockRpc.mockResolvedValue({ data: MOCK_TREND_DATA, error: null });

    const { result } = renderHook(
      () => useClientMonthlyTrend(2026, "client-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toEqual({
      month: 1,
      grossAmount: 3000,
      receiptCount: 2,
    });
  });

  it("passes correct parameters to RPC for specific client", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useClientMonthlyTrend(2026, "client-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith("get_client_monthly_trend", {
      p_user_id: "user-123",
      p_fiscal_year: 2026,
      p_client_id: "client-1",
    });
  });

  it("passes null client_id for 'Senza cliente' bucket", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useClientMonthlyTrend(2026, null),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith("get_client_monthly_trend", {
      p_user_id: "user-123",
      p_fiscal_year: 2026,
      p_client_id: null,
    });
  });

  it("does not run query when clientId is undefined (no selection)", () => {
    const { result } = renderHook(
      () => useClientMonthlyTrend(2026, undefined),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("does not run query when user is null", () => {
    mockAuthUser = null;

    const { result } = renderHook(
      () => useClientMonthlyTrend(2026, "client-1"),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const { result } = renderHook(
      () => useClientMonthlyTrend(2026, "client-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
