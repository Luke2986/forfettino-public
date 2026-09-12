/**
 * Test P2: Valori default, banner flags
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

describe("useFiscalCalculations — P2 defaults e banner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  describe("[P2] Valori default quando non ci sono settings", () => {
    it("usa valori default quando settings e' null (PGRST116)", async () => {
      // maybeSingle returns { data: null, error: null } when no rows found
      mockTableDataSingle.fiscal_year_settings = { data: null, error: null };
      mockTableData.fiscal_year_settings = { data: null, error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.settings.taxRate).toBe(15);
      expect(result.current.metrics.settings.profitCoeff).toBe(78);
      expect(result.current.metrics.settings.inpsRate).toBe(26.07);
      expect(result.current.metrics.settings.safetyBuffer).toBe(5);
      expect(result.current.metrics.settings.reserveAmount).toBe(0);
      expect(result.current.metrics.settings.bufferBase).toBe("receipts");
      expect(result.current.metrics.settings.deadlineWindowDays).toBe(45);
    });

    it("inpsManagement default e' 'separata'", async () => {
      // maybeSingle returns { data: null, error: null } when no rows found
      mockTableDataSingle.fiscal_year_settings = { data: null, error: null };
      mockTableData.fiscal_year_settings = { data: null, error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.inpsManagement).toBe("separata");
    });

    it("expiredRatesCount default e' 0", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.expiredRatesCount).toBe(0);
    });

    it("unpaidSchedules30d default e' array vuoto", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.unpaidSchedules30d).toEqual([]);
      expect(result.current.metrics.hasUnpaidOver30d).toBe(false);
    });
  });

  describe("[REGRESSION] explicit 0 must NOT be replaced by default", () => {
    // Bug: `sanitizeMoney(v) || N` trattava 0 come "assente" e lo sostituiva con il default.
    // L'utente che impostava buffer = 0% vedeva comunque 5% applicato nei calcoli,
    // quindi la modifica nelle Impostazioni era "invisibile".
    // Fix: usare `??` sul campo raw prima di sanitizeMoney.

    it("safetyBuffer = 0 resta 0 (non cade al default 5)", async () => {
      mockTableDataSingle.fiscal_year_settings = {
        data: { ...mockSettings, safety_buffer_rate: 0 }, error: null,
      };
      mockTableData.fiscal_year_settings = {
        data: { ...mockSettings, safety_buffer_rate: 0 }, error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.settings.safetyBuffer).toBe(0);
      expect(result.current.metrics.bufferAmount).toBe(0);
    });

    it("reserveAmount = 0 resta 0 (default era gia' 0, ma ora usa nullish)", async () => {
      mockTableDataSingle.fiscal_year_settings = {
        data: { ...mockSettings, reserve_amount: 0 }, error: null,
      };
      mockTableData.fiscal_year_settings = {
        data: { ...mockSettings, reserve_amount: 0 }, error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.settings.reserveAmount).toBe(0);
    });

    it("safetyBuffer cambia da 5 a 10 aggiorna il valore letto", async () => {
      mockTableDataSingle.fiscal_year_settings = {
        data: { ...mockSettings, safety_buffer_rate: 10 }, error: null,
      };
      mockTableData.fiscal_year_settings = {
        data: { ...mockSettings, safety_buffer_rate: 10 }, error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.settings.safetyBuffer).toBe(10);
    });
  });

  describe("[P2] banner flags", () => {
    it("bannerRateScaduteDismissed riflette il valore da settings", async () => {
      mockTableDataSingle.fiscal_year_settings = {
        data: { ...mockSettings, banner_rate_scadute_dismissed: true }, error: null,
      };
      mockTableData.fiscal_year_settings = {
        data: { ...mockSettings, banner_rate_scadute_dismissed: true }, error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.bannerRateScaduteDismissed).toBe(true);
    });

    it("bannerFallbackCommercialistaDismissed default e' false", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.bannerFallbackCommercialistaDismissed).toBe(false);
    });
  });
});
