import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

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
import {
  useNotificationPreferences,
  NOTIFICATION_DEFAULTS,
} from "./useNotificationPreferences";

const mockUseAuth = vi.mocked(useAuth);
const mockFrom = vi.mocked(supabase.from);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useNotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce i default quando utente non autenticato", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() } as any);

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    // Query disabilitata — nessun fetch
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("restituisce i default quando DB non ha righe (lazy creation)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(NOTIFICATION_DEFAULTS);
    });
  });

  it("merge le righe DB con i default", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { category: "insights", enabled: false },
          { category: "aggiornamenti", enabled: true },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        scadenze: true,
        insights: false,
        aggiornamenti: true,
      });
    });
  });

  it("rispetta scadenze=false se DB ha enabled=false", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ category: "scadenze", enabled: false }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.scadenze).toBe(false);
    });
  });

  it("ignora categorie sconosciute nel DB", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ category: "unknown_category", enabled: true }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(NOTIFICATION_DEFAULTS);
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
      eq: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("chiama supabase con tabella e campi corretti", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("notification_preferences");
    });
    expect(mockChain.select).toHaveBeenCalledWith("category, enabled");
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("NOTIFICATION_DEFAULTS ha i valori corretti", () => {
    expect(NOTIFICATION_DEFAULTS).toEqual({
      scadenze: true,
      insights: true,
      aggiornamenti: true,
    });
  });
});
