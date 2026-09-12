import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./use-toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateNotificationPreference } from "./useUpdateNotificationPreference";

const mockUseAuth = vi.mocked(useAuth);
const mockUseToast = vi.mocked(useToast);
const mockFrom = vi.mocked(supabase.from);

function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useUpdateNotificationPreference", () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast, dismiss: vi.fn(), toasts: [] });
  });

  it("lancia errore quando utente non autenticato", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() } as any);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ category: "insights", enabled: false });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("permette la modifica della categoria scadenze", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "pref-1", user_id: "user-1", category: "scadenze", enabled: false },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ category: "scadenze", enabled: false });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("notification_preferences");
    expect(mockChain.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", category: "scadenze", enabled: false },
      { onConflict: "user_id,category" },
    );
  });

  it("esegue upsert con onConflict corretto", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "pref-1", user_id: "user-1", category: "insights", enabled: false },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ category: "insights", enabled: false });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("notification_preferences");
    expect(mockChain.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", category: "insights", enabled: false },
      { onConflict: "user_id,category" },
    );
  });

  it("invalida le query e mostra toast su successo", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "pref-1" }, error: null }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ category: "aggiornamenti", enabled: true });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["notification_preferences", "user-1"] }),
    );
    expect(mockToast).toHaveBeenCalledWith({ title: "Preferenze aggiornate" });
  });

  it("mostra toast destructive su errore Supabase", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error("Insert failed") }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ category: "insights", enabled: true });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Errore nel salvataggio",
      variant: "destructive",
    });
  });

  it("gestisce aggiornamenti categoria valida", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      signOut: vi.fn(),
    } as any);

    const mockChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "pref-1", category: "aggiornamenti", enabled: true },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain as any);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ category: "aggiornamenti", enabled: true });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockChain.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", category: "aggiornamenti", enabled: true },
      { onConflict: "user_id,category" },
    );
  });
});
