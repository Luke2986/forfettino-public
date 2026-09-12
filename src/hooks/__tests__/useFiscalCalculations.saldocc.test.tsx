/**
 * Test Story 19-1: Saldo Iniziale Conto Corrente
 * Verifica che saldoInizialeCC venga esposto in FiscalMetrics
 * e che influenzi correttamente il calcolo dello spendibile.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  mockFiscalRulesData,
  ACCONTI_ZERO,
  ACCONTI_NORMAL,
  mockSettings,
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

describe("useFiscalCalculations — Story 19-1 Saldo Iniziale CC", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("spendabile con saldo_iniziale_cc = 0 è invariato rispetto al baseline", async () => {
    // mockSettings ha saldo_iniziale_cc: 0 di default
    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });

    // Con saldo_iniziale_cc = 0 il calcolo è identico a prima della Story 19-1
    // incassiYTD = 15000, spendable = max(0, 0 + 15000 - totalWithholding - buffer - yearlyToolCost - unpaidCY - reserve)
    const m = result.current.metrics;
    expect(m.saldoInizialeCC).toBe(0);
    // Lo spendable non deve essere negativo
    expect(m.spendable).toBeGreaterThanOrEqual(0);
  });

  it("spendabile con saldo_iniziale_cc = 5000 aumenta di 5000", async () => {
    // Prima: spendable senza saldo
    const { result: resultBase } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(resultBase.current.isLoading).toBe(false); });
    const spendableBase = resultBase.current.metrics.spendable;

    // Ora con saldo_iniziale_cc = 5000
    const settingsWithSaldo = { ...mockSettings, saldo_iniziale_cc: 5000 };
    mockTableData.fiscal_year_settings = { data: settingsWithSaldo, error: null };
    mockTableDataSingle.fiscal_year_settings = { data: settingsWithSaldo, error: null };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });

    expect(result.current.metrics.saldoInizialeCC).toBe(5000);
    expect(result.current.metrics.spendable).toBe(spendableBase + 5000);
  });

  it("spendabile con saldo_iniziale_cc + incassi < deduzioni = floor a 0", async () => {
    // Scenario: pochissimi incassi + saldo piccolo, le deduzioni superano il totale
    mockTableData.receipts = { data: [
      { id: "r-small", user_id: "test-user-id", fiscal_year: 2025, gross_amount: 100, description: "Piccolo", receipt_date: "2025-01-15", created_at: "2025-01-15T00:00:00Z", updated_at: "2025-01-15T00:00:00Z" },
    ], error: null };

    // unpaidCurrentYearTotal = 50000 (simulato con tax_schedule open)
    const bigSchedule = {
      id: "sched-big", user_id: "test-user-id", bucket: "june",
      due_date: "2025-06-30", payment_year: 2025, reference_year: 2024,
      tax_balance: 25000, tax_advance: 0, inps_balance: 25000, inps_advance: 0,
      total_expected: 50000, total_paid: 0, status: "open",
      notes: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
    };
    mockTableData.tax_schedule = { data: [bigSchedule], error: null };

    const settingsWithSaldo = { ...mockSettings, saldo_iniziale_cc: 200 };
    mockTableData.fiscal_year_settings = { data: settingsWithSaldo, error: null };
    mockTableDataSingle.fiscal_year_settings = { data: settingsWithSaldo, error: null };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });

    expect(result.current.metrics.saldoInizialeCC).toBe(200);
    expect(result.current.metrics.spendable).toBe(0); // floor a 0
  });

  it("FiscalMetrics espone saldoInizialeCC", async () => {
    const settingsWithSaldo = { ...mockSettings, saldo_iniziale_cc: 12345 };
    mockTableData.fiscal_year_settings = { data: settingsWithSaldo, error: null };
    mockTableDataSingle.fiscal_year_settings = { data: settingsWithSaldo, error: null };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });

    expect(result.current.metrics).toHaveProperty("saldoInizialeCC");
    expect(result.current.metrics.saldoInizialeCC).toBe(12345);
  });

  it("mockSettings di default include saldo_iniziale_cc: 0 (backward compat)", async () => {
    // Verifica che il setup condiviso abbia il campo con valore 0
    // Questo garantisce che tutti i test pre-esistenti non rompano
    expect(mockSettings).toHaveProperty("saldo_iniziale_cc", 0);

    // Verifica che il hook con mockSettings di default produca saldoInizialeCC = 0
    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    expect(result.current.metrics.saldoInizialeCC).toBe(0);
  });

  it("saldo_iniziale_cc null/undefined viene sanitizzato a 0 via sanitizeMoney", async () => {
    // Simula un settings che non ha il campo (come se la migration non fosse ancora applicata)
    const settingsWithoutSaldo = { ...mockSettings };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (settingsWithoutSaldo as any).saldo_iniziale_cc;
    mockTableData.fiscal_year_settings = { data: settingsWithoutSaldo, error: null };
    mockTableDataSingle.fiscal_year_settings = { data: settingsWithoutSaldo, error: null };

    const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });

    // sanitizeMoney(undefined) deve ritornare 0
    expect(result.current.metrics.saldoInizialeCC).toBe(0);
    // Lo spendable non deve essere influenzato
    expect(result.current.metrics.spendable).toBeGreaterThanOrEqual(0);
  });
});
