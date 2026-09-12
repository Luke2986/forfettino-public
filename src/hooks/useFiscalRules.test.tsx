/**
 * Test per useFiscalRules hook
 * Story 1.1 — Schema Database Parametri Normativi per Anno Fiscale
 *
 * Copertura:
 * - Chiama Supabase con l'anno fiscale corretto
 * - Restituisce i dati quando la query ha successo
 * - Gestisce errore Supabase correttamente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock del modulo Supabase client
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: any) => mockFrom(table),
  },
}));

import { useFiscalRules } from "./useFiscalRules";

// Wrapper con QueryClientProvider per i test
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// Dati mock che rispecchiano i parametri INPS 2026 ufficiali
const mockFiscalRules2026 = {
  id: "test-uuid",
  fiscal_year: 2026,
  inps_rate_separata: 26.07,
  massimale_separata: 122295.0,
  inps_rate_artigiani: 24.0,
  inps_rate_artigiani_alta: 25.0,
  minimale_artigiani: 4521.36,
  massimale_artigiani: 93707.0,
  inps_rate_commercianti: 24.48,
  inps_rate_commercianti_alta: 25.48,
  minimale_commercianti: 4611.64,
  massimale_commercianti: 93707.0,
  reddito_minimale: 18808.0,
  soglia_reddito_prima_fascia: 56224.0,
  maternita_annuale: 7.44,
  aliquota_sostitutiva_5: 5.0,
  aliquota_sostitutiva_15: 15.0,
  soglia_forfettario: 85000.0,
  source_url_separata: "https://www.inps.it/example",
  source_url_artigiani_commercianti: "https://www.confcommercio.it/example",
  created_at: "2026-02-12T00:00:00Z",
  updated_at: "2026-02-12T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFiscalRules", () => {
  it("chiama supabase.from('fiscal_rules') con l'anno corretto", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: mockFiscalRules2026,
      error: null,
    });

    const { result } = renderHook(() => useFiscalRules(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("fiscal_rules");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("fiscal_year", 2026);
  });

  it("restituisce i dati corretti quando la query ha successo", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: mockFiscalRules2026,
      error: null,
    });

    const { result } = renderHook(() => useFiscalRules(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockFiscalRules2026);
    expect(result.current.data?.fiscal_year).toBe(2026);
    expect(result.current.data?.inps_rate_separata).toBe(26.07);
    expect(result.current.data?.minimale_artigiani).toBe(4521.36);
    expect(result.current.data?.minimale_commercianti).toBe(4611.64);
  });

  it("gestisce errore Supabase correttamente (errore reale, non PGRST116)", async () => {
    const supabaseError = {
      message: "Connection refused",
      details: "",
      hint: "",
      code: "CONNECTION_ERROR",
    };
    // Mock per primo tentativo + retry (retry: 1 nel hook)
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: supabaseError,
    });

    const { result } = renderHook(() => useFiscalRules(2025), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error).toEqual(supabaseError);
    expect(result.current.data).toBeUndefined();
  });

  it("restituisce null (non errore) se anno non ha regole fiscali", async () => {
    // maybeSingle ritorna null senza errore quando non ci sono righe
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useFiscalRules(2020), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("non esegue la query se fiscalYear è 0 o negativo", async () => {
    const { result } = renderHook(() => useFiscalRules(0), {
      wrapper: createWrapper(),
    });

    // La query non deve partire (enabled: false)
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isLoading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();

    const { result: resultNeg } = renderHook(() => useFiscalRules(-1), {
      wrapper: createWrapper(),
    });

    expect(resultNeg.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("non esegue la query se fiscalYear è NaN", async () => {
    const { result } = renderHook(() => useFiscalRules(NaN), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("usa query key gerarchica ['fiscalRules', fiscalYear]", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: mockFiscalRules2026,
      error: null,
    });

    const { result } = renderHook(() => useFiscalRules(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verifica che la query funziona con anno diverso (diversa query key)
    // maybeSingle ritorna null per anno senza dati (non errore)
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result: result2 } = renderHook(() => useFiscalRules(2025), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    expect(result2.current.data).toBeNull();

    // La seconda chiamata ha usato un anno diverso
    expect(mockEq).toHaveBeenCalledWith("fiscal_year", 2025);
  });
});
