/**
 * Test per useAdminUserBreakdown
 * Story 41.1 — Admin: Breakdown azioni per utente nella leaderboard
 *
 * Copertura:
 * - Hook chiama RPC con p_user_id corretto
 * - Mapping snake_case → camelCase
 * - enabled=false non triggera la query
 * - Array vuoto per utente senza contributi
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock supabase
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { useAdminUserBreakdown } from "../useAdminUserBreakdown";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useAdminUserBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chiama RPC con p_user_id e mappa risultato correttamente", async () => {
    mockRpc.mockResolvedValue({
      data: [
        { action_type: "feedback_submitted", total_points: 45, action_count: 3 },
        { action_type: "referral_signup", total_points: 30, action_count: 1 },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useAdminUserBreakdown("user-123", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith(
      "get_admin_user_contribution_breakdown",
      { p_user_id: "user-123" },
    );

    expect(result.current.data).toEqual([
      { actionType: "feedback_submitted", totalPoints: 45, actionCount: 3 },
      { actionType: "referral_signup", totalPoints: 30, actionCount: 1 },
    ]);
  });

  it("non chiama RPC quando enabled=false", async () => {
    const { result } = renderHook(
      () => useAdminUserBreakdown("user-456", false),
      { wrapper: createWrapper() },
    );

    // Attendiamo un tick per assicurarci che non parta la query
    await new Promise((r) => setTimeout(r, 50));

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("restituisce array vuoto per utente senza contributi", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useAdminUserBreakdown("user-empty", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga errore RPC", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized" },
    });

    const { result } = renderHook(
      () => useAdminUserBreakdown("user-err", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});
