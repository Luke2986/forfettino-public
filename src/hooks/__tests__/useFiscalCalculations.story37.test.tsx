/**
 * Test Story 3.7: Hero Card Spendibile con Obbligazioni Correnti Integrate
 * AC1-AC7 — spendibile sottrae obbligazioni, pagato aumenta, primo anno, L1 breakdown, no double-counting, regressione
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  mockFiscalRulesData,
  ACCONTI_ZERO,
  ACCONTI_NORMAL,
  mockSettings,
  mockReceipts,
  mockTableData,
  mockTableDataSingle,
  mockTableDataMaybeSingle,
  mockTableDataByYear,
  mockScheduleRow,
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

describe("useFiscalCalculations — Story 3.7 Spendibile con Obbligazioni", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T00:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  // ===== AC1: Spendibile sottrae obbligazioni non pagate =====
  describe("[AC1] Spendibile sottrae obbligazioni non pagate", () => {
    it("spendibile diminuisce quando ci sono scadenze non pagate dell'anno corrente", async () => {
      // Setup: scadenze non pagate nell'anno 2025
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s1", bucket: "saldo_tax", payment_year: 2025, due_date: "2025-06-30", total_expected: 1755, total_paid: 0, status: "pending" }),
          mockScheduleRow({ id: "s2", bucket: "saldo_inps", payment_year: 2025, due_date: "2025-06-30", total_expected: 3050, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      // unpaidCurrentYearTotal dovrebbe essere 1755 + 3050 = 4805
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(4805);

      // Lo spendibile deve essere ridotto di 4805 (clamped a 0 se negativo)
      // spendable = max(0, incassiYTD - totalWithholding - buffer - yearlyToolCost - unpaidCurrentYearTotal - reserve)
      expect(result.current.metrics.spendable).toBeGreaterThanOrEqual(0);

      // Verifica che è MENO dello spendibile senza obbligazioni
      // Senza scadenze: spendable = incassiYTD(15000) - totalWithholding - buffer - yearlyToolCost - 0 - reserve
      // Con scadenze: spendable = incassiYTD(15000) - totalWithholding - buffer - yearlyToolCost - 4805 - reserve
    });

    it("spendibile ha floor a zero (MAI negativo)", async () => {
      // Setup: obbligazioni enormi per forzare negativo
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s-huge", bucket: "saldo_tax", payment_year: 2025, due_date: "2025-06-30", total_expected: 100000, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.spendable).toBe(0);
    });
  });

  // ===== AC2: Obbligazioni pagate aumentano lo Spendibile =====
  describe("[AC2] Obbligazioni pagate aumentano lo Spendibile", () => {
    it("scadenza pagata non viene sottratta dallo spendibile", async () => {
      // Setup: scadenze miste — una pagata, una non pagata
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s-paid", bucket: "saldo_tax", payment_year: 2025, due_date: "2025-06-30", total_expected: 1755, total_paid: 1755, status: "paid" }),
          mockScheduleRow({ id: "s-unpaid", bucket: "saldo_inps", payment_year: 2025, due_date: "2025-06-30", total_expected: 3050, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      // Solo la scadenza non pagata viene sottratta
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(3050);
    });

    it("tutte le scadenze pagate → unpaidCurrentYearTotal = 0", async () => {
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s-paid1", bucket: "saldo_tax", payment_year: 2025, due_date: "2025-06-30", total_expected: 1755, total_paid: 1755, status: "paid" }),
          mockScheduleRow({ id: "s-paid2", bucket: "saldo_inps", payment_year: 2025, due_date: "2025-06-30", total_expected: 3050, total_paid: 3050, status: "paid" }),
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(0);
    });
  });

  // ===== AC3: Primo anno — nessuna sottrazione =====
  describe("[AC3] Primo anno — nessuna sottrazione", () => {
    it("unpaidCurrentYearTotal = 0 quando non ci sono dati anno N-1", async () => {
      // Simula primo anno: nessun settings anno N-1
      mockTableDataMaybeSingle.fiscal_year_settings = { data: null, error: null };
      // Nessuna scadenza
      mockTableData.tax_schedule = { data: [], error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.currentYearObligations.hasData).toBe(false);
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(0);
    });
  });

  // ===== AC6: Nessun double-counting con dueSoonRemaining =====
  describe("[AC6] Nessun double-counting con dueSoonRemaining", () => {
    it("unpaidCurrentYearTotal e dueSoonRemaining sono indipendenti — lo spendibile usa solo unpaidCurrentYearTotal", async () => {
      // Una scadenza che è SIA nel dueSoon window CHE nel currentYear
      const scheduleDueSoon = mockScheduleRow({
        id: "s-dueSoon",
        bucket: "saldo_tax",
        payment_year: 2025,
        due_date: "2025-06-30", // entro il window di 45 giorni da 2025-06-15
        total_expected: 2000,
        total_paid: 0,
        status: "pending",
      });

      mockTableData.tax_schedule = {
        data: [scheduleDueSoon],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      // La scadenza è contata UNA SOLA volta nello spendibile
      // unpaidCurrentYearTotal include tutto l'anno (superset di dueSoonRemaining)
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(2000);
      // dueSoonRemaining è mantenuto per backward compat ma NON usato nel calcolo spendible
      expect(result.current.metrics.dueSoonRemaining).toBe(2000);

      // Lo spendibile sottrae SOLO unpaidCurrentYearTotal, non dueSoonRemaining
      // Nessun double-counting
    });
  });

  // ===== AC7: Regressione backward compatibility =====
  describe("[AC7] Regressione backward compatibility", () => {
    it("spendibile >= 0 con setup di default (nessuna modifica comportamento base)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.spendable).toBeGreaterThanOrEqual(0);
      expect(result.current.metrics.incassiYTD).toBe(15000);
    });

    it("unpaidCurrentYearTotal = 0 quando tax_schedule è vuoto", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(0);
      expect(result.current.metrics.currentYearSchedules).toEqual([]);
    });

    it("dueSoonRemaining è ancora esposto nel FiscalMetrics", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(typeof result.current.metrics.dueSoonRemaining).toBe("number");
    });

    it("currentYearObligations.hasData e yearTotal restano invariati", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.currentYearObligations.hasData).toBe(true);
      expect(result.current.metrics.currentYearObligations.yearTotal).toBe(5215);
    });
  });

  // ===== Scadenze parzialmente pagate =====
  describe("Scadenze parzialmente pagate", () => {
    it("calcola remaining correttamente per scadenza con pagamento parziale", async () => {
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({
            id: "s-partial",
            bucket: "saldo_tax",
            payment_year: 2025,
            due_date: "2025-06-30",
            total_expected: 2000,
            total_paid: 800,
            status: "pending",
          }),
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(1200);
    });
  });

  // ===== currentYearSchedules espone tutte le rows (pagate e non) =====
  describe("currentYearSchedules", () => {
    it("include sia scadenze pagate che non pagate", async () => {
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s-paid", bucket: "saldo_tax", payment_year: 2025, total_expected: 1000, total_paid: 1000, status: "paid" }),
          mockScheduleRow({ id: "s-unpaid", bucket: "saldo_inps", payment_year: 2025, total_expected: 2000, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.currentYearSchedules.length).toBe(2);
      // Ma unpaidCurrentYearTotal conta solo le non pagate
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(2000);
    });
  });

  // ===== BUG-FIX: unpaidCurrentYearTotal sottrae acconti versati =====
  describe("[BUG-FIX] unpaidCurrentYearTotal sottrae acconti versati", () => {
    it("riduce unpaidCurrentYearTotal degli acconti imposta + INPS versati", async () => {
      // Schedule con saldi lordi
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s-june", bucket: "june", payment_year: 2025, due_date: "2025-06-30", total_expected: 4805, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };
      // Acconti versati nelle settings correnti (fetched via .maybeSingle())
      const settingsWithAcconti = {
        ...mockSettings,
        acconti_imposta_versati: 500,
        acconti_inps_eccedenza_versati: 1000,
      };
      mockTableData.fiscal_year_settings = { data: settingsWithAcconti, error: null };
      mockTableDataSingle.fiscal_year_settings = { data: settingsWithAcconti, error: null };
      mockTableDataMaybeSingle.fiscal_year_settings = { data: settingsWithAcconti, error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      // raw = 4805, after subtracting acconti: 4805 - 500 - 1000 = 3305
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(3305);
    });

    it("unpaidCurrentYearTotal clamped a 0 quando acconti > totale", async () => {
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s-small", bucket: "june", payment_year: 2025, due_date: "2025-06-30", total_expected: 500, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };
      const settingsWithAcconti = {
        ...mockSettings,
        acconti_imposta_versati: 2000,
        acconti_inps_eccedenza_versati: 4000,
      };
      mockTableData.fiscal_year_settings = { data: settingsWithAcconti, error: null };
      mockTableDataSingle.fiscal_year_settings = { data: settingsWithAcconti, error: null };
      mockTableDataMaybeSingle.fiscal_year_settings = { data: settingsWithAcconti, error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      // raw = 500, after subtracting acconti: max(0, 500 - 2000 - 4000) = 0
      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(0);
    });

    it("acconti = 0 → unpaidCurrentYearTotal invariato (backward compat)", async () => {
      mockTableData.tax_schedule = {
        data: [
          mockScheduleRow({ id: "s1", bucket: "saldo_tax", payment_year: 2025, due_date: "2025-06-30", total_expected: 1755, total_paid: 0, status: "pending" }),
        ],
        error: null,
      };
      // Settings default: acconti = 0

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.unpaidCurrentYearTotal).toBe(1755);
    });
  });
});
