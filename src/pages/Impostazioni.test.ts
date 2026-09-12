/**
 * Impostazioni.test.ts — Story 2.6
 * Test per la logica di gestione INPS nelle Impostazioni.
 * Verifica: canChangeGestione, formData initialization, dual-write payload.
 */
import { describe, it, expect } from "vitest";
import {
  mapGestioneToInpsType,
  isEligibleRiduzione50,
  computeRiduzione50Scadenza,
  isValidEnrollmentYear,
  deriveAliquotaSostitutiva,
} from "@/pages/Wizard";
import type { GestioneINPS } from "@/lib/fiscal-engine";

// ===== HELPER: canChangeGestione (same logic as in Impostazioni.tsx) =====
function canChangeGestione(receiptsCount: number): boolean {
  return receiptsCount === 0;
}

// ===== HELPER: build formData from settings (same logic as useEffect in Impostazioni.tsx) =====
function buildFormDataFromSettings(settings: {
  inps_management: string | null;
  inps_enrollment_year: number | null;
  riduzione_50_attiva: boolean | null;
  riduzione_50_scadenza: string | null;
  riduzione_35_attiva: boolean | null;
  inps_rate: number;
  tax_rate: number;
  profit_coefficient: number;
  anno_apertura_piva?: number | null;
}) {
  const gestione = (settings.inps_management || "separata") as GestioneINPS;
  return {
    inpsManagement: gestione,
    inpsEnrollmentYear: settings.inps_enrollment_year ?? null,
    riduzione50Attiva: settings.riduzione_50_attiva ?? false,
    riduzione50Scadenza: settings.riduzione_50_scadenza ?? null,
    riduzione35Attiva: settings.riduzione_35_attiva ?? false,
    inpsRate: Number(settings.inps_rate),
    annoAperturaPiva: settings.anno_apertura_piva ?? null,
  };
}

// ===== HELPER: build upsert payload (same logic as handleSave in Impostazioni.tsx) =====
function buildUpsertPayload(formData: {
  inpsManagement: GestioneINPS;
  inpsEnrollmentYear: number | null;
  riduzione50Attiva: boolean;
  riduzione50Scadenza: string | null;
  riduzione35Attiva: boolean;
  inpsRate: number;
  annoAperturaPiva?: number | null;
}) {
  return {
    inps_management: formData.inpsManagement,
    inps_type: mapGestioneToInpsType(formData.inpsManagement),
    inps_enrollment_year: formData.inpsEnrollmentYear,
    riduzione_50_attiva: formData.riduzione50Attiva,
    riduzione_50_scadenza: formData.riduzione50Scadenza,
    riduzione_35_attiva: formData.riduzione35Attiva,
    inps_rate: formData.inpsRate,
    anno_apertura_piva: formData.annoAperturaPiva ?? null,
  };
}

// ===== TESTS =====

describe("canChangeGestione", () => {
  it("should return true when receiptsCount is 0", () => {
    expect(canChangeGestione(0)).toBe(true);
  });

  it("should return false when receiptsCount is > 0", () => {
    expect(canChangeGestione(1)).toBe(false);
    expect(canChangeGestione(10)).toBe(false);
    expect(canChangeGestione(999)).toBe(false);
  });
});

