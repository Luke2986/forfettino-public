/**
 * Test per il broadcast Supabase Realtime da useUpdateFiscalRules e useInsertFiscalRules.
 * Story 7.2 — Ricalcolo a Cascata Post-Aggiornamento Parametri
 *
 * Verifica che dopo una mutation con successo (UPDATE o INSERT), il hook
 * invii un broadcast sul canale 'fiscal-rules-updates' con l'anno aggiornato
 * e pulisca il canale dopo l'invio (no channel leak).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// --- Mock Supabase con chain UPDATE/INSERT + channel broadcast ---

const mockSend = vi.fn().mockResolvedValue("ok");
const mockRemoveChannel = vi.fn();
const mockChannelInstance = { send: mockSend };

const mockUpdateSingle = vi.fn().mockResolvedValue({
  data: { fiscal_year: 2026 },
  error: null,
});
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEq = vi.fn((..._args: unknown[]) => ({ select: mockUpdateSelect }));
const mockUpdate = vi.fn((..._args: unknown[]) => ({ eq: mockUpdateEq }));

const mockInsertSingle = vi.fn().mockResolvedValue({
  data: { fiscal_year: 2027 },
  error: null,
});
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }));
const mockInsert = vi.fn((..._args: unknown[]) => ({ select: mockInsertSelect }));

const mockFrom = vi.fn((..._args: unknown[]) => ({ update: mockUpdate, insert: mockInsert }));
const mockChannel = vi.fn((..._args: unknown[]) => mockChannelInstance);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { useUpdateFiscalRules, useInsertFiscalRules } from "./useFiscalRules";

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

describe("useUpdateFiscalRules — broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSingle.mockResolvedValue({
      data: { fiscal_year: 2026 },
      error: null,
    });
  });

  it("invia broadcast Realtime dopo mutation success con anno corretto", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFiscalRules(), { wrapper });

    result.current.mutate({
      fiscalYear: 2026,
      updates: { inps_rate_separata: 26.07 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verifica che il broadcast sia stato inviato sul canale corretto
    expect(mockChannel).toHaveBeenCalledWith("fiscal-rules-updates");
    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "fiscal_rules_updated",
      payload: { fiscal_year: 2026 },
    });
  });

  it("pulisce il canale dopo il broadcast (no channel leak)", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFiscalRules(), { wrapper });

    result.current.mutate({
      fiscalYear: 2026,
      updates: { inps_rate_separata: 26.07 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Attendi che la Promise del send si risolva per il cleanup
    await waitFor(() => {
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
    });
  });

  it("NON invia broadcast se la mutation fallisce", async () => {
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "500" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFiscalRules(), { wrapper });

    result.current.mutate({
      fiscalYear: 2026,
      updates: { inps_rate_separata: 26.07 },
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("useInsertFiscalRules — broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertSingle.mockResolvedValue({
      data: { fiscal_year: 2027 },
      error: null,
    });
  });

  it("invia broadcast Realtime dopo INSERT success con anno corretto", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInsertFiscalRules(), { wrapper });

    result.current.mutate({
      fiscal_year: 2027,
      inps_rate_separata: 26.07,
    } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockChannel).toHaveBeenCalledWith("fiscal-rules-updates");
    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "fiscal_rules_updated",
      payload: { fiscal_year: 2027 },
    });
  });
});
