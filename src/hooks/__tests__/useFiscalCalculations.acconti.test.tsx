/**
 * Test Story 11.1: Acconti Già Versati e Saldo Netto
 *
 * Copertura:
 * - Saldo netto positivo (acconti < imposta dovuta)
 * - Saldo netto zero (acconti == imposta dovuta)
 * - Credito imposta (acconti > imposta dovuta)
 * - Acconti INPS parziali
 * - Acconti INPS a credito
 * - Acconti zero (backward compatible — nessuna regressione)
 * - Primo anno (nessun acconto da dichiarare)
 * - Combinazione imposta + INPS
 *
 * Valori base (da mock default):
 * - taxAmount = 1755 (15% di 11700), inpsAmount = 3050.19 (26.07% di 11700)
 * - fiscalPeak: saldoTax=1755, saldoInps=3050.19
 * - currentYearObligations: saldoTaxPrevYear=1755, saldoInpsPrevYear=3050 (mock calcTotaleMultiGestione)
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

describe("useFiscalCalculations — Story 11.1 Acconti Già Versati", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  // ── Helper per override acconti nei settings correnti ──
  function setAcconti(imposta: number, inps: number) {
    const settingsWithAcconti = {
      ...mockSettings,
      acconti_imposta_versati: imposta,
      acconti_inps_eccedenza_versati: inps,
    };
    mockTableData.fiscal_year_settings = { data: settingsWithAcconti, error: null };
    mockTableDataSingle.fiscal_year_settings = { data: settingsWithAcconti, error: null };
  }

  // ================================================================
  // SEZIONE A: fiscalPeak (proiezioni anno N → pagamento N+1)
  // saldoTax = 1755, saldoInps = 3050.19
  // ================================================================

  describe("[fiscalPeak] Acconti zero — backward compatible", () => {
    it("saldoTaxNetto = saldoTax quando acconti = 0", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.accontiImpostaVersati).toBe(0);
      expect(fp.accontiInpsVersati).toBe(0);
      expect(fp.saldoTaxNetto).toBe(fp.saldoTax);
      expect(fp.saldoInpsNetto).toBe(fp.saldoInps);
      expect(fp.creditoImposta).toBe(0);
      expect(fp.creditoInps).toBe(0);
    });

    it("juneTotal invariato quando acconti = 0", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      // juneTotal = saldoTax(1755) + saldoInps(3050.19) + accontoTax1(100) + accontoInps1(80)
      expect(fp.juneTotal).toBeCloseTo(4985.19, 2);
    });
  });

  describe("[fiscalPeak] Saldo netto positivo (acconti < imposta)", () => {
    it("saldoTaxNetto = saldoTax - acconti quando acconti < saldoTax", async () => {
      setAcconti(500, 0);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.saldoTax).toBe(1755);
      expect(fp.accontiImpostaVersati).toBe(500);
      expect(fp.saldoTaxNetto).toBe(1255);
      expect(fp.creditoImposta).toBe(0);
    });

    it("juneTotal ridotto dagli acconti imposta", async () => {
      setAcconti(500, 0);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      // juneTotal = saldoTaxNetto(1255) + saldoInpsNetto(3050.19) + accontoTax1(100) + accontoInps1(80)
      expect(fp.juneTotal).toBeCloseTo(4485.19, 2);
    });
  });

  describe("[fiscalPeak] Saldo netto zero (acconti == imposta)", () => {
    it("saldoTaxNetto = 0 e creditoImposta = 0 quando acconti == saldoTax", async () => {
      setAcconti(1755, 0);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.saldoTaxNetto).toBe(0);
      expect(fp.creditoImposta).toBe(0);
    });
  });

  describe("[fiscalPeak] Credito imposta (acconti > imposta)", () => {
    it("saldoTaxNetto = 0 e creditoImposta > 0 quando acconti > saldoTax", async () => {
      setAcconti(2000, 0);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.saldoTaxNetto).toBe(0);
      expect(fp.creditoImposta).toBe(245);
    });
  });

  describe("[fiscalPeak] Acconti INPS parziali", () => {
    it("saldoInpsNetto = saldoInps - acconti quando acconti < saldoInps", async () => {
      setAcconti(0, 1000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.saldoInps).toBeCloseTo(3050.19, 2);
      expect(fp.accontiInpsVersati).toBe(1000);
      expect(fp.saldoInpsNetto).toBeCloseTo(2050.19, 2);
      expect(fp.creditoInps).toBe(0);
    });
  });

  describe("[fiscalPeak] Acconti INPS a credito", () => {
    it("saldoInpsNetto = 0 e creditoInps > 0 quando acconti > saldoInps", async () => {
      setAcconti(0, 4000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.saldoInpsNetto).toBe(0);
      expect(fp.creditoInps).toBeCloseTo(949.81, 2);
    });
  });

  describe("[fiscalPeak] Combinazione imposta + INPS", () => {
    it("entrambi i saldi netti ridotti e juneTotal corretto", async () => {
      setAcconti(500, 1000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const fp = result.current.metrics.fiscalPeak;
      expect(fp.saldoTaxNetto).toBe(1255);
      expect(fp.saldoInpsNetto).toBeCloseTo(2050.19, 2);
      expect(fp.creditoImposta).toBe(0);
      expect(fp.creditoInps).toBe(0);
      // juneTotal = 1255 + 2050.19 + 100 + 80 = 3485.19
      expect(fp.juneTotal).toBeCloseTo(3485.19, 2);
      // novemberTotal invariato (non affetto da acconti versati)
      expect(fp.novemberTotal).toBe(230);
    });
  });

  // ================================================================
  // SEZIONE B: currentYearObligations (reddito N-1 → pagamento N)
  // saldoTaxPrevYear = 1755, saldoInpsPrevYear = 3050 (mock calcTotaleMultiGestione)
  // ================================================================

  describe("[currentYearObligations] Acconti zero — backward compatible", () => {
    it("saldo netto = saldo lordo quando acconti = 0", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.accontiImpostaVersati).toBe(0);
      expect(obl.accontiInpsVersati).toBe(0);
      expect(obl.saldoTaxNettoAnnoN).toBe(obl.saldoTaxPrevYear);
      expect(obl.saldoInpsNettoAnnoN).toBe(obl.saldoInpsPrevYear);
      expect(obl.creditoImposta).toBe(0);
      expect(obl.creditoInps).toBe(0);
      // juneTotal invariato rispetto a prima di Story 11.1
      expect(obl.juneTotal).toBe(4985);
    });
  });

  describe("[currentYearObligations] Saldo netto positivo", () => {
    it("saldoTaxNettoAnnoN = saldoTaxPrevYear - acconti", async () => {
      setAcconti(500, 0);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.saldoTaxPrevYear).toBe(1755);
      expect(obl.accontiImpostaVersati).toBe(500);
      expect(obl.saldoTaxNettoAnnoN).toBe(1255);
      expect(obl.creditoImposta).toBe(0);
      // juneTotal ridotto: 1255 + 3050 + 100 + 80 = 4485
      expect(obl.juneTotal).toBe(4485);
    });
  });

  describe("[currentYearObligations] Credito imposta", () => {
    it("saldoTaxNettoAnnoN = 0 e creditoImposta > 0 quando acconti > imposta dovuta", async () => {
      setAcconti(2000, 0);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.saldoTaxNettoAnnoN).toBe(0);
      expect(obl.creditoImposta).toBe(245);
      // juneTotal: 0 + 3050 + 100 + 80 = 3230
      expect(obl.juneTotal).toBe(3230);
    });
  });

  describe("[currentYearObligations] Acconti INPS parziali", () => {
    it("saldoInpsNettoAnnoN ridotto, creditoInps = 0", async () => {
      setAcconti(0, 1000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.saldoInpsPrevYear).toBe(3050);
      expect(obl.saldoInpsNettoAnnoN).toBe(2050);
      expect(obl.creditoInps).toBe(0);
      // juneTotal: 1755 + 2050 + 100 + 80 = 3985
      expect(obl.juneTotal).toBe(3985);
    });
  });

  describe("[currentYearObligations] Acconti INPS a credito", () => {
    it("saldoInpsNettoAnnoN = 0 e creditoInps > 0", async () => {
      setAcconti(0, 4000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.saldoInpsNettoAnnoN).toBe(0);
      expect(obl.creditoInps).toBe(950);
      // juneTotal: 1755 + 0 + 100 + 80 = 1935
      expect(obl.juneTotal).toBe(1935);
    });
  });

  describe("[currentYearObligations] Combinazione imposta + INPS", () => {
    it("entrambi saldi netti ridotti, yearTotal corretto", async () => {
      setAcconti(500, 1000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.saldoTaxNettoAnnoN).toBe(1255);
      expect(obl.saldoInpsNettoAnnoN).toBe(2050);
      // juneTotal: 1255 + 2050 + 100 + 80 = 3485
      expect(obl.juneTotal).toBe(3485);
      // novemberTotal invariato
      expect(obl.novemberTotal).toBe(230);
      // yearTotal = juneTotal + novemberTotal + rateInpsFisse(0)
      expect(obl.yearTotal).toBe(3715);
    });
  });

  describe("[currentYearObligations] Nessun dato anno N-1", () => {
    it("tutti i campi acconti sono zero quando hasData = false", async () => {
      mockTableDataMaybeSingle.fiscal_year_settings = { data: null, error: null };
      setAcconti(500, 1000); // acconti impostati ma irrilevanti senza dati N-1
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      const obl = result.current.metrics.currentYearObligations;
      expect(obl.hasData).toBe(false);
      expect(obl.accontiImpostaVersati).toBe(0);
      expect(obl.accontiInpsVersati).toBe(0);
      expect(obl.saldoTaxNettoAnnoN).toBe(0);
      expect(obl.saldoInpsNettoAnnoN).toBe(0);
      expect(obl.creditoImposta).toBe(0);
      expect(obl.creditoInps).toBe(0);
    });
  });

  // ================================================================
  // SEZIONE C: novemberTotal non affetto da acconti versati
  // ================================================================

  describe("novemberTotal non affetto da acconti versati", () => {
    it("[fiscalPeak] novemberTotal invariato anche con acconti alti", async () => {
      setAcconti(2000, 4000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.fiscalPeak.novemberTotal).toBe(230);
    });

    it("[currentYearObligations] novemberTotal invariato anche con acconti alti", async () => {
      setAcconti(2000, 4000);
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });
      expect(result.current.metrics.currentYearObligations.novemberTotal).toBe(230);
    });
  });
});
