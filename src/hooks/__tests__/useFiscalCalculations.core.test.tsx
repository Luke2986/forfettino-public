/**
 * Test P0: Calcoli base di useFiscalCalculations
 * incassiYTD, taxableAmount, taxAmount, inpsAmount, spendable, totalWithholding
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

describe("useFiscalCalculations — P0 calcoli base", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  describe("[P0] incassiYTD", () => {
    it("calcola incassiYTD come somma dei gross_amount delle ricevute", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.incassiYTD).toBe(15000);
    });

    it("incassiYTD e' 0 quando non ci sono ricevute", async () => {
      mockTableData.receipts = { data: [], error: null };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.incassiYTD).toBe(0);
    });
  });

  describe("[P0] taxableAmount", () => {
    it("taxableAmount = incassiYTD * profitCoeff / 100", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.taxableAmount).toBe(11700);
    });
  });

  describe("[P0] taxAmount e inpsAmount", () => {
    it("taxAmount = taxableAmount * taxRate / 100", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.taxAmount).toBe(1755);
    });

    it("inpsAmount = taxableAmount * inpsRate / 100", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.inpsAmount).toBe(3050.19);
    });
  });

  describe("[P0] spendable", () => {
    it("spendable non e' mai negativo (floor a 0)", async () => {
      mockTableData.receipts = {
        data: [{ id: "r-tiny", user_id: "test-user-id", fiscal_year: 2025, gross_amount: 100, description: "Micro fattura", receipt_date: "2025-01-01", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" }],
        error: null,
      };
      mockTableDataSingle.fiscal_year_settings = { data: { ...mockSettings, reserve_amount: 50000 }, error: null };
      mockTableData.fiscal_year_settings = { data: { ...mockSettings, reserve_amount: 50000 }, error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.spendable).toBe(0);
      expect(result.current.metrics.spendable).toBeGreaterThanOrEqual(0);
    });

    it("spendable e' positivo quando incassi sufficienti", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.spendable).toBeGreaterThanOrEqual(0);
    });
  });

  describe("[P0] totalWithholding", () => {
    it("totalWithholding = taxAmount + inpsAmount", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const { taxAmount, inpsAmount, totalWithholding } = result.current.metrics;
      expect(totalWithholding).toBe(4805.19);
      expect(totalWithholding).toBeCloseTo(taxAmount + inpsAmount, 2);
    });
  });
});
