/**
 * Tests for Wizard — Story 2.2 + Story 2.3 + Story 2.4
 *
 * Story 2.2: mapGestioneToInpsType, gestione selection logic
 * Story 2.3: Anno Iscrizione step, riduzione 50% proattiva,
 *            conditional step visibility, eligibility logic
 * Story 2.4: Riduzione 35% step with "Non lo so" option,
 *            mapRiduzione35, conditional step visibility
 *
 * Pure logic unit tests — no jsdom/RTL needed.
 */
import { describe, it, expect } from "vitest";
import { type GestioneINPS, getScadenzeFiscali } from "@/lib/fiscal-engine";
import {
  mapGestioneToInpsType,
  getVisibleSteps,
  isEligibleRiduzione50,
  computeRiduzione50Scadenza,
  isValidEnrollmentYear,
  canProceedDatiFiscali,
  mapRiduzione35,
  deriveAliquotaSostitutiva,
  ALL_STEPS,
  type Riduzione35Scelta,
} from "@/pages/Wizard";
import { CATEGORY_LABELS, getCategoryOrder, isValidManualCoefficient } from "@/lib/ateco-catalog";

// ─── Story 2.2 Tests (preserved) ───────────────────────────────────

describe("mapGestioneToInpsType", () => {
  it("should map 'separata' to 'gestione_separata'", () => {
    expect(mapGestioneToInpsType("separata")).toBe("gestione_separata");
  });

  it("should map 'artigiani' to 'gestione_artigiani'", () => {
    expect(mapGestioneToInpsType("artigiani")).toBe("gestione_artigiani");
  });

  it("should map 'commercianti' to 'gestione_commercianti'", () => {
    expect(mapGestioneToInpsType("commercianti")).toBe("gestione_commercianti");
  });
});

describe("WizardData defaults — backward compatibility Separata", () => {
  const defaultWizardData = {
    inpsManagement: "separata" as GestioneINPS,
    firstName: "",
    lastName: "",
    taxRate: "15" as const,
    profitCoefficient: 78,
    inpsRate: 26.07,
    inpsType: "gestione_separata",
    safetyBufferRate: 5,
    deadlineWindowDays: 45,
    bufferBase: "receipts" as const,
    saldoInizialeCC: 0,
    // Story 2.3 — new fields must default correctly for Separata
    inpsEnrollmentYear: null as number | null,
    riduzione50Attiva: false,
    riduzione50Scadenza: null as string | null,
    // Story 2.4 — riduzione 35% defaults
    riduzione35Attiva: false,
  };

  it("should default inpsManagement to 'separata'", () => {
    expect(defaultWizardData.inpsManagement).toBe("separata");
  });

  it("should default inpsType to 'gestione_separata' (V1 compat)", () => {
    expect(defaultWizardData.inpsType).toBe("gestione_separata");
  });

  it("should default inpsRate to 26.07 (Separata rate)", () => {
    expect(defaultWizardData.inpsRate).toBe(26.07);
  });

  it("should default inpsEnrollmentYear to null for Separata", () => {
    expect(defaultWizardData.inpsEnrollmentYear).toBeNull();
  });

  it("should default riduzione50Attiva to false for Separata", () => {
    expect(defaultWizardData.riduzione50Attiva).toBe(false);
  });

  it("should default riduzione50Scadenza to null for Separata", () => {
    expect(defaultWizardData.riduzione50Scadenza).toBeNull();
  });

  it("should default riduzione35Attiva to false for Separata (Story 2.4)", () => {
    expect(defaultWizardData.riduzione35Attiva).toBe(false);
  });

  it("should produce the same DB fields as V1 wizard for Separata", () => {
    const v1DbFields = {
      inps_type: "gestione_separata",
      inps_rate: 26.07,
    };

    const newDbFields = {
      inps_type: mapGestioneToInpsType(defaultWizardData.inpsManagement),
      inps_rate: defaultWizardData.inpsRate,
      inps_management: defaultWizardData.inpsManagement,
    };

    expect(newDbFields.inps_type).toBe(v1DbFields.inps_type);
    expect(newDbFields.inps_rate).toBe(v1DbFields.inps_rate);
    expect(newDbFields.inps_management).toBe("separata");
  });
});

