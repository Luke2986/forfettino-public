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
import { useNotifications } from "./useNotifications";

const mockUseAuth = vi.mocked(useAuth);
const mockFrom = vi.mocked(supabase.from);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockNotifications = [
  {
    id: "n1",
    user_id: "user-1",
    type: "deadline_reminder_7d",
    category: "scadenze",
    title: "Scadenza tra 7 giorni",
    body: "Rata INPS Q1",
    read_at: null,
    action_url: "/scadenziario",
    action_label: "Vai allo Scadenziario",
    metadata: null,
    email_sent_at: null,
    sms_sent_at: null,
    created_at: "2026-02-17T10:00:00Z",
    updated_at: "2026-02-17T10:00:00Z",
  },
  {
    id: "n2",
    user_id: "user-1",
    type: "digest_mensile",
    category: "insights",
    title: "Riepilogo mensile",
    body: "Hai incassato €5.000 questo mese",
    read_at: "2026-02-17T12:00:00Z",
    action_url: null,
    action_label: null,
    metadata: null,
    email_sent_at: null,
    sms_sent_at: null,
    created_at: "2026-02-16T08:00:00Z",
    updated_at: "2026-02-16T08:00:00Z",
  },
];

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce array vuoto quando utente non autenticato", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() } as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    // Query è disabilitata
    expect(result.current.data).toBeUndefined();
  });

  it("fetcha la lista notifiche ordinate per created_at DESC", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockChain.select).toHaveBeenCalledWith("*");
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockChain.eq).toHaveBeenCalledWith("delivery_channel", "sidebar");
    expect(mockChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockChain.limit).toHaveBeenCalledWith(50);
  });

  it("restituisce array vuoto quando data è null", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
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
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