describe("buildFormDataFromSettings", () => {
  it("should default inpsManagement to 'separata' when null", () => {
    const result = buildFormDataFromSettings({
      inps_management: null,
      inps_enrollment_year: null,
      riduzione_50_attiva: null,
      riduzione_50_scadenza: null,
      riduzione_35_attiva: null,
      inps_rate: 26.07,
      tax_rate: 15,
      profit_coefficient: 78,
    });
    expect(result.inpsManagement).toBe("separata");
    expect(result.riduzione50Attiva).toBe(false);
    expect(result.riduzione35Attiva).toBe(false);
    expect(result.inpsEnrollmentYear).toBeNull();
  });

  it("should populate all Art/Comm fields from settings", () => {
    const result = buildFormDataFromSettings({
      inps_management: "artigiani",
      inps_enrollment_year: 2024,
      riduzione_50_attiva: true,
      riduzione_50_scadenza: "2027-12-31",
      riduzione_35_attiva: true,
      inps_rate: 24.0,
      tax_rate: 15,
      profit_coefficient: 67,
    });
    expect(result.inpsManagement).toBe("artigiani");
    expect(result.inpsEnrollmentYear).toBe(2024);
    expect(result.riduzione50Attiva).toBe(true);
    expect(result.riduzione50Scadenza).toBe("2027-12-31");
    expect(result.riduzione35Attiva).toBe(true);
    expect(result.inpsRate).toBe(24.0);
  });

  it("should handle commercianti gestione", () => {
    const result = buildFormDataFromSettings({
      inps_management: "commercianti",
      inps_enrollment_year: 2023,
      riduzione_50_attiva: false,
      riduzione_50_scadenza: null,
      riduzione_35_attiva: false,
      inps_rate: 24.48,
      tax_rate: 5,
      profit_coefficient: 40,
    });
    expect(result.inpsManagement).toBe("commercianti");
    expect(result.inpsEnrollmentYear).toBe(2023);
    expect(result.inpsRate).toBe(24.48);
  });
});

describe("buildUpsertPayload — dual-write", () => {
  it("should produce correct dual-write for separata", () => {
    const payload = buildUpsertPayload({
      inpsManagement: "separata",
      inpsEnrollmentYear: null,
      riduzione50Attiva: false,
      riduzione50Scadenza: null,
      riduzione35Attiva: false,
      inpsRate: 26.07,
    });
    expect(payload.inps_management).toBe("separata");
    expect(payload.inps_type).toBe("gestione_separata");
    expect(payload.inps_enrollment_year).toBeNull();
    expect(payload.riduzione_50_attiva).toBe(false);
    expect(payload.riduzione_35_attiva).toBe(false);
  });

  it("should produce correct dual-write for artigiani", () => {
    const payload = buildUpsertPayload({
      inpsManagement: "artigiani",
      inpsEnrollmentYear: 2024,
      riduzione50Attiva: true,
      riduzione50Scadenza: "2027-12-31",
      riduzione35Attiva: true,
      inpsRate: 24.0,
    });
    expect(payload.inps_management).toBe("artigiani");
    expect(payload.inps_type).toBe("gestione_artigiani");
    expect(payload.inps_enrollment_year).toBe(2024);
    expect(payload.riduzione_50_attiva).toBe(true);
    expect(payload.riduzione_50_scadenza).toBe("2027-12-31");
    expect(payload.riduzione_35_attiva).toBe(true);
  });

  it("should produce correct dual-write for commercianti", () => {
    const payload = buildUpsertPayload({
      inpsManagement: "commercianti",
      inpsEnrollmentYear: 2022,
      riduzione50Attiva: false,
      riduzione50Scadenza: null,
      riduzione35Attiva: false,
      inpsRate: 24.48,
    });
    expect(payload.inps_management).toBe("commercianti");
    expect(payload.inps_type).toBe("gestione_commercianti");
    expect(payload.inps_enrollment_year).toBe(2022);
    expect(payload.riduzione_50_attiva).toBe(false);
    expect(payload.riduzione_35_attiva).toBe(false);
  });
});

// ===== HELPER: getInpsRateForGestione (same logic as in Impostazioni.tsx) =====
function getInpsRateForGestione(
  gestione: GestioneINPS,
  fiscalRules: { inps_rate_separata: number; inps_rate_artigiani: number; inps_rate_commercianti: number } | null,
  currentInpsRate: number,
): number {
  if (fiscalRules) {
    switch (gestione) {
      case "separata": return Number(fiscalRules.inps_rate_separata);
      case "artigiani": return Number(fiscalRules.inps_rate_artigiani);
      case "commercianti": return Number(fiscalRules.inps_rate_commercianti);
    }
  }
  return currentInpsRate;
}

// ===== HELPER: saveDisabled (same logic as in Impostazioni.tsx) =====
function isSaveDisabled(saving: boolean, inpsManagement: GestioneINPS, fiscalRules: unknown | null): boolean {
  return saving || (inpsManagement !== "separata" && !fiscalRules);
}