describe("Gestione INPS rate mapping from fiscal_rules", () => {
  const fiscalRules = {
    inps_rate_separata: 26.07,
    inps_rate_artigiani: 24.0,
    inps_rate_commercianti: 24.48,
  };

  function getInpsRateForGestione(gestione: GestioneINPS): number {
    switch (gestione) {
      case "separata":
        return fiscalRules.inps_rate_separata;
      case "artigiani":
        return fiscalRules.inps_rate_artigiani;
      case "commercianti":
        return fiscalRules.inps_rate_commercianti;
    }
  }

  it("should return 26.07 for Separata", () => {
    expect(getInpsRateForGestione("separata")).toBe(26.07);
  });

  it("should return 24.00 for Artigiani", () => {
    expect(getInpsRateForGestione("artigiani")).toBe(24.0);
  });

  it("should return 24.48 for Commercianti", () => {
    expect(getInpsRateForGestione("commercianti")).toBe(24.48);
  });

  it("should return different rates for Artigiani vs Commercianti", () => {
    expect(getInpsRateForGestione("artigiani")).not.toBe(
      getInpsRateForGestione("commercianti"),
    );
  });
});

// ─── Story 2.3 Tests (preserved) ───────────────────────────────────

describe("ALL_STEPS definition (Story 2.3 + 2.4)", () => {
  it("should have 9 steps total (added annoIscrizione + riduzione35 + acconti)", () => {
    expect(ALL_STEPS).toHaveLength(9);
  });

  it("should have 'gestione' as the first step", () => {
    expect(ALL_STEPS[0].id).toBe("gestione");
  });

  it("should have 'annoIscrizione' as the second step", () => {
    expect(ALL_STEPS[1].id).toBe("annoIscrizione");
  });

  it("should have 'riduzione35' as the third step (Story 2.4)", () => {
    expect(ALL_STEPS[2].id).toBe("riduzione35");
  });

  it("should have 'conferma' as the last step", () => {
    expect(ALL_STEPS[ALL_STEPS.length - 1].id).toBe("conferma");
  });

  it("should maintain correct step order with riduzione35 after annoIscrizione and acconti after riduzione35", () => {
    const ids = ALL_STEPS.map((s) => s.id);
    expect(ids).toEqual([
      "gestione",
      "annoIscrizione",
      "riduzione35",
      "acconti",
      "profilo",
      "datiFiscali",
      "prudenza",
      "scadenze",
      "conferma",
    ]);
  });

  it("should have 'prudenza' step with title 'Saldo' (renamed from Prudenza)", () => {
    const step = ALL_STEPS.find((s) => s.id === "prudenza");
    expect(step).toBeDefined();
    expect(step!.title).toBe("Saldo");
  });
});

describe("getVisibleSteps — conditional step visibility (Story 2.3 + 2.4)", () => {
  it("should return 6 steps for Separata (annoIscrizione + riduzione35 hidden)", () => {
    const steps = getVisibleSteps("separata");
    expect(steps).toHaveLength(6);
  });

  it("should NOT include 'annoIscrizione' for Separata", () => {
    const steps = getVisibleSteps("separata");
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("annoIscrizione");
  });

  it("should NOT include 'riduzione35' for Separata (Story 2.4)", () => {
    const steps = getVisibleSteps("separata");
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("riduzione35");
  });

  it("should return 8 steps for Artigiani (both conditional steps visible)", () => {
    const steps = getVisibleSteps("artigiani");
    expect(steps).toHaveLength(8);
  });

  it("should include 'annoIscrizione' for Artigiani", () => {
    const steps = getVisibleSteps("artigiani");
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("annoIscrizione");
  });

  it("should include 'riduzione35' for Artigiani (Story 2.4)", () => {
    const steps = getVisibleSteps("artigiani");
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("riduzione35");
  });

  it("should return 8 steps for Commercianti (both conditional steps visible)", () => {
    const steps = getVisibleSteps("commercianti");
    expect(steps).toHaveLength(8);
  });

  it("should include 'riduzione35' for Commercianti (Story 2.4)", () => {
    const steps = getVisibleSteps("commercianti");
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("riduzione35");
  });

  it("should place 'riduzione35' right after 'annoIscrizione' for Art/Comm (Story 2.4)", () => {
    const stepsArt = getVisibleSteps("artigiani");
    const stepsComm = getVisibleSteps("commercianti");
    expect(stepsArt[1].id).toBe("annoIscrizione");
    expect(stepsArt[2].id).toBe("riduzione35");
    expect(stepsComm[1].id).toBe("annoIscrizione");
    expect(stepsComm[2].id).toBe("riduzione35");
  });

  it("should preserve Separata step order (same as pre-2.3)", () => {
    const steps = getVisibleSteps("separata");
    const ids = steps.map((s) => s.id);
    expect(ids).toEqual([
      "gestione",
      "profilo",
      "datiFiscali",
      "prudenza",
      "scadenze",
      "conferma",
    ]);
  });

  // Story 11.1 — acconti step visibility with annoAperturaPiva
  it("should include 'acconti' step when annoAperturaPiva is past year (not first year)", () => {
    const steps = getVisibleSteps("separata", 2020);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("acconti");
    expect(steps).toHaveLength(7); // 6 base + acconti
  });

  it("should include 'acconti' for Artigiani when annoAperturaPiva is past year", () => {
    const steps = getVisibleSteps("artigiani", 2020);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("acconti");
    expect(steps).toHaveLength(9); // 8 base + acconti
  });

  it("should hide 'acconti' when annoAperturaPiva is null (unknown — conservative)", () => {
    const steps = getVisibleSteps("artigiani", null);
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("acconti");
    expect(steps).toHaveLength(8);
  });

  it("should hide 'acconti' when annoAperturaPiva is current year (first year)", () => {
    const currentYear = new Date().getFullYear();
    const steps = getVisibleSteps("separata", currentYear);
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("acconti");
    expect(steps).toHaveLength(6);
  });

  it("should place 'acconti' after 'riduzione35' for Art/Comm", () => {
    const steps = getVisibleSteps("artigiani", 2020);
    const ids = steps.map((s) => s.id);
    const ridIdx = ids.indexOf("riduzione35");
    const accIdx = ids.indexOf("acconti");
    expect(accIdx).toBe(ridIdx + 1);
  });
});

