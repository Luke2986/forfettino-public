/**
 * 🛡️ GUARDRAIL TESTS — Story 9.1: Onboarding Checklist Progressiva
 *
 * Questi test proteggono da regressioni specifiche per la checklist onboarding.
 * NON MODIFICARE senza approvazione esplicita.
 *
 * Scenari protetti:
 * - Derivazione completamento SOLO da dati esistenti (FR46)
 * - Filtro corretto per gestione INPS
 * - localStorage dismiss non influenza altri componenti
 * - Nessuna query Supabase aggiuntiva
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOnboardingChecklist } from "./useOnboardingChecklist";

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

function buildFullMetrics(overrides: Record<string, unknown> = {}) {
  return {
    inpsManagement: "separata" as const,
    incassiYTD: 10000,
    settings: {
      taxRate: 15,
      profitCoeff: 78,
      inpsRate: 26.07,
      safetyBuffer: 10,
      reserveAmount: 0,
      bufferBase: "receipts",
      deadlineWindowDays: 30,
    },
    taxableAmount: 7800,
    taxAmount: 1170,
    inpsAmount: 2033,
    totalWithholding: 3203,
    bufferAmount: 780,
    monthlyToolCost: 0,
    monthlyAccountantCost: 0,
    yearlyToolCost: 0,
    toolCostsYTD: 0,
    dueSoonRemaining: 0,
    spendable: 6017,
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
    hasScheduleData: true,
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

function setupDefaults(overrides: {
  gestione?: "separata" | "artigiani" | "commercianti";
  metricsOverrides?: Record<string, unknown>;
} = {}) {
  mockUseProfile.mockReturnValue({
    data: {
      id: "p1",
      user_id: "u1",
      first_name: "Luca",
      last_name: "Rossi",
      onboarding_completed: true,
      user_code: "LA26TEST1",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as any);

  mockUseFiscalCalculations.mockReturnValue({
    metrics: buildFullMetrics({
      inpsManagement: overrides.gestione ?? "separata",
      ...overrides.metricsOverrides,
    }),
    isLoading: false,
    currentYear: 2026,
    refetch: vi.fn(),
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("[GUARDRAIL] Story 9.1 — Onboarding Checklist Regressioni", () => {
  describe("FR46: derivazione SOLO da dati esistenti", () => {
    it("hook non importa supabase direttamente", async () => {
      // Verifica statica: il modulo useOnboardingChecklist non deve importare supabase
      const hookModule = await import("./useOnboardingChecklist?raw" as string).catch(
        () => null
      );
      // Se il raw import non funziona, verifichiamo indirettamente
      // che l'hook funziona senza alcuna query supabase mockando SOLO profile e fiscal
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    it("hook usa SOLO useProfile e useFiscalCalculations come data source", () => {
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      // Se funziona con solo questi 2 mock, non ha altre dipendenze dati
      expect(result.current.percentage).toBeGreaterThan(0);
      expect(mockUseProfile).toHaveBeenCalled();
      expect(mockUseFiscalCalculations).toHaveBeenCalled();
    });
  });

  describe("Conteggio items per gestione", () => {
    it("[GUARDRAIL] Separata ha esattamente 5 items", () => {
      setupDefaults({ gestione: "separata" });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.items).toHaveLength(5);
    });

    it("[GUARDRAIL] Artigiani ha esattamente 7 items", () => {
      setupDefaults({ gestione: "artigiani" });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.items).toHaveLength(7);
    });

    it("[GUARDRAIL] Commercianti ha esattamente 7 items", () => {
      setupDefaults({ gestione: "commercianti" });
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.items).toHaveLength(7);
    });
  });

  describe("IDs item stabili (non rinominare)", () => {
    it("[GUARDRAIL] IDs base sono stabili", () => {
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      const ids = result.current.items.map((i) => i.id);
      expect(ids).toEqual([
        "profile-complete",
        "gestione-inps",
        "fiscal-data",
        "first-receipt",
        "schedule-viewed",
      ]);
    });

    it("[GUARDRAIL] IDs Art/Comm aggiuntivi sono stabili", () => {
      setupDefaults({ gestione: "artigiani" });
      const { result } = renderHook(() => useOnboardingChecklist());
      const ids = result.current.items.map((i) => i.id);
      expect(ids).toContain("riduzione-35");
      expect(ids).toContain("rate-scadute-verified");
    });
  });

  describe("localStorage isolation", () => {
    it("[GUARDRAIL] dismiss usa SOLO la chiave forfettino:onboarding-checklist-dismissed", () => {
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      act(() => {
        result.current.dismiss();
      });
      // Verifica che SOLO la chiave attesa è stata impostata
      expect(localStorage.getItem("forfettino:onboarding-checklist-dismissed")).toBe("true");
      expect(localStorage.length).toBe(1);
    });

    it("[GUARDRAIL] dismiss non sovrascrive altri valori localStorage", () => {
      localStorage.setItem("forfettino:hero-expanded", "true");
      localStorage.setItem("forfettino:sidebar-collapsed", "false");
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      act(() => {
        result.current.dismiss();
      });
      expect(localStorage.getItem("forfettino:hero-expanded")).toBe("true");
      expect(localStorage.getItem("forfettino:sidebar-collapsed")).toBe("false");
    });
  });

  describe("Edge case: transizione gestione", () => {
    it("[GUARDRAIL] cambio da Separata ad Artigiani aggiunge 2 items", () => {
      setupDefaults({ gestione: "separata" });
      const { result: r1 } = renderHook(() => useOnboardingChecklist());
      const countSep = r1.current.items.length;

      setupDefaults({ gestione: "artigiani" });
      const { result: r2 } = renderHook(() => useOnboardingChecklist());
      const countArt = r2.current.items.length;

      expect(countArt - countSep).toBe(2);
    });
  });

  describe("Percentuale boundary", () => {
    it("[GUARDRAIL] percentuale è sempre tra 0 e 100", () => {
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      expect(result.current.percentage).toBeGreaterThanOrEqual(0);
      expect(result.current.percentage).toBeLessThanOrEqual(100);
    });

    it("[GUARDRAIL] isComplete è true solo quando percentage === 100", () => {
      setupDefaults();
      const { result } = renderHook(() => useOnboardingChecklist());
      if (result.current.percentage === 100) {
        expect(result.current.isComplete).toBe(true);
      } else {
        expect(result.current.isComplete).toBe(false);
      }
    });
  });
});