describe("getInpsRateForGestione", () => {
  const mockRules = { inps_rate_separata: 26.07, inps_rate_artigiani: 24.00, inps_rate_commercianti: 24.48 };

  it("should return correct rate from fiscalRules when loaded", () => {
    expect(getInpsRateForGestione("separata", mockRules, 0)).toBe(26.07);
    expect(getInpsRateForGestione("artigiani", mockRules, 0)).toBe(24.00);
    expect(getInpsRateForGestione("commercianti", mockRules, 0)).toBe(24.48);
  });

  it("should fallback to currentInpsRate when fiscalRules null", () => {
    expect(getInpsRateForGestione("artigiani", null, 26.07)).toBe(26.07);
    expect(getInpsRateForGestione("separata", null, 26.07)).toBe(26.07);
  });
});

describe("saveDisabled guard", () => {
  it("should disable when saving", () => {
    expect(isSaveDisabled(true, "separata", {})).toBe(true);
  });

  it("should disable Art/Comm when fiscalRules null", () => {
    expect(isSaveDisabled(false, "artigiani", null)).toBe(true);
    expect(isSaveDisabled(false, "commercianti", null)).toBe(true);
  });

  it("should NOT disable Separata when fiscalRules null", () => {
    expect(isSaveDisabled(false, "separata", null)).toBe(false);
  });

  it("should NOT disable Art/Comm when fiscalRules loaded", () => {
    expect(isSaveDisabled(false, "artigiani", {})).toBe(false);
    expect(isSaveDisabled(false, "commercianti", {})).toBe(false);
  });
});

describe("riduzione50 eligibility integration", () => {
  it("recent enrollment should be eligible", () => {
    expect(isEligibleRiduzione50(2025, 2026)).toBe(true);
    expect(computeRiduzione50Scadenza(2025)).toBe("2028-12-31");
  });

  it("old enrollment should not be eligible", () => {
    expect(isEligibleRiduzione50(2020, 2026)).toBe(false);
  });

  it("null enrollment should not be eligible", () => {
    expect(isEligibleRiduzione50(null, 2026)).toBe(false);
  });

  it("enrollment year validation", () => {
    expect(isValidEnrollmentYear(2024, 2026)).toBe(true);
    expect(isValidEnrollmentYear(1999, 2026)).toBe(false);
    expect(isValidEnrollmentYear(2027, 2026)).toBe(false);
    expect(isValidEnrollmentYear(null, 2026)).toBe(false);
  });
});

// ─── Story 2.7 Tests — Anno Apertura Partita IVA in Impostazioni ────────────

describe("buildFormDataFromSettings — annoAperturaPiva (Story 2.7)", () => {
  it("should populate annoAperturaPiva from settings", () => {
    const result = buildFormDataFromSettings({
      inps_management: "separata",
      inps_enrollment_year: null,
      riduzione_50_attiva: null,
      riduzione_50_scadenza: null,
      riduzione_35_attiva: null,
      inps_rate: 26.07,
      tax_rate: 5,
      profit_coefficient: 78,
      anno_apertura_piva: 2023,
    });
    expect(result.annoAperturaPiva).toBe(2023);
  });

  it("should default annoAperturaPiva to null when not set", () => {
    const result = buildFormDataFromSettings({
      inps_management: "separata",
      inps_enrollment_year: null,
      riduzione_50_attiva: null,
      riduzione_50_scadenza: null,
      riduzione_35_attiva: null,
      inps_rate: 26.07,
      tax_rate: 15,
      profit_coefficient: 78,
    });
    expect(result.annoAperturaPiva).toBeNull();
  });
});

describe("buildUpsertPayload — anno_apertura_piva (Story 2.7)", () => {
  it("should include anno_apertura_piva in upsert payload", () => {
    const payload = buildUpsertPayload({
      inpsManagement: "separata",
      inpsEnrollmentYear: null,
      riduzione50Attiva: false,
      riduzione50Scadenza: null,
      riduzione35Attiva: false,
      inpsRate: 26.07,
      annoAperturaPiva: 2024,
    });
    expect(payload.anno_apertura_piva).toBe(2024);
  });

  it("should set anno_apertura_piva to null when not provided", () => {
    const payload = buildUpsertPayload({
      inpsManagement: "artigiani",
      inpsEnrollmentYear: 2024,
      riduzione50Attiva: true,
      riduzione50Scadenza: "2027-12-31",
      riduzione35Attiva: false,
      inpsRate: 24.0,
    });
    expect(payload.anno_apertura_piva).toBeNull();
  });
});

