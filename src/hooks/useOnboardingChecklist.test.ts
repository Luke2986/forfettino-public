import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOnboardingChecklist } from "./useOnboardingChecklist";

// Mock dependencies
vi.mock("./useProfile", () => ({
  useProfile: vi.fn(),
}));

vi.mock("./useFiscalCalculations", () => ({
  useFiscalCalculations: vi.fn(),
}));

import { useProfile } from "./useProfile";
import { useFiscalCalculations } from "./useFiscalCalculations";

const mockUseProfile = vi.mocked(useProfile);
const mockUseFiscalCalculations = vi.mocked(useFiscalCalculations);

// Helper to build a minimal metrics object
function buildMetrics(overrides: Record<string, unknown> = {}) {
  return {
    inpsManagement: "separata" as const,
    incassiYTD: 0,
    settings: {
      taxRate: 15,
      profitCoeff: 78,
      inpsRate: 26.07,
      safetyBuffer: 10,
      reserveAmount: 0,
      bufferBase: "receipts",
      deadlineWindowDays: 30,
    },
    taxableAmount: 0,
    taxAmount: 0,
    inpsAmount: 0,
    totalWithholding: 0,
    bufferAmount: 0,
    monthlyToolCost: 0,
    monthlyAccountantCost: 0,
    yearlyToolCost: 0,
    toolCostsYTD: 0,
    dueSoonRemaining: 0,
    spendable: 0,
    currentYearObligations: {
      saldoTaxPrevYear: 0,
      saldoInpsPrevYear: 0,
      accontiResult: null,
      rateInpsFisseAnnoN: 0,
      paymentYear: 2026,
      hasData: false,
      juneTotal: 0,
      novemberTotal: 0,
      yearTotal: 0,
    },
    fiscalPeak: {
      saldoTax: 0,
      saldoInps: 0,
      accontoTax1: 0,
      accontoTax2: 0,
      accontoTaxSingle: 0,
      accontoInps1: 0,
      accontoInps2: 0,
      juneTotal: 0,
      novemberTotal: 0,
      yearTotal: 0,
      paymentYear: 2027,
      isEstimate: true,
    },
    nextDeadlineInWindow: null,
    nextDeadlineAny: null,
    upcomingDeadlines: [],
    hasScheduleData: false,
    activeToolsCount: 0,
    expiredRatesCount: 0,
    bannerRateScaduteDismissed: false,
    unpaidCurrentYearTotal: 0,
    currentYearSchedules: [],
    unpaidSchedules30d: [],
    hasUnpaidOver30d: false,
    bannerFallbackCommercialistaDismissed: false,
    ...overrides,
  };
}

