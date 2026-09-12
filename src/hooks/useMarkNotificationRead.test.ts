import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock dependencies
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: { NOTIFICA_LETTA: "notifica_letta" },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })),
  },
}));

import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMarkNotificationRead } from "./useMarkNotificationRead";

const mockUseAuth = vi.mocked(useAuth);
const mockFrom = vi.mocked(supabase.from);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMarkNotificationRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lancia errore quando utente non autenticato", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() } as any);

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate("notif-1");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("aggiorna read_at e invalida le query", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockData = { id: "notif-1", read_at: "2026-02-17T12:00:00Z" };
    const mockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });

    await act(async () => {
      result.current.mutate("notif-1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
      read_at: expect.any(String),
    }));
    expect(mockChain.eq).toHaveBeenCalledWith("id", "notif-1");
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-1");

    // Verifica invalidation delle query
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["notifications", "count", "user-1"] })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["notifications", "user-1"] })
    );
  });

  it("propaga l'errore di Supabase", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error("Update failed") }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate("notif-1");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
