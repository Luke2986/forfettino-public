/**
 * Test P1: Error handling per query Supabase
 * Verifica il comportamento dell'hook quando le query falliscono
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  mockFiscalRulesData,
  ACCONTI_ZERO,
  ACCONTI_NORMAL,
  mockTableData,
  mockTableDataSingle,
  createChain,
  createWrapper,
  setupDefaultMocks,
} from "./useFiscalCalculations.setup";

// ===== vi.mock (hoisted) =====
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));
vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({ selectedYear: 2025 }),
}));
vi.mock("@/hooks/useFiscalRules", () => ({
  useFiscalRules: (year: number) => ({
    data: year === 2025 || year === 2024 ? mockFiscalRulesData : null,
    isLoading: false, isError: false, isSuccess: true,
  }),
}));
vi.mock("@/lib/fiscal-engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fiscal-engine")>("@/lib/fiscal-engine");
  return {
    ...actual,
    calcAccontiAnnoSuccessivo: (input: { primoAnno?: boolean }) =>
      input.primoAnno ? ACCONTI_ZERO : ACCONTI_NORMAL,
    calcTotaleMultiGestione: () => ({
      imponibileLordo: 11700, contributiINPS: 3050, imponibileNetto: 8650,
      imposta: 1755, totaleAccantonamento: 4805,
      dettaglioINPS: { gestione: "separata", inps: 3050 },
    }),
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn((table: string) => createChain(table)) },
}));

import { useFiscalCalculations } from "../useFiscalCalculations";

describe("useFiscalCalculations — P1 error handling Supabase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("settings fetch error non-PGRST116 causa isLoading false e valori default", async () => {
    // Errore generico (non PGRST116) → la queryFn fa throw → React Query con retry:false
    // produce data=undefined. L'hook usa fallback defaults per i calcoli.
    mockTableDataSingle.fiscal_year_settings = {
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    };
    mockTableData.fiscal_year_settings = {
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });

    // L'hook dovrebbe comunque arrivare a isLoading=false (la query entra in stato error)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    // Con settings=undefined, i valori cadono sui default
    expect(result.current.metrics.settings.taxRate).toBe(15);
    expect(result.current.metrics.settings.profitCoeff).toBe(78);
    expect(result.current.metrics.settings.inpsRate).toBe(26.07);
  });

  it("receipts fetch error produce incassiYTD = 0 e calcoli coerenti", async () => {
    // Simuliamo errore nel fetch ricevute
    mockTableData.receipts = {
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
    };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    // Senza receipts, i totali sono 0 (receipts=undefined → reduce fallback 0)
    expect(result.current.metrics.incassiYTD).toBe(0);
    expect(result.current.metrics.taxableAmount).toBe(0);
    expect(result.current.metrics.taxAmount).toBe(0);
    expect(result.current.metrics.inpsAmount).toBe(0);
    expect(result.current.metrics.spendable).toBe(0);
  });

  it("errori simultanei su settings + receipts producono metriche safe con default", async () => {
    // Entrambe le query falliscono
    mockTableDataSingle.fiscal_year_settings = {
      data: null,
      error: { code: "PGSQL", message: "connection refused" },
    };
    mockTableData.fiscal_year_settings = {
      data: null,
      error: { code: "PGSQL", message: "connection refused" },
    };
    mockTableData.receipts = {
      data: null,
      error: { code: "PGSQL", message: "connection refused" },
    };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    // Metriche devono essere "safe" — nessun NaN o errore non gestito
    expect(Number.isNaN(result.current.metrics.incassiYTD)).toBe(false);
    expect(Number.isNaN(result.current.metrics.taxableAmount)).toBe(false);
    expect(Number.isNaN(result.current.metrics.totalWithholding)).toBe(false);
    expect(Number.isNaN(result.current.metrics.spendable)).toBe(false);

    // Valori di fallback
    expect(result.current.metrics.incassiYTD).toBe(0);
    expect(result.current.metrics.spendable).toBe(0);
    expect(result.current.metrics.settings.taxRate).toBe(15);
    expect(result.current.metrics.settings.profitCoeff).toBe(78);

    // Non crashano
    expect(result.current.metrics.fiscalPeak).toBeDefined();
    expect(result.current.metrics.currentYearObligations).toBeDefined();
    expect(result.current.metrics.upcomingDeadlines).toEqual([]);
  });
});