function setupMocks(opts: {
  profile?: {
    first_name: string | null;
    last_name: string | null;
    onboarding_completed: boolean;
  };
  metricsOverrides?: Record<string, unknown>;
  profileLoading?: boolean;
  metricsLoading?: boolean;
}) {
  mockUseProfile.mockReturnValue({
    data: opts.profile
      ? {
          id: "p1",
          user_id: "u1",
          user_code: "XA26TEST1",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          ...opts.profile,
        }
      : null,
    isLoading: opts.profileLoading ?? false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as any);

  mockUseFiscalCalculations.mockReturnValue({
    metrics: buildMetrics(opts.metricsOverrides ?? {}),
    isLoading: opts.metricsLoading ?? false,
    currentYear: 2026,
    refetch: vi.fn(),
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useOnboardingChecklist", () => {
  describe("4.1 — derivazione corretta per ogni item da mock data", () => {
    it("profilo completato: true quando first_name e last_name presenti", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "profile-complete");
      expect(item?.completed).toBe(true);
    });

    it("profilo completato: false quando first_name è null", () => {
      setupMocks({
        profile: { first_name: null, last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "profile-complete");
      expect(item?.completed).toBe(false);
    });

    it("gestione INPS selezionata: sempre true se onboarding completato", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "gestione-inps");
      expect(item?.completed).toBe(true);
    });

    it("dati fiscali configurati: true quando taxRate e profitCoeff presenti", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "fiscal-data");
      expect(item?.completed).toBe(true);
    });

    it("primo incasso: true quando incassiYTD > 0", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { incassiYTD: 5000 },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "first-receipt");
      expect(item?.completed).toBe(true);
    });

    it("primo incasso: false quando incassiYTD === 0", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { incassiYTD: 0 },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "first-receipt");
      expect(item?.completed).toBe(false);
    });

    it("scadenziario: true quando hasScheduleData è true", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { hasScheduleData: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "schedule-viewed");
      expect(item?.completed).toBe(true);
    });
  });

  describe("4.2 — filtro per gestione (Separata vs Art/Comm)", () => {
    it("Separata: non mostra step riduzione_35 e rate_scadute", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { inpsManagement: "separata" },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const ids = result.current.items.map((i) => i.id);
      expect(ids).not.toContain("riduzione-35");
      expect(ids).not.toContain("rate-scadute-verified");
    });

    it("Artigiani: mostra step aggiuntivi Art/Comm", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { inpsManagement: "artigiani" },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const ids = result.current.items.map((i) => i.id);
      expect(ids).toContain("riduzione-35");
      expect(ids).toContain("rate-scadute-verified");
    });

    it("Commercianti: mostra step aggiuntivi Art/Comm", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { inpsManagement: "commercianti" },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const ids = result.current.items.map((i) => i.id);
      expect(ids).toContain("riduzione-35");
      expect(ids).toContain("rate-scadute-verified");
    });

    it("Art/Comm: riduzione_35 completata perché wizard la chiede (onboarding_completed)", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { inpsManagement: "artigiani" },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "riduzione-35");
      expect(item?.completed).toBe(true);
    });

    it("Art/Comm: rate scadute verificate quando banner dismissed", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: {
          inpsManagement: "artigiani",
          bannerRateScaduteDismissed: true,
          expiredRatesCount: 2,
        },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "rate-scadute-verified");
      expect(item?.completed).toBe(true);
    });

    it("Art/Comm: rate scadute verificate quando nessuna rata scaduta", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: {
          inpsManagement: "artigiani",
          bannerRateScaduteDismissed: false,
          expiredRatesCount: 0,
        },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "rate-scadute-verified");
      expect(item?.completed).toBe(true);
    });

    it("Art/Comm: rate scadute NON verificate quando banner non dismissed e rate scadute presenti", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: {
          inpsManagement: "artigiani",
          bannerRateScaduteDismissed: false,
          expiredRatesCount: 3,
        },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      const item = result.current.items.find((i) => i.id === "rate-scadute-verified");
      expect(item?.completed).toBe(false);
    });
  });

  describe("4.3 — calcolo percentuale con edge cases", () => {
    it("0%: nessun item completato (Separata, onboarding completato)", () => {
      setupMocks({
        profile: { first_name: null, last_name: null, onboarding_completed: true },
        metricsOverrides: {
          incassiYTD: 0,
          hasScheduleData: false,
          settings: {
            taxRate: undefined,
            profitCoeff: undefined,
            inpsRate: undefined,
            safetyBuffer: 0,
            reserveAmount: 0,
            bufferBase: "receipts",
            deadlineWindowDays: 30,
          },
        },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      // onboarding_completed = true ma nessun dato reale → solo gestione-inps completato (1/5 = 20%)
      // Per ottenere 0% reale serve onboarding_completed: false (gate → items vuoti)
      expect(result.current.percentage).toBe(20);
    });

    it("items vuoti quando onboarding_completed è false (gate AC1)", () => {
      setupMocks({
        profile: { first_name: null, last_name: null, onboarding_completed: false },
        metricsOverrides: { incassiYTD: 0, hasScheduleData: false },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.items).toHaveLength(0);
      expect(result.current.percentage).toBe(0);
    });

    it("100%: tutti gli item completati (Separata)", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { incassiYTD: 5000, hasScheduleData: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.percentage).toBe(100);
      expect(result.current.isComplete).toBe(true);
    });

    it("percentuale intermedia arrotondata", () => {
      // Separata: 5 items. Profilo completo + gestione + dati = 3/5 = 60%
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: { incassiYTD: 0, hasScheduleData: false },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      // profilo=true, gestione=true, dati_fiscali=true, primo_incasso=false, scadenziario=false
      expect(result.current.percentage).toBe(60);
    });

    it("100%: tutti gli item completati (Art/Comm con 7 items)", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsOverrides: {
          inpsManagement: "artigiani",
          incassiYTD: 5000,
          hasScheduleData: true,
          bannerRateScaduteDismissed: true,
        },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.percentage).toBe(100);
      expect(result.current.isComplete).toBe(true);
    });
  });

  describe("dismiss localStorage", () => {
    it("isDismissed è false quando localStorage non ha valore", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.isDismissed).toBe(false);
    });

    it("isDismissed è true quando localStorage ha il flag", () => {
      localStorage.setItem("forfettino:onboarding-checklist-dismissed", "true");
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.isDismissed).toBe(true);
    });

    it("dismiss() imposta il flag localStorage", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      act(() => {
        result.current.dismiss();
      });
      expect(localStorage.getItem("forfettino:onboarding-checklist-dismissed")).toBe("true");
    });

    it("dismiss() sincronizza isDismissed tra istanze dello stesso hook", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
      });
      const first = renderHook(() => useOnboardingChecklist());
      const second = renderHook(() => useOnboardingChecklist());

      expect(first.result.current.isDismissed).toBe(false);
      expect(second.result.current.isDismissed).toBe(false);

      act(() => {
        first.result.current.dismiss();
      });

      expect(first.result.current.isDismissed).toBe(true);
      expect(second.result.current.isDismissed).toBe(true);
    });
  });

  describe("loading state", () => {
    it("isLoading true quando profilo carica", () => {
      setupMocks({
        profile: null,
        profileLoading: true,
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.isLoading).toBe(true);
    });

    it("isLoading true quando metrics carica", () => {
      setupMocks({
        profile: { first_name: "Luca", last_name: "Rossi", onboarding_completed: true },
        metricsLoading: true,
      });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.isLoading).toBe(true);
    });
  });
});