// ─── Story 20-1 Tests — Propagazione Gestione INPS Globale ────────────

// ===== HELPER: build propagation payload (same logic as Story 20-1 in handleSave) =====
// NOTE (Code Review): Questo helper è un DUPLICATO locale della logica inline in
// handleSave(). I test validano la STRUTTURA del payload di propagazione (campi
// strutturali vs per-anno), NON l'esecuzione reale della query Supabase .update().
function buildPropagationPayload(formData: {
  inpsManagement: GestioneINPS;
  inpsEnrollmentYear: number | null;
  riduzione35Attiva: boolean;
  riduzione50Attiva: boolean;
  riduzione50Scadenza: string | null;
}) {
  return {
    inps_management: formData.inpsManagement,
    inps_type: mapGestioneToInpsType(formData.inpsManagement),
    inps_enrollment_year: formData.inpsEnrollmentYear,
    riduzione_35_attiva: formData.riduzione35Attiva,
    riduzione_50_attiva: formData.riduzione50Attiva,
    riduzione_50_scadenza: formData.riduzione50Scadenza,
  };
}

const STRUCTURAL_FIELDS = [
  "inps_management",
  "inps_type",
  "inps_enrollment_year",
  "riduzione_35_attiva",
  "riduzione_50_attiva",
  "riduzione_50_scadenza",
] as const;

const PER_YEAR_FIELDS = [
  "tax_rate",
  "profit_coefficient",
  "inps_rate",
  "safety_buffer_rate",
  "reserve_amount",
  "acconti_imposta_versati",
  "acconti_inps_eccedenza_versati",
  "saldo_iniziale_cc",
  "anno_apertura_piva",
  "deadline_window_days",
  "buffer_base",
] as const;

