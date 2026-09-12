import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock dependencies
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationCount } from "./useNotificationCount";

const mockUseAuth = vi.mocked(useAuth);
const mockFrom = vi.mocked(supabase.from);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useNotificationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce 0 quando utente non autenticato", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() } as any);

    const { result } = renderHook(() => useNotificationCount(), {
      wrapper: createWrapper(),
    });

    // Query è disabilitata, data è undefined → default 0
    expect(result.current.data).toBeUndefined();
  });

  it("restituisce il conteggio delle notifiche non lette", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
      is: vi.fn().mockReturnThis(),
    };
    // eq is called twice: first for user_id (returns chain), then for delivery_channel (resolves)
    mockChain.eq
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({ count: 5, error: null });
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe(5);
    });

    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockChain.select).toHaveBeenCalledWith("*", { count: "exact", head: true });
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockChain.is).toHaveBeenCalledWith("read_at", null);
    expect(mockChain.eq).toHaveBeenCalledWith("delivery_channel", "sidebar");
  });

  it("restituisce 0 quando count è null", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
      is: vi.fn().mockReturnThis(),
    };
    mockChain.eq
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({ count: null, error: null });
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe(0);
    });
  });

  it("propaga l'errore di Supabase", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
      is: vi.fn().mockReturnThis(),
    };
    mockChain.eq
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({ count: null, error: new Error("DB error") });
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
