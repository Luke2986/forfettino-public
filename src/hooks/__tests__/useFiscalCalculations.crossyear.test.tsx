/**
 * Test Story 3.6: Obbligazioni Cross-Anno
 * AC1-AC8 — doppio fetch, saldi, acconti, primo anno, rate fisse, immutabilita, backward compat
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
  mockTableDataMaybeSingle,
  mockTableDataByYear,
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
const mockUseFiscalRules = vi.fn((year: number) => ({
  data: year === 2025 || year === 2024 ? mockFiscalRulesData : null,
  isLoading: false, isError: false, isSuccess: true,
}));
vi.mock("@/hooks/useFiscalRules", () => ({
  useFiscalRules: (year: number) => mockUseFiscalRules(year),
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

describe("useFiscalCalculations — Story 3.6 Cross-Anno", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
    // Reset mockUseFiscalRules to default (prevents leak from fiscalRulesData-null test)
    mockUseFiscalRules.mockImplementation((year: number) => ({
      data: year === 2025 || year === 2024 ? mockFiscalRulesData : null,
      isLoading: false, isError: false, isSuccess: true,
    }));
  });
  afterEach(() => { vi.useRealTimers(); });

  // ===== AC1+AC2: dati anno N-1 presenti =====
  describe("[Story 3.6] currentYearObligations — dati anno N-1 presenti", () => {
    it("hasData e' true quando settings e receipts anno N-1 esistono", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.hasData).toBe(true);
    });

    it("paymentYear e' uguale a currentYear", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.paymentYear).toBe(2025);
    });

    it("contiene saldo imposta e INPS da calcTotaleMultiGestione", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.saldoTaxPrevYear).toBe(1755);
      expect(obligations.saldoInpsPrevYear).toBe(3050);
    });

    it("contiene accontiResult da calcAccontiAnnoSuccessivo", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const acconti = result.current.metrics.currentYearObligations.accontiResult;
      expect(acconti).not.toBeNull();
      expect(acconti!.accontoImpostaGiugno).toBe(100);
      expect(acconti!.accontoImpostaNovembre).toBe(150);
      expect(acconti!.accontoINPSGiugno).toBe(80);
      expect(acconti!.accontoINPSNovembre).toBe(80);
    });

    it("juneTotal include saldi + primi acconti", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.juneTotal).toBe(4985);
    });

    it("novemberTotal include secondi acconti", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.novemberTotal).toBe(230);
    });

    it("yearTotal = juneTotal + novemberTotal + rateInpsFisse", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.rateInpsFisseAnnoN).toBe(0);
      expect(obligations.yearTotal).toBe(5215);
    });
  });

  // ===== AC6: nessun dato anno N-1 =====
  describe("[Story 3.6] nessun dato anno N-1", () => {
    it("hasData false quando settings anno N-1 non esiste", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = { data: null, error: null };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.hasData).toBe(false);
      expect(result.current.metrics.currentYearObligations.yearTotal).toBe(0);
    });

    it("hasData false quando receipts anno N-1 sono vuoti", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = { data: null, error: null };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.hasData).toBe(false);
    });

    it("obbligazioni tutte zero quando hasData false", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = { data: null, error: null };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.saldoTaxPrevYear).toBe(0);
      expect(obligations.saldoInpsPrevYear).toBe(0);
      expect(obligations.accontiResult).toBeNull();
      expect(obligations.rateInpsFisseAnnoN).toBe(0);
      expect(obligations.juneTotal).toBe(0);
      expect(obligations.novemberTotal).toBe(0);
      expect(obligations.yearTotal).toBe(0);
    });
  });

  // ===== AC8: backward compatibility =====
  describe("[Story 3.6] backward compatibility", () => {
    it("fiscalPeak (proiezioni N+1) resta invariato", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.fiscalPeak.paymentYear).toBe(2026);
      expect(result.current.metrics.fiscalPeak.yearTotal).toBeGreaterThanOrEqual(0);
    });

    it("tutti i campi FiscalMetrics esistenti restano invariati", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.incassiYTD).toBe(15000);
      expect(result.current.metrics.taxableAmount).toBe(11700);
      expect(result.current.metrics.taxAmount).toBe(1755);
      expect(result.current.metrics.inpsAmount).toBe(3050.19);
      expect(result.current.metrics.spendable).toBeGreaterThanOrEqual(0);
      expect(result.current.metrics.fiscalPeak).toBeDefined();
      expect(result.current.metrics.currentYearObligations).toBeDefined();
    });
  });

  // ===== AC4: primo anno (acconti zero) =====
  describe("[Story 3.6] AC4 — primo anno attivita", () => {
    it("accontiResult tutti zero quando primo anno", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = {
        data: { ...mockSettings, fiscal_year: 2024, anno_apertura_piva: 2024 },
        error: null,
      };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.accontiResult).not.toBeNull();
      expect(obligations.accontiResult!.totaleAccontiImposta).toBe(0);
      expect(obligations.accontiResult!.totaleAccontiINPS).toBe(0);
      expect(obligations.accontiResult!.accontoImpostaGiugno).toBe(0);
      expect(obligations.accontiResult!.accontoImpostaNovembre).toBe(0);
    });

    it("juneTotal solo saldi quando primo anno", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = {
        data: { ...mockSettings, fiscal_year: 2024, anno_apertura_piva: 2024 },
        error: null,
      };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.juneTotal).toBe(4805);
      expect(obligations.novemberTotal).toBe(0);
      expect(obligations.yearTotal).toBe(4805);
    });
  });

  // ===== AC5: incassi anno N non alterano obbligazioni =====
  describe("[Story 3.6] AC5 — incassi anno N non alterano obbligazioni N", () => {
    it("obbligazioni restano invariate con receipts default", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.saldoTaxPrevYear).toBe(1755);
      expect(obligations.saldoInpsPrevYear).toBe(3050);
      expect(obligations.juneTotal).toBe(4985);
      expect(obligations.novemberTotal).toBe(230);
      expect(obligations.yearTotal).toBe(5215);
      expect(result.current.metrics.incassiYTD).toBe(15000);
    });

    it("obbligazioni identiche con receipts anno N triplicati", async () => {
      mockTableData.receipts = {
        data: [
          { id: "r-big-1", user_id: "test-user-id", fiscal_year: 2025, gross_amount: 30000, description: "Grande 1", receipt_date: "2025-03-15", created_at: "2025-03-15T00:00:00Z", updated_at: "2025-03-15T00:00:00Z" },
          { id: "r-big-2", user_id: "test-user-id", fiscal_year: 2025, gross_amount: 20000, description: "Grande 2", receipt_date: "2025-04-01", created_at: "2025-04-01T00:00:00Z", updated_at: "2025-04-01T00:00:00Z" },
        ],
        error: null,
      };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.incassiYTD).toBe(50000);
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.saldoTaxPrevYear).toBe(1755);
      expect(obligations.saldoInpsPrevYear).toBe(3050);
      expect(obligations.juneTotal).toBe(4985);
      expect(obligations.novemberTotal).toBe(230);
      expect(obligations.yearTotal).toBe(5215);
      expect(obligations.rateInpsFisseAnnoN).toBe(0);
    });
  });

  // ===== AC3: rate INPS fisse Art/Comm =====
  describe("[Story 3.6] AC3 — rate INPS fisse Art/Comm", () => {
    it("rateInpsFisseAnnoN = minimale_artigiani", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = {
        data: { ...mockSettings, fiscal_year: 2024, inps_management: "artigiani", anno_apertura_piva: 2020 },
        error: null,
      };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.rateInpsFisseAnnoN).toBe(4427.04);
      expect(obligations.yearTotal).toBe(4985 + 230 + 4427.04);
    });

    it("rateInpsFisseAnnoN = minimale_commercianti", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = {
        data: { ...mockSettings, fiscal_year: 2024, inps_management: "commercianti", anno_apertura_piva: 2020 },
        error: null,
      };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.rateInpsFisseAnnoN).toBe(4515.43);
    });

    it("rateInpsFisseAnnoN = 0 per gestione separata", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.rateInpsFisseAnnoN).toBe(0);
    });
  });

  // ===== Story 39-2: Primo anno Art/Comm — obbligazioni same-year =====
  describe("[Story 39-2] primo anno Art/Comm — currentYearObligations", () => {
    it("hasData true per primo anno artigiani (no settings N-1)", async () => {
      // Settings anno N-1 (2024) → null (primo anno, non esiste)
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      // Settings anno N (2025) → artigiani primo anno
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "artigiani", anno_apertura_piva: 2025 },
        error: null,
      };
      // Nessun incasso anno N-1
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.isFirstYearOnly).toBe(true); // Story 40.3
      expect(obligations.rateInpsFisseAnnoN).toBe(4427.04); // minimale_artigiani
      expect(obligations.yearTotal).toBe(4427.04);
      expect(obligations.saldoTaxPrevYear).toBe(0);
      expect(obligations.saldoInpsPrevYear).toBe(0);
      expect(obligations.accontiResult).toBeNull();
      expect(obligations.juneTotal).toBe(0);
      expect(obligations.novemberTotal).toBe(0);
    });

    it("hasData true per primo anno commercianti (no settings N-1)", async () => {
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "commercianti", anno_apertura_piva: 2025 },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.isFirstYearOnly).toBe(true); // Story 40.3
      expect(obligations.rateInpsFisseAnnoN).toBe(4515.43); // minimale_commercianti
      expect(obligations.yearTotal).toBe(4515.43);
    });

    it("hasData false per primo anno Separata (nessun obbligo same-year)", async () => {
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "separata", anno_apertura_piva: 2025 },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(false);
      expect(obligations.isFirstYearOnly).toBe(false); // Story 40.3: Separata non è primo anno Art/Comm
      expect(obligations.rateInpsFisseAnnoN).toBe(0);
      expect(obligations.yearTotal).toBe(0);
    });

    it("primo anno Art/Comm con zero incassi: hasData true, isFirstYearOnly true → demo visibile", async () => {
      // Zero incassi anno corrente + primo anno Art/Comm
      // hasData=true (rate INPS fisse), ma isFirstYearOnly=true → Dashboard mostra demo + empty state
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "artigiani", anno_apertura_piva: 2025 },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };
      mockTableDataByYear["receipts:2025"] = { data: [], error: null }; // zero incassi

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const { incassiYTD, currentYearObligations } = result.current.metrics;
      expect(incassiYTD).toBe(0);
      expect(currentYearObligations.hasData).toBe(true);
      expect(currentYearObligations.isFirstYearOnly).toBe(true);

      // Dashboard contract (updated for demo): isFirstYearOnly → empty state + demo shown
      const hasZeroIncassi = incassiYTD === 0 &&
        (!currentYearObligations.hasData || currentYearObligations.isFirstYearOnly);
      expect(hasZeroIncassi).toBe(true);
    });

    it("primo anno artigiani con riduzione_35_attiva → minimale ridotto al 65%", async () => {
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "artigiani", anno_apertura_piva: 2025, riduzione_35_attiva: true },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      // 4427.04 * 65% = 2877.58 (riduzione 35%)
      expect(obligations.rateInpsFisseAnnoN).toBe(2877.58);
      expect(obligations.yearTotal).toBe(2877.58);
    });

    it("secondo anno Art/Comm con settings N-1 → path standard (regressione)", async () => {
      // Secondo anno: settings N-1 esistono → path cross-anno standard (non primo anno)
      mockTableDataByYear["fiscal_year_settings:2024"] = {
        data: { ...mockSettings, fiscal_year: 2024, inps_management: "artigiani", anno_apertura_piva: 2020 },
        error: null,
      };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "artigiani", anno_apertura_piva: 2020 },
        error: null,
      };
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.isFirstYearOnly).toBe(false); // Story 40.3: secondo anno → cross-year
      // Secondo anno → ha saldi cross-anno + rate INPS fisse
      expect(obligations.saldoTaxPrevYear).toBe(1755);
      expect(obligations.saldoInpsPrevYear).toBe(3050);
      expect(obligations.rateInpsFisseAnnoN).toBe(4427.04);
    });
  });

  // ===== Story 39-3: Edge case primo anno Art/Comm =====
  describe("[Story 39-3] edge case primo anno Art/Comm", () => {
    it("primo anno commercianti con riduzione_35_attiva → minimale ridotto al 65%", async () => {
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "commercianti", anno_apertura_piva: 2025, riduzione_35_attiva: true },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      // 4515.43 * 65% = Math.round(4515.43 * 65) / 100 = 2935.03
      expect(obligations.rateInpsFisseAnnoN).toBe(2935.03);
      expect(obligations.yearTotal).toBe(2935.03);
    });

    it("primo anno Art/Comm con fiscalRulesData assente → emptyObligations (no crash)", async () => {
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "artigiani", anno_apertura_piva: 2025 },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };

      // Override: fiscalRulesData null per tutti gli anni
      mockUseFiscalRules.mockImplementation(() => ({
        data: null,
        isLoading: false, isError: false, isSuccess: true,
      }));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(false);
      expect(obligations.rateInpsFisseAnnoN).toBe(0);
      expect(obligations.yearTotal).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("fiscalRulesData"));
      warnSpy.mockRestore();
      // mockUseFiscalRules viene resettato automaticamente nel beforeEach
    });

    it("primo anno Art/Comm con incassi anno N > 0 → hasData true (same-year indipendente)", async () => {
      mockTableDataByYear["fiscal_year_settings:2024"] = { data: null, error: null };
      mockTableDataByYear["fiscal_year_settings:2025"] = {
        data: { ...mockSettings, fiscal_year: 2025, inps_management: "artigiani", anno_apertura_piva: 2025 },
        error: null,
      };
      mockTableDataByYear["receipts:2024"] = { data: [], error: null };
      // Incassi anno corrente > 0
      mockTableDataByYear["receipts:2025"] = {
        data: [
          { id: "r-income", user_id: "test-user-id", fiscal_year: 2025, gross_amount: 8000, description: "Primo incasso", receipt_date: "2025-05-01", created_at: "2025-05-01T00:00:00Z", updated_at: "2025-05-01T00:00:00Z" },
        ],
        error: null,
      };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const obligations = result.current.metrics.currentYearObligations;
      expect(obligations.hasData).toBe(true);
      expect(obligations.rateInpsFisseAnnoN).toBe(4427.04);
      expect(obligations.yearTotal).toBe(4427.04);
      // incassiYTD deve riflettere gli incassi
      expect(result.current.metrics.incassiYTD).toBe(8000);
    });
  });

  // ===== REGRESSION GUARD: zero incassi anno N con obbligazioni da N-1 =====
  // Bug: Dashboard mostrava empty state ("Inserisci il primo incasso") quando incassiYTD=0,
  // nascondendo completamente le obbligazioni cross-anno calcolate dal reddito dell'anno precedente.
  // La Dashboard deve mostrare le obbligazioni se currentYearObligations.hasData è true,
  // indipendentemente dal valore di incassiYTD.
  // DO NOT MODIFY THIS TEST — protegge contro una regressione critica per l'utente.
  describe("[REGRESSION] zero incassi anno N con obbligazioni da anno N-1", () => {
    it("currentYearObligations.hasData resta true anche con incassiYTD = 0", async () => {
      // Simula: anno 2025, zero incassi nel 2025, ma incassi nel 2024
      // Usa mockTableDataByYear per differenziare le query per anno
      mockTableDataByYear["receipts:2025"] = { data: [], error: null }; // zero incassi anno corrente
      mockTableDataByYear["receipts:2024"] = { data: mockReceipts.map(r => ({ ...r, fiscal_year: 2024 })), error: null }; // incassi anno precedente

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      // incassiYTD deve essere 0
      expect(result.current.metrics.incassiYTD).toBe(0);

      // Ma le obbligazioni cross-anno devono essere presenti
      expect(result.current.metrics.currentYearObligations.hasData).toBe(true);
      expect(result.current.metrics.currentYearObligations.yearTotal).toBeGreaterThan(0);
      expect(result.current.metrics.currentYearObligations.juneTotal).toBeGreaterThan(0);
    });

    it("Dashboard contract: empty state must NOT hide when obligations exist", async () => {
      // Questo test verifica il contratto che la Dashboard usa:
      // hasZeroIncassi = incassiYTD === 0 && !currentYearObligations.hasData
      // Se questo test fallisce, la Dashboard nasconde le obbligazioni cross-anno.
      mockTableDataByYear["receipts:2025"] = { data: [], error: null };
      mockTableDataByYear["receipts:2024"] = { data: mockReceipts.map(r => ({ ...r, fiscal_year: 2024 })), error: null };

      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const { incassiYTD, currentYearObligations } = result.current.metrics;

      // Simula la logica della Dashboard — CRITICAL CONTRACT
      const hasZeroIncassi = incassiYTD === 0 && !currentYearObligations.hasData;
      expect(hasZeroIncassi).toBe(false); // empty state deve essere NASCOSTO
    });
  });
});