describe("Story 20-1: buildPropagationPayload — structural fields only", () => {
  it("contains exactly the 6 structural fields for commercianti", () => {
    const payload = buildPropagationPayload({
      inpsManagement: "commercianti",
      inpsEnrollmentYear: 2024,
      riduzione35Attiva: true,
      riduzione50Attiva: false,
      riduzione50Scadenza: null,
    });

    expect(Object.keys(payload).sort()).toEqual([...STRUCTURAL_FIELDS].sort());
    expect(payload.inps_management).toBe("commercianti");
    expect(payload.inps_type).toBe("gestione_commercianti");
    expect(payload.inps_enrollment_year).toBe(2024);
    expect(payload.riduzione_35_attiva).toBe(true);
    expect(payload.riduzione_50_attiva).toBe(false);
    expect(payload.riduzione_50_scadenza).toBeNull();
  });

  it("does NOT contain any per-year fields", () => {
    const payload = buildPropagationPayload({
      inpsManagement: "artigiani",
      inpsEnrollmentYear: 2023,
      riduzione35Attiva: false,
      riduzione50Attiva: true,
      riduzione50Scadenza: "2026-12-31",
    });

    for (const field of PER_YEAR_FIELDS) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it("handles separata correctly (null enrollment, false riduzioni)", () => {
    const payload = buildPropagationPayload({
      inpsManagement: "separata",
      inpsEnrollmentYear: null,
      riduzione35Attiva: false,
      riduzione50Attiva: false,
      riduzione50Scadenza: null,
    });

    expect(payload.inps_management).toBe("separata");
    expect(payload.inps_type).toBe("gestione_separata");
    expect(payload.inps_enrollment_year).toBeNull();
    expect(payload.riduzione_35_attiva).toBe(false);
    expect(payload.riduzione_50_attiva).toBe(false);
    expect(payload.riduzione_50_scadenza).toBeNull();
  });
});

describe("deriveAliquotaSostitutiva in Impostazioni context (Story 2.7)", () => {
  it("should derive 5% when within first 5 years", () => {
    const result = deriveAliquotaSostitutiva(2024, 2026);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(3);
  });

  it("should derive 15% when past 5 years", () => {
    const result = deriveAliquotaSostitutiva(2020, 2026);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(15);
    expect(result!.anniRimanenti).toBe(0);
  });

  it("should return null for manual mode (no anno apertura)", () => {
    expect(deriveAliquotaSostitutiva(null, 2026)).toBeNull();
  });
});

// ─── REGRESSION: INPS structural change triggers schedule regen ────────────
// Bug: toggling riduzione 50% -> 35% (o viceversa) non rigenerava tax_schedule,
// lasciando Scadenziario e unpaidCurrentYearTotal con i vecchi importi.
// Fix: handleSave ora confronta lo snapshot pre-save con il nuovo formData
// e chiama regenerateForPaymentYear(currentYear) + regenerateForPaymentYear(currentYear + 1)
// se uno qualsiasi dei campi INPS strutturali è cambiato.

type InpsFormSlice = {
  inpsManagement: GestioneINPS;
  inpsEnrollmentYear: number | null;
  riduzione50Attiva: boolean;
  riduzione35Attiva: boolean;
  profitCoefficient: number;
  taxRate: string;
  annoAperturaPiva: number | null;
};

function inpsStructuralChanged(prev: InpsFormSlice | null, next: InpsFormSlice): boolean {
  return (
    !prev ||
    prev.riduzione35Attiva !== next.riduzione35Attiva ||
    prev.riduzione50Attiva !== next.riduzione50Attiva ||
    prev.inpsManagement !== next.inpsManagement ||
    prev.inpsEnrollmentYear !== next.inpsEnrollmentYear ||
    prev.profitCoefficient !== next.profitCoefficient ||
    prev.taxRate !== next.taxRate ||
    prev.annoAperturaPiva !== next.annoAperturaPiva
  );
}

const BASE_FORM: InpsFormSlice = {
  inpsManagement: "artigiani",
  inpsEnrollmentYear: 2024,
  riduzione50Attiva: true,
  riduzione35Attiva: false,
  profitCoefficient: 67,
  taxRate: "5",
  annoAperturaPiva: 2024,
};

describe("inpsStructuralChanged — trigger schedule regen", () => {
  it("returns false when nothing changed", () => {
    expect(inpsStructuralChanged(BASE_FORM, { ...BASE_FORM })).toBe(false);
  });

  it("returns true when toggling 50% -> 35% (primary bug case)", () => {
    const next: InpsFormSlice = { ...BASE_FORM, riduzione50Attiva: false, riduzione35Attiva: true };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when toggling 35% -> 50%", () => {
    const from: InpsFormSlice = { ...BASE_FORM, riduzione50Attiva: false, riduzione35Attiva: true };
    const to: InpsFormSlice = { ...BASE_FORM, riduzione50Attiva: true, riduzione35Attiva: false };
    expect(inpsStructuralChanged(from, to)).toBe(true);
  });

  it("returns true when disabling any riduzione", () => {
    const next: InpsFormSlice = { ...BASE_FORM, riduzione50Attiva: false };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when changing gestione (artigiani -> commercianti)", () => {
    const next: InpsFormSlice = { ...BASE_FORM, inpsManagement: "commercianti" };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when changing inpsEnrollmentYear", () => {
    const next: InpsFormSlice = { ...BASE_FORM, inpsEnrollmentYear: 2023 };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when changing profitCoefficient", () => {
    const next: InpsFormSlice = { ...BASE_FORM, profitCoefficient: 78 };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when changing taxRate (5% -> 15%)", () => {
    const next: InpsFormSlice = { ...BASE_FORM, taxRate: "15" };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when changing annoAperturaPiva", () => {
    const next: InpsFormSlice = { ...BASE_FORM, annoAperturaPiva: 2020 };
    expect(inpsStructuralChanged(BASE_FORM, next)).toBe(true);
  });

  it("returns true when snapshot is null (defensive default: always regenerate)", () => {
    expect(inpsStructuralChanged(null, BASE_FORM)).toBe(true);
  });
});
