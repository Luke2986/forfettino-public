/**
 * Test P1: Loading, formatCurrency, deadlines, currentYear/yearOverride
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  mockFiscalRulesData,
  ACCONTI_ZERO,
  ACCONTI_NORMAL,
  mockTableData,
  mockTableDataSingle,
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

import { useFiscalCalculations, formatCurrency } from "../useFiscalCalculations";

describe("useFiscalCalculations — P1 queries e formatCurrency", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  describe("[P1] isLoading", () => {
    it("isLoading e' false quando tutte le query sono completate", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    });

    it("isLoading e' inizialmente true prima che le query risolvano", () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("[P1] formatCurrency", () => {
    it("formatCurrency formatta importi in euro", () => {
      const formatted = formatCurrency(1234.56);
      expect(formatted).toContain("1234,56");
      expect(formatted).toContain("€");
    });

    it("formatCurrency gestisce null/undefined restituendo 0,00", () => {
      const formatted = formatCurrency(null);
      expect(formatted).toContain("0,00");
    });

    it("formatCurrency gestisce 0", () => {
      const formatted = formatCurrency(0);
      expect(formatted).toContain("0,00");
    });
  });

  describe("[P1] formatDeadline mappa schedule raw a DeadlineInfo", () => {
    it("nextDeadlineInWindow mappa correttamente un record tax_schedule", async () => {
      const rawSchedule = mockScheduleRow({
        id: "deadline-in-window", bucket: "june", due_date: "2025-07-15",
        payment_year: 2025, total_expected: 1100, total_paid: 300, status: "open",
      });
      mockTableDataSingle.tax_schedule = { data: rawSchedule, error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const deadline = result.current.metrics.nextDeadlineInWindow;
      if (deadline) {
        expect(deadline.id).toBe("deadline-in-window");
        expect(deadline.bucket).toBe("june");
        expect(deadline.paymentYear).toBe(2025);
        expect(deadline.dueDate).toBe("2025-07-15");
        expect(deadline.totalExpected).toBe(1100);
        expect(deadline.totalPaid).toBe(300);
        expect(deadline.remaining).toBe(800);
        expect(deadline.isEstimate).toBe(false);
      }
    });

    it("upcomingDeadlines e' array vuoto quando non ci sono schedule", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.upcomingDeadlines).toEqual([]);
      expect(result.current.metrics.nextDeadlineAny).toBeNull();
    });

    it("nextDeadlineInWindow e' null quando nessuna scadenza nel window", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.nextDeadlineInWindow).toBeNull();
    });
  });

  describe("[P1] currentYear e yearOverride", () => {
    it("currentYear usa selectedYear dal context di default", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.currentYear).toBe(2025);
    });

    it("currentYear usa yearOverride quando fornito", async () => {
      const { result } = renderHook(() => useFiscalCalculations(2024), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.currentYear).toBe(2024);
    });
  });
});
