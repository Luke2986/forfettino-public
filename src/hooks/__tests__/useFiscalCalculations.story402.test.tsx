/**
 * Story 40-2: Test calcolo INPS reale Art/Comm — daCopireAmount, deducibilità, spendibile
 *
 * Scenari:
 *   1. Artigiani reddito sotto minimale (€10k) → variabile = 0, daCopireAmount = solo imposta
 *   2. Artigiani reddito sopra minimale (€50k) → variabile > 0, daCopireAmount = imposta + variabile
 *   3. Separata regressione → daCopireAmount = totalWithholding invariato
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
  createChain,
  createWrapper,
  setupDefaultMocks,
} from "./useFiscalCalculations.setup";

// Dynamic mock for calcTotaleMultiGestione — returns different values based on gestione param
const mockCalcTotaleMultiGestione = vi.fn();

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
    calcTotaleMultiGestione: (...args: unknown[]) => mockCalcTotaleMultiGestione(...args),
    calcMinimaleArtigiani: () => 0,
    calcMinimaleCommercianti: () => 0,
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn((table: string) => createChain(table)) },
}));

import { useFiscalCalculations } from "../useFiscalCalculations";
import { sumMoney } from "@/lib/money";

// ===== Helper: setup settings for Art/Comm =====
function setArtigiani(receiptsAmount: number) {
  const settingsArtigiani = {
    ...mockSettings,
    inps_management: "artigiani",
    inps_rate: 24.0, // non usata per Art/Comm ma mantenuta per coerenza
  };
  const receipts = receiptsAmount > 0
    ? [{ ...mockReceipts[0], gross_amount: receiptsAmount }]
    : [];

  mockTableData.fiscal_year_settings = { data: settingsArtigiani, error: null };
  mockTableData.receipts = { data: receipts, error: null };
  mockTableDataSingle.fiscal_year_settings = { data: settingsArtigiani, error: null };
  mockTableDataMaybeSingle.fiscal_year_settings = { data: { ...settingsArtigiani, fiscal_year: 2024, anno_apertura_piva: 2020 }, error: null };
}

describe("useFiscalCalculations — Story 40-2 Art/Comm INPS reale", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    vi.clearAllMocks();
    setupDefaultMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

  describe("Artigiani reddito sotto minimale (€10k, coeff 78%)", () => {
    // reddito = 10000 * 78% = 7800 < minimale 18415 → variabile = 0
    // minimale annuo = 4427.04, INPS totale = 4427.04
    // imposta con deducibilità: (7800 - 4427.04) * 15% = 505.94
    const IMPOSTA = 506; // arrotondamento centesimale tipico del fiscal-engine
    const INPS_MINIMALE = 4427;
    const INPS_VARIABILE = 0;
    const INPS_TOTALE = 4427;

    beforeEach(() => {
      setArtigiani(10000);
      mockCalcTotaleMultiGestione.mockReturnValue({
        imponibileLordo: 7800,
        contributiINPS: INPS_TOTALE,
        imponibileNetto: 3373,
        imposta: IMPOSTA,
        totaleAccantonamento: IMPOSTA + INPS_TOTALE,
        dettaglioINPS: {
          gestione: "artigiani",
          result: {
            minimaleAnnuo: INPS_MINIMALE,
            variabile: INPS_VARIABILE,
            totale: INPS_TOTALE,
            aliquotaApplicata: 24.0,
            aliquotaApplicataAlta: 25.0,
          },
        },
      });
    });

    it("daCopireAmount = solo imposta (variabile è 0)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.daCopireAmount).toBe(sumMoney(IMPOSTA, INPS_VARIABILE));
      expect(result.current.metrics.daCopireAmount).toBe(IMPOSTA); // variabile=0, so just imposta
    });

    it("impostaConDeducibilita riflette deducibilità INPS", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.impostaConDeducibilita).toBe(IMPOSTA);
      // imposta flat (senza deducibilità) sarebbe più alta
      expect(result.current.metrics.impostaConDeducibilita).toBeLessThan(result.current.metrics.taxAmount);
    });

    it("inpsMinimale è popolato, inpsVariabile è 0", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.inpsMinimale).toBe(INPS_MINIMALE);
      expect(result.current.metrics.inpsVariabile).toBe(0);
      expect(result.current.metrics.inpsTotale).toBe(INPS_TOTALE);
    });

    it("spendibile usa daCopireAmount (non totalWithholding)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const m = result.current.metrics;
      // spendibile = incassi - daCopireAmount - buffer - yearlyToolCost - dueSoonRemaining + saldoInizialeCC
      // Non verifichiamo la formula esatta, ma che NON usi totalWithholding
      // totalWithholding = taxAmount + inpsAmount (flat), daCopireAmount = imposta + variabile (reale)
      expect(m.daCopireAmount).not.toBe(m.totalWithholding);
      expect(m.spendable).toBeGreaterThan(0);
    });
  });

  describe("Artigiani reddito sopra minimale (€50k, coeff 78%)", () => {
    // reddito = 50000 * 78% = 39000 > minimale 18415 → variabile > 0
    const IMPOSTA = 4917; // con deducibilità INPS
    const INPS_MINIMALE = 4427;
    const INPS_VARIABILE = 4940; // variabile su eccedenza
    const INPS_TOTALE = 9367;

    beforeEach(() => {
      setArtigiani(50000);
      mockCalcTotaleMultiGestione.mockReturnValue({
        imponibileLordo: 39000,
        contributiINPS: INPS_TOTALE,
        imponibileNetto: 29633,
        imposta: IMPOSTA,
        totaleAccantonamento: IMPOSTA + INPS_TOTALE,
        dettaglioINPS: {
          gestione: "artigiani",
          result: {
            minimaleAnnuo: INPS_MINIMALE,
            variabile: INPS_VARIABILE,
            totale: INPS_TOTALE,
            aliquotaApplicata: 24.0,
            aliquotaApplicataAlta: 25.0,
          },
        },
      });
    });

    it("daCopireAmount = imposta + variabile (escluso minimale)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.daCopireAmount).toBe(sumMoney(IMPOSTA, INPS_VARIABILE));
      // Must exclude minimale
      expect(result.current.metrics.daCopireAmount).toBeLessThan(sumMoney(IMPOSTA, INPS_TOTALE));
    });

    it("inpsVariabile > 0 quando reddito sopra minimale", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.inpsVariabile).toBe(INPS_VARIABILE);
      expect(result.current.metrics.inpsVariabile).toBeGreaterThan(0);
    });

    it("inpsTotale = minimale + variabile", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      expect(result.current.metrics.inpsTotale).toBe(INPS_TOTALE);
      expect(result.current.metrics.inpsMinimale).toBe(INPS_MINIMALE);
    });

    it("calcTotaleMultiGestione viene invocato con parametri corretti", async () => {
      renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(mockCalcTotaleMultiGestione).toHaveBeenCalled(); });

      // Fix F1: la funzione gira anche sui render intermedi (default "separata",
      // incassi 0) prima che settings/receipts siano caricati. Selezioniamo la
      // chiamata "a regime" — gestione artigiani con incassi pieni — invece di [0].
      const call = await waitFor(() => {
        const c = mockCalcTotaleMultiGestione.mock.calls.find(
          (x) => x[2] === "artigiani" && x[0] === 50000,
        );
        expect(c).toBeDefined();
        return c!;
      });
      expect(call[0]).toBe(50000); // incassiYTD
      expect(call[1]).toBe(78); // profitCoeff
      expect(call[2]).toBe("artigiani"); // gestione
      expect(call[4]).toBe(15); // aliquota sostitutiva
      expect(call[5]).toBe(false); // riduzione35
      expect(call[6]).toBe(false); // riduzione50
    });
  });

  describe("Separata — Fix F1: deducibilità INPS applicata", () => {
    beforeEach(() => {
      // Default mocks already use separata management
      setupDefaultMocks();
      // Fix F1: calcTotaleMultiGestione("separata") ritorna imposta NETTA (deducibilità).
      // imponibileLordo 11700, INPS 3050, netto 8650, imposta = 8650 × 15% = 1297.5
      mockCalcTotaleMultiGestione.mockReturnValue({
        imponibileLordo: 11700,
        contributiINPS: 3050,
        imponibileNetto: 8650,
        imposta: 1297.5,
        totaleAccantonamento: 4347.5,
        dettaglioINPS: { gestione: "separata", inps: 3050 },
      });
    });

    it("daCopireAmount = imposta(deducibilità) + INPS totale (NON più il lordo)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const m = result.current.metrics;
      expect(m.daCopireAmount).toBeCloseTo(sumMoney(m.impostaConDeducibilita, m.inpsTotale), 2);
      expect(m.daCopireAmount).toBeCloseTo(4347.5, 2);
      // Regressione invertita: il "da coprire" netto è MINORE del lordo (imposta lorda + INPS)
      expect(m.daCopireAmount).toBeLessThan(m.totalWithholding);
    });

    it("imposta sostitutiva applica la deducibilità INPS (< imposta lorda)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const m = result.current.metrics;
      expect(m.impostaConDeducibilita).toBeCloseTo(1297.5, 2);
      // Deducibilità ⇒ imposta netta < imposta lorda (taxAmount = imponibile × aliquota)
      expect(m.impostaConDeducibilita).toBeLessThan(m.taxAmount);
      // INPS variabile/minimale restano 0 per Separata (nessuna doppia fascia)
      expect(m.inpsVariabile).toBe(0);
      expect(m.inpsMinimale).toBe(0);
      // inpsTotale = contributi del motore (capped al massimale)
      expect(m.inpsTotale).toBe(3050);
    });

    it("calcTotaleMultiGestione È invocato anche per Separata (Fix F1)", async () => {
      renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(mockCalcTotaleMultiGestione).toHaveBeenCalled(); });

      // Esiste almeno una chiamata con gestione = "separata" (path anno corrente)
      const sepCall = mockCalcTotaleMultiGestione.mock.calls.find((c) => c[2] === "separata");
      expect(sepCall).toBeDefined();
      expect(sepCall?.[4]).toBe(15); // aliquota sostitutiva
    });

    it("spendibile usa daCopireAmount netto (formula invariata)", async () => {
      const { result } = renderHook(() => useFiscalCalculations(), { wrapper: createWrapper() });
      await waitFor(() => { expect(result.current.isLoading).toBe(false); });

      const m = result.current.metrics;
      // spendibile = incassi - daCopireAmount - buffer - yearlyToolCost - dueSoonRemaining + saldoInizialeCC
      const expectedSpendable = m.incassiYTD - m.daCopireAmount - m.bufferAmount - m.yearlyToolCost - m.dueSoonRemaining + m.saldoInizialeCC;
      expect(m.spendable).toBeCloseTo(expectedSpendable, 2);
    });
  });
});