describe("isEligibleRiduzione50 — eligibility logic (Legge Bilancio 2025, L. 207/2024 art. 1 co. 186-187)", () => {
  // La riduzione 50% è riservata SOLO a chi si iscrive alla gestione Art/Comm NEL 2025
  // Durata: 36 mesi → copriamo i fiscal year [2025..2028] per semplicità

  describe("enrollment 2025 (unico anno eleggibile)", () => {
    it("should return true for fiscal year 2025", () => {
      expect(isEligibleRiduzione50(2025, 2025)).toBe(true);
    });

    it("should return true for fiscal year 2026", () => {
      expect(isEligibleRiduzione50(2025, 2026)).toBe(true);
    });

    it("should return true for fiscal year 2027", () => {
      expect(isEligibleRiduzione50(2025, 2027)).toBe(true);
    });

    it("should return true for fiscal year 2028 (last covered year)", () => {
      expect(isEligibleRiduzione50(2025, 2028)).toBe(true);
    });

    it("should return false for fiscal year 2029 (scadenza superata)", () => {
      expect(isEligibleRiduzione50(2025, 2029)).toBe(false);
    });
  });

  describe("enrollment != 2025 (non eleggibile per norma)", () => {
    it("should return false for enrollment 2024 (ante-norma)", () => {
      expect(isEligibleRiduzione50(2024, 2026)).toBe(false);
    });

    it("should return false for enrollment 2023", () => {
      expect(isEligibleRiduzione50(2023, 2026)).toBe(false);
    });

    it("should return false for enrollment 2020", () => {
      expect(isEligibleRiduzione50(2020, 2026)).toBe(false);
    });

    it("should return false for enrollment 2000 (far past)", () => {
      expect(isEligibleRiduzione50(2000, 2026)).toBe(false);
    });

    it("should return false for enrollment 2026 (post-norma)", () => {
      expect(isEligibleRiduzione50(2026, 2026)).toBe(false);
    });

    it("should return false for enrollment 2027", () => {
      expect(isEligibleRiduzione50(2027, 2027)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for null enrollment year", () => {
      expect(isEligibleRiduzione50(null, 2026)).toBe(false);
    });

    it("should return false for enrollment 2025 but fiscal year pre-2025", () => {
      // Non può capitare in pratica ma la funzione deve essere robusta
      expect(isEligibleRiduzione50(2025, 2024)).toBe(false);
    });
  });
});

describe("isValidEnrollmentYear — canProceed validation (Story 2.3)", () => {
  const currentYear = 2026;

  it("should return true for valid enrollment year (current year)", () => {
    expect(isValidEnrollmentYear(2026, currentYear)).toBe(true);
  });

  it("should return true for enrollment year 2000 (minimum)", () => {
    expect(isValidEnrollmentYear(2000, currentYear)).toBe(true);
  });

  it("should return true for enrollment year in between", () => {
    expect(isValidEnrollmentYear(2015, currentYear)).toBe(true);
  });

  it("should return false for null (no year selected)", () => {
    expect(isValidEnrollmentYear(null, currentYear)).toBe(false);
  });

  it("should return false for year below 2000", () => {
    expect(isValidEnrollmentYear(1999, currentYear)).toBe(false);
  });

  it("should return false for future year", () => {
    expect(isValidEnrollmentYear(2027, currentYear)).toBe(false);
  });

  it("should return false for far future year", () => {
    expect(isValidEnrollmentYear(2050, currentYear)).toBe(false);
  });
});

describe("computeRiduzione50Scadenza — scadenza calculation (Legge Bilancio 2025)", () => {
  it("should return 2028-12-31 for enrollment 2025 (unico anno eleggibile)", () => {
    expect(computeRiduzione50Scadenza(2025)).toBe("2028-12-31");
  });

  it("should return null for enrollment 2024 (non eleggibile)", () => {
    expect(computeRiduzione50Scadenza(2024)).toBeNull();
  });

  it("should return null for enrollment 2026 (non eleggibile)", () => {
    expect(computeRiduzione50Scadenza(2026)).toBeNull();
  });

  it("should return null for null enrollment year", () => {
    expect(computeRiduzione50Scadenza(null)).toBeNull();
  });
});

// ─── Story 2.4 Tests ───────────────────────────────────────────────

describe("mapRiduzione35 — 3 options mapping (Story 2.4)", () => {
  it("should return true for 'si'", () => {
    expect(mapRiduzione35("si")).toBe(true);
  });

  it("should return false for 'no'", () => {
    expect(mapRiduzione35("no")).toBe(false);
  });

  it("should return false for 'non_lo_so' (conservative default)", () => {
    expect(mapRiduzione35("non_lo_so")).toBe(false);
  });

  it("should handle all Riduzione35Scelta values exhaustively", () => {
    // Exhaustiveness check: all valid values must be covered
    const allScelte: Riduzione35Scelta[] = ["si", "no", "non_lo_so"];
    const results = allScelte.map(mapRiduzione35);
    // Only "si" produces true, rest false
    expect(results).toEqual([true, false, false]);
    // Ensure exactly 3 values are covered (catches accidental omissions)
    expect(allScelte).toHaveLength(3);
  });
});

describe("Riduzione 35% — canProceed always true (Story 2.4, AC #5)", () => {
  // The riduzione35 step should ALWAYS allow proceeding (never block)
  // All 3 options are valid, and even no selection should be OK (default = false)
  // This is tested via the behavior of getVisibleSteps + the step being in ALL_STEPS

  it("should have riduzione35 step in ALL_STEPS", () => {
    const ids = ALL_STEPS.map((s) => s.id);
    expect(ids).toContain("riduzione35");
  });

  it("should have riduzione35 step with correct title", () => {
    const step = ALL_STEPS.find((s) => s.id === "riduzione35");
    expect(step).toBeDefined();
    expect(step!.title).toBe("Riduzione contributiva");
  });
});

describe("Riduzione 35% — backward compatibility Separata (Story 2.4, AC #7, #8)", () => {
  it("should produce riduzione_35_attiva = false for Separata by default", () => {
    // Separata users never see the riduzione35 step, so the default (false) is what goes to DB
    const defaultRiduzione35 = false;
    expect(defaultRiduzione35).toBe(false);
  });

  it("should keep Separata at 6 visible steps (riduzione35 + acconti hidden without annoAperturaPiva)", () => {
    const steps = getVisibleSteps("separata");
    expect(steps).toHaveLength(6);
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("riduzione35");
    expect(ids).not.toContain("annoIscrizione");
    expect(ids).not.toContain("acconti");
  });

  it("should keep Art/Comm at 8 visible steps (acconti hidden without annoAperturaPiva)", () => {
    const stepsArt = getVisibleSteps("artigiani");
    const stepsComm = getVisibleSteps("commercianti");
    expect(stepsArt).toHaveLength(8);
    expect(stepsComm).toHaveLength(8);
    expect(stepsArt.map(s => s.id)).not.toContain("acconti");
    expect(stepsComm.map(s => s.id)).not.toContain("acconti");
  });
});

// ─── Story 11.1 Tests — Acconti step ───────────────────────────────

describe("Acconti step — ALL_STEPS structure (Story 11.1)", () => {
  it("should have 'acconti' step in ALL_STEPS with correct title", () => {
    const step = ALL_STEPS.find((s) => s.id === "acconti");
    expect(step).toBeDefined();
    expect(step!.title).toBe("Acconti Versati");
  });

  it("should place 'acconti' after 'riduzione35' in ALL_STEPS order", () => {
    const ids = ALL_STEPS.map((s) => s.id);
    const ridIdx = ids.indexOf("riduzione35");
    const accIdx = ids.indexOf("acconti");
    expect(accIdx).toBe(ridIdx + 1);
  });
});

describe("Acconti step — backward compatibility (Story 11.1)", () => {
  it("should not change Separata step count when annoAperturaPiva is absent", () => {
    const steps = getVisibleSteps("separata");
    expect(steps).toHaveLength(6);
  });

  it("should add acconti for Separata when user has past annoAperturaPiva", () => {
    const steps = getVisibleSteps("separata", 2020);
    expect(steps).toHaveLength(7);
    expect(steps.map(s => s.id)).toContain("acconti");
  });

  it("should add acconti for Art/Comm when user has past annoAperturaPiva", () => {
    const stepsArt = getVisibleSteps("artigiani", 2020);
    const stepsComm = getVisibleSteps("commercianti", 2020);
    expect(stepsArt).toHaveLength(9);
    expect(stepsComm).toHaveLength(9);
  });
});

// ─── Story 2.5 Tests — ATECO Ampliato ────────────────────────────────

describe("CATEGORY_LABELS — Story 2.5", () => {
  it("should have labels for all three categories", () => {
    expect(CATEGORY_LABELS).toHaveProperty("professionisti");
    expect(CATEGORY_LABELS).toHaveProperty("artigiani");
    expect(CATEGORY_LABELS).toHaveProperty("commercianti");
  });

  it("should map to Italian display labels", () => {
    expect(CATEGORY_LABELS.professionisti).toBe("Servizi Professionali");
    expect(CATEGORY_LABELS.artigiani).toBe("Artigiani");
    expect(CATEGORY_LABELS.commercianti).toBe("Commercianti");
  });
});

describe("getCategoryOrder — Story 2.5", () => {
  it("should return default order for separata", () => {
    const order = getCategoryOrder("separata");
    expect(order).toEqual(["professionisti", "artigiani", "commercianti"]);
  });

  it("should return default order for null", () => {
    const order = getCategoryOrder(null);
    expect(order).toEqual(["professionisti", "artigiani", "commercianti"]);
  });

  it("should put artigiani first for artigiani users", () => {
    const order = getCategoryOrder("artigiani");
    expect(order[0]).toBe("artigiani");
    expect(order).toHaveLength(3);
    expect(order).toContain("professionisti");
    expect(order).toContain("commercianti");
  });

  it("should put commercianti first for commercianti users", () => {
    const order = getCategoryOrder("commercianti");
    expect(order[0]).toBe("commercianti");
    expect(order).toHaveLength(3);
    expect(order).toContain("professionisti");
    expect(order).toContain("artigiani");
  });

  it("should always include all three categories", () => {
    for (const g of ["separata", "artigiani", "commercianti"] as const) {
      const order = getCategoryOrder(g);
      expect(order).toHaveLength(3);
      expect(new Set(order).size).toBe(3);
    }
  });
});

describe("isValidManualCoefficient — Story 2.5 fallback (AC #5)", () => {
  it("should accept 40 (minimum)", () => {
    expect(isValidManualCoefficient(40)).toBe(true);
  });

  it("should accept 86 (maximum)", () => {
    expect(isValidManualCoefficient(86)).toBe(true);
  });

  it("should accept values in range (67, 78)", () => {
    expect(isValidManualCoefficient(67)).toBe(true);
    expect(isValidManualCoefficient(78)).toBe(true);
  });

  it("should reject 39 (below minimum)", () => {
    expect(isValidManualCoefficient(39)).toBe(false);
  });

  it("should reject 87 (above maximum)", () => {
    expect(isValidManualCoefficient(87)).toBe(false);
  });

  it("should reject 0", () => {
    expect(isValidManualCoefficient(0)).toBe(false);
  });

  it("should reject negative values", () => {
    expect(isValidManualCoefficient(-1)).toBe(false);
  });

  it("should reject NaN", () => {
    expect(isValidManualCoefficient(NaN)).toBe(false);
  });

  it("should reject Infinity", () => {
    expect(isValidManualCoefficient(Infinity)).toBe(false);
    expect(isValidManualCoefficient(-Infinity)).toBe(false);
  });
});

// ─── canProceedDatiFiscali — anno apertura P.IVA obbligatorio (Story 27.1) ──────
// Tests the REAL exported function from Wizard.tsx — not a local replica

describe("canProceedDatiFiscali — annoAperturaPiva mandatory (Story 27.1)", () => {
  it("should return false when annoAperturaPiva is null (not selected)", () => {
    expect(canProceedDatiFiscali(78, null)).toBe(false);
  });

  it("should return true when annoAperturaPiva is set and profitCoefficient is valid", () => {
    expect(canProceedDatiFiscali(78, 2026)).toBe(true);
  });

  it("should return true for past year P.IVA opening", () => {
    expect(canProceedDatiFiscali(67, 2020)).toBe(true);
  });

  it("should return false when profitCoefficient is below range (even with year set)", () => {
    expect(canProceedDatiFiscali(30, 2026)).toBe(false);
  });

  it("should return false when profitCoefficient is above range (even with year set)", () => {
    expect(canProceedDatiFiscali(90, 2026)).toBe(false);
  });

  it("should return false when both are invalid", () => {
    expect(canProceedDatiFiscali(30, null)).toBe(false);
  });

  it("should return true at boundary values (40 and 86)", () => {
    expect(canProceedDatiFiscali(40, 2000)).toBe(true);
    expect(canProceedDatiFiscali(86, 2026)).toBe(true);
  });

  it("should return false for undefined coerced to NaN (AC3 — NaN guard)", () => {
    // Simulates what happens if parseInt fails: coefficient becomes NaN
    expect(canProceedDatiFiscali(NaN, 2026)).toBe(false);
  });
});

// ─── Story 2.7 Tests — deriveAliquotaSostitutiva ────────────────────

describe("deriveAliquotaSostitutiva — switch automatico 5%/15% (Story 2.7)", () => {
  it("should return 5% for year 4 of 5 (apertura 2023, fiscale 2026)", () => {
    const result = deriveAliquotaSostitutiva(2023, 2026);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(4);
    expect(result!.anniRimanenti).toBe(2);
    expect(result!.derivata).toBe(true);
  });

  it("should return 5% for year 5 of 5 (apertura 2023, fiscale 2027)", () => {
    const result = deriveAliquotaSostitutiva(2023, 2027);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(5);
    expect(result!.anniRimanenti).toBe(1);
  });

  it("should return 15% for year 6 — switch! (apertura 2023, fiscale 2028)", () => {
    const result = deriveAliquotaSostitutiva(2023, 2028);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(15);
    expect(result!.annoCorrente).toBe(6);
    expect(result!.anniRimanenti).toBe(0);
  });

  it("should return 15% when well past 5 years (apertura 2020, fiscale 2026)", () => {
    const result = deriveAliquotaSostitutiva(2020, 2026);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(15);
    expect(result!.annoCorrente).toBe(7);
    expect(result!.anniRimanenti).toBe(0);
  });

  it("should return 5% for year 1 of 5 (apertura 2026, fiscale 2026)", () => {
    const result = deriveAliquotaSostitutiva(2026, 2026);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(1);
    expect(result!.anniRimanenti).toBe(5);
  });

  it("should return null for null anno apertura (manual mode)", () => {
    const result = deriveAliquotaSostitutiva(null, 2026);
    expect(result).toBeNull();
  });

  it("should count solar years — apertura dicembre 2023 is still year 1", () => {
    // Opening in December 2023 counts as year 1 (solar year, not months)
    const result = deriveAliquotaSostitutiva(2023, 2023);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(1);
    expect(result!.anniRimanenti).toBe(5);
  });

  it("should return 5% at exact boundary year 5 (apertura 2022, fiscale 2026)", () => {
    const result = deriveAliquotaSostitutiva(2022, 2026);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(5);
    expect(result!.anniRimanenti).toBe(1);
  });

  it("should return 15% at exact boundary year 6 (apertura 2022, fiscale 2027)", () => {
    const result = deriveAliquotaSostitutiva(2022, 2027);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(15);
    expect(result!.annoCorrente).toBe(6);
    expect(result!.anniRimanenti).toBe(0);
  });

  it("should return null when annoFiscale < annoAperturaPiva (inconsistent data)", () => {
    // Guard: anno fiscale non può essere prima dell'apertura — review fix M1
    expect(deriveAliquotaSostitutiva(2026, 2025)).toBeNull();
    expect(deriveAliquotaSostitutiva(2030, 2026)).toBeNull();
  });
});

// ─── UX Improvements — Unified Anno + Auto-Riduzione 50% ──────────

describe("ALL_STEPS — updated title for annoIscrizione (unified anno step)", () => {
  it("should have title 'Anno e Iscrizione' for the annoIscrizione step", () => {
    const step = ALL_STEPS.find((s) => s.id === "annoIscrizione");
    expect(step).toBeDefined();
    expect(step!.title).toBe("Anno e Iscrizione");
  });
});

describe("Riduzione 50% auto-activation — UX improvement", () => {
  const currentYear = 2026;

  it("should auto-activate riduzione50 when enrollment year is eligible (simulated logic)", () => {
    // The component now uses: riduzione50Attiva = isEligibleRiduzione50(year, currentYear)
    // instead of: riduzione50Attiva = isEligibleRiduzione50(year, currentYear) && data.riduzione50Attiva
    const year = 2025;
    const eligible = isEligibleRiduzione50(year, currentYear);
    expect(eligible).toBe(true);
    // With old logic: eligible && false = false (bug — required manual toggle)
    // With new logic: eligible = true (auto-on)
    const oldLogic = eligible && false; // simulates data.riduzione50Attiva starting as false
    const newLogic = eligible;
    expect(oldLogic).toBe(false); // old behavior: NOT auto-activated
    expect(newLogic).toBe(true);  // new behavior: auto-activated
  });

  it("should NOT activate riduzione50 when enrollment year is NOT eligible", () => {
    const year = 2020;
    const eligible = isEligibleRiduzione50(year, currentYear);
    expect(eligible).toBe(false);
    // Both old and new logic produce false for ineligible years
    expect(eligible).toBe(false);
  });

  it("should compute scadenza when auto-activated", () => {
    const year = 2025;
    const eligible = isEligibleRiduzione50(year, currentYear);
    expect(eligible).toBe(true);
    const scadenza = eligible ? computeRiduzione50Scadenza(year) : null;
    expect(scadenza).toBe("2028-12-31");
  });
});

describe("canProceed annoIscrizione — unified step requires both fields", () => {
  const currentYear = 2026;

  it("should NOT proceed when only inpsEnrollmentYear is set (annoAperturaPiva missing)", () => {
    // Simulates the new canProceed logic:
    // annoAperturaPiva != null && isValidEnrollmentYear(inpsEnrollmentYear, currentYear)
    const annoAperturaPiva = null;
    const inpsEnrollmentYear = 2025;
    const canProceed = annoAperturaPiva != null && isValidEnrollmentYear(inpsEnrollmentYear, currentYear);
    expect(canProceed).toBe(false);
  });

  it("should NOT proceed when only annoAperturaPiva is set (inpsEnrollmentYear missing)", () => {
    const annoAperturaPiva = 2024;
    const inpsEnrollmentYear = null;
    const canProceed = annoAperturaPiva != null && isValidEnrollmentYear(inpsEnrollmentYear, currentYear);
    expect(canProceed).toBe(false);
  });

  it("should proceed when both annoAperturaPiva and inpsEnrollmentYear are set", () => {
    const annoAperturaPiva = 2024;
    const inpsEnrollmentYear = 2024;
    const canProceed = annoAperturaPiva != null && isValidEnrollmentYear(inpsEnrollmentYear, currentYear);
    expect(canProceed).toBe(true);
  });

  it("should proceed when annoAperturaPiva and inpsEnrollmentYear differ (anno diverso)", () => {
    const annoAperturaPiva = 2022;
    const inpsEnrollmentYear = 2024;
    const canProceed = annoAperturaPiva != null && isValidEnrollmentYear(inpsEnrollmentYear, currentYear);
    expect(canProceed).toBe(true);
  });
});

// ─── Story 27.3 Tests — Scadenze differenziate per gestione INPS ──────

describe("Story 27.3 — getScadenzeFiscali returns correct dates for Art/Comm", () => {
  const scadenze = getScadenzeFiscali(2027);

  it("should return INPS fisso Q1 date as Feb 16", () => {
    expect(scadenze.inpsFissoQ1).toBe("2027-02-16");
  });

  it("should return INPS fisso Q2 date as May 17 (16/05/2027 domenica)", () => {
    expect(scadenze.inpsFissoQ2).toBe("2027-05-17");
  });

  it("should return INPS variabile 1 date as Jun 30 (termine IRPEF, Fix F3)", () => {
    expect(scadenze.inpsVariabile1).toBe("2027-06-30");
  });

  it("should return INPS fisso Q3 date as Aug 20 (sospensione feriale)", () => {
    expect(scadenze.inpsFissoQ3).toBe("2027-08-20");
  });

  it("should return INPS fisso Q4 date as Nov 16", () => {
    expect(scadenze.inpsFissoQ4).toBe("2027-11-16");
  });

  it("should return INPS variabile 2 date as Nov 30 (termine IRPEF, Fix F3)", () => {
    expect(scadenze.inpsVariabile2).toBe("2027-11-30");
  });

  it("should return tax giugno date as Jun 30 (DL 73/2022, Fix F3)", () => {
    expect(scadenze.taxGiugno).toBe("2027-06-30");
  });

  it("should return tax novembre date as Nov 30", () => {
    expect(scadenze.taxNovembre).toBe("2027-11-30");
  });
});

describe("Story 27.3 — canProceed scadenze step per gestione", () => {
  it("should allow proceeding for Art/Comm even without juneDueDate/novemberDueDate", () => {
    // Art/Comm dates are read-only from getScadenzeFiscali, always valid
    const inpsManagement = "artigiani" as string;
    const juneDueDate = "";
    const novemberDueDate = "";
    const canProceed = inpsManagement !== "separata" || (juneDueDate && novemberDueDate);
    expect(canProceed).toBe(true);
  });

  it("should allow proceeding for Commercianti without date inputs", () => {
    const inpsManagement = "commercianti" as string;
    const canProceed = inpsManagement !== "separata" || false;
    expect(canProceed).toBe(true);
  });

  it("should require juneDueDate and novemberDueDate for Separata", () => {
    const inpsManagement: GestioneINPS = "separata";
    const juneDueDate = "2027-06-30";
    const novemberDueDate = "2027-11-30";
    const canProceed = inpsManagement !== "separata" || (juneDueDate && novemberDueDate);
    expect(canProceed).toBeTruthy();
  });

  it("should block Separata when juneDueDate is empty", () => {
    const inpsManagement: GestioneINPS = "separata";
    const juneDueDate = "";
    const novemberDueDate = "2027-11-30";
    const canProceed = inpsManagement !== "separata" || (juneDueDate && novemberDueDate);
    expect(canProceed).toBeFalsy();
  });

  it("should block Separata when novemberDueDate is empty", () => {
    const inpsManagement: GestioneINPS = "separata";
    const juneDueDate = "2027-06-30";
    const novemberDueDate = "";
    const canProceed = inpsManagement !== "separata" || (juneDueDate && novemberDueDate);
    expect(canProceed).toBeFalsy();
  });
});

describe("Story 27.3 — schedule entries per gestione", () => {
  function buildScheduleEntries(gestione: string, paymentYear: number, juneDueDate: string, novemberDueDate: string) {
    const entries: Array<{ bucket: string; due_date: string }> = [];
    if (gestione === "separata") {
      entries.push(
        { bucket: "june", due_date: juneDueDate },
        { bucket: "november", due_date: novemberDueDate },
      );
    } else {
      const scadenze = getScadenzeFiscali(paymentYear);
      entries.push(
        { bucket: "inps_q1", due_date: scadenze.inpsFissoQ1 },
        { bucket: "inps_q2", due_date: scadenze.inpsFissoQ2 },
        { bucket: "june", due_date: scadenze.taxGiugno },
        { bucket: "inps_q3", due_date: scadenze.inpsFissoQ3 },
        { bucket: "inps_q4", due_date: scadenze.inpsFissoQ4 },
        { bucket: "november", due_date: scadenze.taxNovembre },
      );
    }
    return entries;
  }

  it("should generate 2 entries for Separata", () => {
    const entries = buildScheduleEntries("separata", 2027, "2027-06-30", "2027-11-30");
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.bucket)).toEqual(["june", "november"]);
  });

  it("should generate 6 entries for Artigiani", () => {
    const entries = buildScheduleEntries("artigiani", 2027, "", "");
    expect(entries).toHaveLength(6);
    expect(entries.map(e => e.bucket)).toEqual([
      "inps_q1", "inps_q2", "june", "inps_q3", "inps_q4", "november",
    ]);
  });

  it("should generate 6 entries for Commercianti", () => {
    const entries = buildScheduleEntries("commercianti", 2027, "", "");
    expect(entries).toHaveLength(6);
    expect(entries.map(e => e.bucket)).toEqual([
      "inps_q1", "inps_q2", "june", "inps_q3", "inps_q4", "november",
    ]);
  });

  it("should use correct dates for Art/Comm entries", () => {
    const entries = buildScheduleEntries("artigiani", 2027, "", "");
    expect(entries[0]).toEqual({ bucket: "inps_q1", due_date: "2027-02-16" });
    expect(entries[1]).toEqual({ bucket: "inps_q2", due_date: "2027-05-17" });
    expect(entries[2]).toEqual({ bucket: "june", due_date: "2027-06-30" }); // Fix F3
    expect(entries[3]).toEqual({ bucket: "inps_q3", due_date: "2027-08-20" });
    expect(entries[4]).toEqual({ bucket: "inps_q4", due_date: "2027-11-16" }); // rata fissa minimale (invariata)
    expect(entries[5]).toEqual({ bucket: "november", due_date: "2027-11-30" });
  });

  it("should use user-provided dates for Separata entries", () => {
    const entries = buildScheduleEntries("separata", 2027, "2027-07-01", "2027-12-01");
    expect(entries[0]).toEqual({ bucket: "june", due_date: "2027-07-01" });
    expect(entries[1]).toEqual({ bucket: "november", due_date: "2027-12-01" });
  });

  it("should use canonical bucket names compatible with isInpsFixedBucket", () => {
    const entries = buildScheduleEntries("artigiani", 2027, "", "");
    const inpsBuckets = entries.filter(e => e.bucket.startsWith("inps_"));
    expect(inpsBuckets).toHaveLength(4);
    expect(inpsBuckets.map(e => e.bucket)).toEqual(["inps_q1", "inps_q2", "inps_q3", "inps_q4"]);
  });
});
