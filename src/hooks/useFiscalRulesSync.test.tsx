import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useFiscalRulesSync } from "./useFiscalRulesSync";

// --- Mock Supabase Realtime ---

type BroadcastHandler = (payload: { payload?: { fiscal_year?: number } }) => void;

let capturedHandler: BroadcastHandler | null = null;
let subscribedChannelName: string | null = null;
let lastCreatedChannelInstance: Record<string, unknown> | null = null;

const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn().mockReturnThis();
const mockOn = vi.fn().mockImplementation((_type: string, _filter: unknown, handler: BroadcastHandler) => {
  capturedHandler = handler;
  // Supabase fluent API: .on() restituisce lo stesso oggetto canale
  return lastCreatedChannelInstance!;
});
const mockChannel = vi.fn().mockImplementation((name: string) => {
  subscribedChannelName = name;
  lastCreatedChannelInstance = { on: mockOn, subscribe: mockSubscribe };
  return lastCreatedChannelInstance;
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

// --- Mock useToast ---

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// --- Helpers ---

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient,
  };
}

// --- Tests ---

describe("useFiscalRulesSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    subscribedChannelName = null;
    lastCreatedChannelInstance = null;
  });

  it("sottoscrive al canale 'fiscal-rules-updates' al mount", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useFiscalRulesSync(), { wrapper });

    expect(mockChannel).toHaveBeenCalledWith("fiscal-rules-updates");
    expect(mockOn).toHaveBeenCalledWith(
      "broadcast",
      { event: "fiscal_rules_updated" },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
    expect(subscribedChannelName).toBe("fiscal-rules-updates");
  });

  it("invalida le query key corrette quando riceve un evento broadcast", () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useFiscalRulesSync(), { wrapper });

    expect(capturedHandler).not.toBeNull();
    act(() => {
      capturedHandler!({ payload: { fiscal_year: 2026 } });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["fiscalRules", 2026] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["fiscalRulesYears"] });
  });

  it("mostra toast con anno corretto quando riceve evento", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useFiscalRulesSync(), { wrapper });

    act(() => {
      capturedHandler!({ payload: { fiscal_year: 2027 } });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Parametri INPS aggiornati",
      description: "I parametri per l'anno 2027 sono stati aggiornati. Ricalcolo in corso...",
    });
  });

  it("rimuove il canale corretto al unmount (cleanup)", () => {
    const { wrapper } = createWrapper();
    const { unmount } = renderHook(() => useFiscalRulesSync(), { wrapper });

    const channelRef = lastCreatedChannelInstance;
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelRef);
  });

  it("ignora broadcast con payload malformato senza crashare", () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useFiscalRulesSync(), { wrapper });

    // Payload senza fiscal_year
    act(() => {
      capturedHandler!({ payload: {} } as { payload?: { fiscal_year?: number } });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[useFiscalRulesSync] Broadcast con payload invalido:",
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it("ignora broadcast con payload undefined senza crashare", () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useFiscalRulesSync(), { wrapper });

    // Payload completamente undefined
    act(() => {
      capturedHandler!({} as { payload?: { fiscal_year?: number } });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
