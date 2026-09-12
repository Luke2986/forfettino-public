/**
 * Test Story 40-4: riduzione50Attiva propagazione nelle pure functions di useRegenerateSchedule.
 *
 * Testa detectFirstYearArtComm e buildFirstYearINPSRows con riduzione 50%.
 */

import { describe, it, expect } from "vitest";
import { detectFirstYearArtComm, buildFirstYearINPSRows } from "../useRegenerateSchedule";
import { mockFiscalRulesData } from "./useFiscalCalculations.setup";
import type { FiscalRulesParams } from "@/lib/fiscal-engine";

const fiscalRules = mockFiscalRulesData as unknown as FiscalRulesParams;

describe("detectFirstYearArtComm — riduzione50Attiva", () => {
  it("restituisce riduzione50Attiva: true quando il campo DB è true", () => {
    const result = detectFirstYearArtComm(
      { inps_management: "artigiani", riduzione_35_attiva: false, riduzione_50_attiva: true, anno_apertura_piva: 2025 },
      2025
    );
    expect(result.isFirstYear).toBe(true);
    if (result.isFirstYear) {
      expect(result.riduzione50Attiva).toBe(true);
      expect(result.riduzione35Attiva).toBe(false);
    }
  });

  it("restituisce riduzione50Attiva: false quando il campo DB è false", () => {
    const result = detectFirstYearArtComm(
      { inps_management: "commercianti", riduzione_35_attiva: true, riduzione_50_attiva: false, anno_apertura_piva: 2025 },
      2025
    );
    expect(result.isFirstYear).toBe(true);
    if (result.isFirstYear) {
      expect(result.riduzione50Attiva).toBe(false);
      expect(result.riduzione35Attiva).toBe(true);
    }
  });

  it("non è primo anno se anno apertura < paymentYear (riduzione50 irrilevante)", () => {
    const result = detectFirstYearArtComm(
      { inps_management: "artigiani", riduzione_35_attiva: false, riduzione_50_attiva: true, anno_apertura_piva: 2024 },
      2025
    );
    expect(result.isFirstYear).toBe(false);
  });
});

describe("buildFirstYearINPSRows — riduzione50Attiva", () => {
  it("con rid50 attiva, i minimali sono ridotti (IVS al 50%, maternità intatta)", () => {
    const rowsNormali = buildFirstYearINPSRows("artigiani", fiscalRules, false, 2025, false);
    const rowsRid50 = buildFirstYearINPSRows("artigiani", fiscalRules, false, 2025, true);

    // Ogni rata con rid50 deve essere inferiore a quella senza riduzione
    for (let i = 0; i < 4; i++) {
      expect(rowsRid50[i].total_expected).toBeLessThan(rowsNormali[i].total_expected);
      // Maternità preservata: la differenza non è esattamente 50% del totale
      // perché la maternità non viene ridotta
      expect(rowsRid50[i].total_expected).toBeGreaterThan(0);
    }

    // Il totale con rid50 deve essere circa 50% dell'IVS + 100% maternità
    const totaleNormale = rowsNormali.reduce((s, r) => s + r.total_expected, 0);
    const totaleRid50 = rowsRid50.reduce((s, r) => s + r.total_expected, 0);
    const maternitaAnnuale = fiscalRules.maternita_annuale; // 7.44
    // totaleRid50 ≈ (totaleNormale - maternitaAnnuale) * 0.5 + maternitaAnnuale
    const expectedApprox = (totaleNormale - maternitaAnnuale) * 0.5 + maternitaAnnuale;
    expect(Math.abs(totaleRid50 - expectedApprox)).toBeLessThan(1); // tolleranza centesimi
  });

  it("con rid50 attiva per commercianti, importi ridotti", () => {
    const rowsNormali = buildFirstYearINPSRows("commercianti", fiscalRules, false, 2025, false);
    const rowsRid50 = buildFirstYearINPSRows("commercianti", fiscalRules, false, 2025, true);

    const totaleNormale = rowsNormali.reduce((s, r) => s + r.total_expected, 0);
    const totaleRid50 = rowsRid50.reduce((s, r) => s + r.total_expected, 0);
    expect(totaleRid50).toBeLessThan(totaleNormale);
    expect(totaleRid50).toBeGreaterThan(0);
  });

  it("con entrambe rid35 e rid50, rid50 prevale (engine guard)", () => {
    const rowsRid50 = buildFirstYearINPSRows("artigiani", fiscalRules, false, 2025, true);
    const rowsBoth = buildFirstYearINPSRows("artigiani", fiscalRules, true, 2025, true);

    // Engine: rid50 prevale su rid35 → stessi importi
    for (let i = 0; i < 4; i++) {
      expect(rowsBoth[i].total_expected).toBe(rowsRid50[i].total_expected);
    }
  });

  it("senza rid50, backward compat invariata", () => {
    const rowsSenza = buildFirstYearINPSRows("artigiani", fiscalRules, false, 2025);
    const rowsExplicit = buildFirstYearINPSRows("artigiani", fiscalRules, false, 2025, false);

    for (let i = 0; i < 4; i++) {
      expect(rowsSenza[i].total_expected).toBe(rowsExplicit[i].total_expected);
    }
  });
});
