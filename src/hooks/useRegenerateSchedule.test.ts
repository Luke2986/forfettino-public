import { describe, it, expect } from "vitest";
import {
  scheduleEventToBucket,
  scheduleEventToAmounts,
  detectFirstYearArtComm,
  buildFirstYearINPSRows,
} from "./useRegenerateSchedule";
import { sumMoney } from "@/lib/money";
import type { ScheduleEvent, FiscalRulesParams } from "@/lib/fiscal-engine";

// ── scheduleEventToBucket tests ──

describe("scheduleEventToBucket", () => {
  describe("INPS_FISSO events", () => {
    it("maps Q1 to inps_q1", () => {
      const event: ScheduleEvent = {
        tipo: "INPS_FISSO",
        importo: 1000,
        dataScadenza: "2026-02-16",
        stato: "non_pagato",
        descrizione: "Rata INPS fissa Q1",
      };
      expect(scheduleEventToBucket(event)).toBe("inps_q1");
    });

    it("maps Q2 to inps_q2", () => {
      const event: ScheduleEvent = {
        tipo: "INPS_FISSO",
        importo: 1000,
        dataScadenza: "2026-05-16",
        stato: "non_pagato",
        descrizione: "Rata INPS fissa Q2",
      };
      expect(scheduleEventToBucket(event)).toBe("inps_q2");
    });

    it("maps Q3 to inps_q3", () => {
      const event: ScheduleEvent = {
        tipo: "INPS_FISSO",
        importo: 1000,
        dataScadenza: "2026-08-16",
        stato: "non_pagato",
        descrizione: "Rata INPS fissa Q3",
      };
      expect(scheduleEventToBucket(event)).toBe("inps_q3");
    });

    it("maps Q4 to inps_q4", () => {
      const event: ScheduleEvent = {
        tipo: "INPS_FISSO",
        importo: 1000,
        dataScadenza: "2026-11-16",
        stato: "non_pagato",
        descrizione: "Rata INPS fissa Q4",
      };
      expect(scheduleEventToBucket(event)).toBe("inps_q4");
    });
  });

  describe("INPS_VARIABILE events", () => {
    it("maps 1° rata to acconto_inps_1", () => {
      const event: ScheduleEvent = {
        tipo: "INPS_VARIABILE",
        importo: 500,
        dataScadenza: "2026-06-16",
        stato: "non_pagato",
        descrizione: "Acconto INPS variabile 1° rata",
      };
      expect(scheduleEventToBucket(event)).toBe("acconto_inps_1");
    });

    it("maps 2° rata to acconto_inps_2", () => {
      const event: ScheduleEvent = {
        tipo: "INPS_VARIABILE",
        importo: 500,
        dataScadenza: "2026-11-16",
        stato: "non_pagato",
        descrizione: "Acconto INPS variabile 2° rata",
      };
      expect(scheduleEventToBucket(event)).toBe("acconto_inps_2");
    });
  });

  describe("TAX events", () => {
    it("maps June 30 tax to acconto_tax_1 (legacy date fallback, Fix F3)", () => {
      const event: ScheduleEvent = {
        tipo: "TAX",
        importo: 300,
        dataScadenza: "2026-06-30",
        stato: "non_pagato",
        descrizione: "Acconto imposta sostitutiva 40%",
      };
      expect(scheduleEventToBucket(event)).toBe("acconto_tax_1");
    });

    it("maps November 30 tax to acconto_tax_2", () => {
      const event: ScheduleEvent = {
        tipo: "TAX",
        importo: 450,
        dataScadenza: "2026-11-30",
        stato: "non_pagato",
        descrizione: "Acconto imposta sostitutiva 60%",
      };
      expect(scheduleEventToBucket(event)).toBe("acconto_tax_2");
    });

    it("maps single-rate tax (November) to acconto_tax_2", () => {
      const event: ScheduleEvent = {
        tipo: "TAX",
        importo: 200,
        dataScadenza: "2026-11-30",
        stato: "non_pagato",
        descrizione: "Acconto imposta sostitutiva unica rata",
      };
      expect(scheduleEventToBucket(event)).toBe("acconto_tax_2");
    });
  });
});

// ── scheduleEventToAmounts tests ──

// ── Story 20-1: resolveGestione fallback tests ──

/**
 * Pure helper mirroring the fallback logic in useRegenerateSchedule.
 * Given the current year's gestione and a list of all fiscal_year_settings,
 * resolves the effective gestione (with fallback to most recent non-separata).
 *
 * NOTE (Code Review): Questo helper è un DUPLICATO locale della logica di
 * produzione (inline in regenerateForPaymentYear). I test validano la
 * LOGICA/DESIGN della risoluzione, NON il codice Supabase reale.
 * Per test di integrazione servirebbero mock Supabase completi.
 */
type FYSRecord = {
  fiscal_year: number;
  inps_management: string;
  riduzione_35_attiva: boolean;
};

function resolveGestione(
  currentGestione: string | null,
  currentRiduzione35: boolean,
  allSettings: FYSRecord[]
): { gestione: string; riduzione35Attiva: boolean } {
  // Fix F5: una gestione ESPLICITA (anche "separata") è autoritativa per il suo
  // anno e non va sovrascritta dal fallback cross-anno. Il fallback si applica
  // SOLO quando la gestione del reference_year è assente (null/"").
  if (currentGestione) {
    return { gestione: currentGestione, riduzione35Attiva: currentRiduzione35 };
  }
  // Gestione non impostata → cerca l'anno più recente con gestione esplicita non-separata
  const fallback = allSettings
    .filter((s) => s.inps_management && s.inps_management !== "separata")
    .sort((a, b) => b.fiscal_year - a.fiscal_year)[0];

  if (fallback) {
    return {
      gestione: fallback.inps_management,
      riduzione35Attiva: fallback.riduzione_35_attiva,
    };
  }
  return { gestione: "separata", riduzione35Attiva: currentRiduzione35 };
}

describe("Story 20-1: resolveGestione — fallback logic", () => {
  it("reference year separata ESPLICITO → NON usa il fallback (Fix F5)", () => {
    // Utente realmente in Gestione Separata nel 2025 che è passato a commercianti
    // nel 2026: le obbligazioni 2025 restano separata, NON vengono sovrascritte.
    const allSettings: FYSRecord[] = [
      { fiscal_year: 2025, inps_management: "separata", riduzione_35_attiva: false },
      { fiscal_year: 2026, inps_management: "commercianti", riduzione_35_attiva: true },
    ];
    const result = resolveGestione("separata", false, allSettings);
    expect(result.gestione).toBe("separata");
    expect(result.riduzione35Attiva).toBe(false);
  });

  it("reference year commercianti → does NOT use fallback", () => {
    const allSettings: FYSRecord[] = [
      { fiscal_year: 2025, inps_management: "commercianti", riduzione_35_attiva: true },
      { fiscal_year: 2026, inps_management: "artigiani", riduzione_35_attiva: false },
    ];
    const result = resolveGestione("commercianti", true, allSettings);
    expect(result.gestione).toBe("commercianti");
    expect(result.riduzione35Attiva).toBe(true);
  });

  it("reference year separata + no fallback available → stays separata", () => {
    const allSettings: FYSRecord[] = [
      { fiscal_year: 2025, inps_management: "separata", riduzione_35_attiva: false },
      { fiscal_year: 2026, inps_management: "separata", riduzione_35_attiva: false },
    ];
    const result = resolveGestione("separata", false, allSettings);
    expect(result.gestione).toBe("separata");
    expect(result.riduzione35Attiva).toBe(false);
  });

  it("gestione assente + più anni non-separata → picks most recent (fiscal_year DESC)", () => {
    const allSettings: FYSRecord[] = [
      { fiscal_year: 2023, inps_management: "artigiani", riduzione_35_attiva: false },
      { fiscal_year: 2024, inps_management: "commercianti", riduzione_35_attiva: true },
      { fiscal_year: 2025, inps_management: "separata", riduzione_35_attiva: false },
    ];
    // currentGestione null (reference_year non configurato) → fallback attivo
    const result = resolveGestione(null, false, allSettings);
    expect(result.gestione).toBe("commercianti");
    expect(result.riduzione35Attiva).toBe(true);
  });

  it("null gestione + fallback artigiani → uses artigiani", () => {
    const allSettings: FYSRecord[] = [
      { fiscal_year: 2024, inps_management: "artigiani", riduzione_35_attiva: true },
    ];
    const result = resolveGestione(null, false, allSettings);
    expect(result.gestione).toBe("artigiani");
    expect(result.riduzione35Attiva).toBe(true);
  });
});

// ── scheduleEventToAmounts tests ──

describe("scheduleEventToAmounts", () => {
  it("INPS_FISSO: importo goes to inps_balance", () => {
    const event: ScheduleEvent = {
      tipo: "INPS_FISSO",
      importo: 1234.56,
      dataScadenza: "2026-02-16",
      stato: "non_pagato",
      descrizione: "Rata INPS fissa Q1",
    };
    const amounts = scheduleEventToAmounts(event);
    expect(amounts.inps_balance).toBe(1234.56);
    expect(amounts.inps_advance).toBe(0);
    expect(amounts.tax_balance).toBe(0);
    expect(amounts.tax_advance).toBe(0);
  });

  it("INPS_VARIABILE: importo goes to inps_advance", () => {
    const event: ScheduleEvent = {
      tipo: "INPS_VARIABILE",
      importo: 567.89,
      dataScadenza: "2026-06-16",
      stato: "non_pagato",
      descrizione: "Acconto INPS variabile 1° rata",
    };
    const amounts = scheduleEventToAmounts(event);
    expect(amounts.inps_advance).toBe(567.89);
    expect(amounts.inps_balance).toBe(0);
    expect(amounts.tax_balance).toBe(0);
    expect(amounts.tax_advance).toBe(0);
  });

  it("TAX: importo goes to tax_advance", () => {
    const event: ScheduleEvent = {
      tipo: "TAX",
      importo: 890.12,
      dataScadenza: "2026-06-16",
      stato: "non_pagato",
      descrizione: "Acconto imposta sostitutiva 40%",
    };
    const amounts = scheduleEventToAmounts(event);
    expect(amounts.tax_advance).toBe(890.12);
    expect(amounts.tax_balance).toBe(0);
    expect(amounts.inps_balance).toBe(0);
    expect(amounts.inps_advance).toBe(0);
  });
});

// ── Story 39-1: First year Art/Comm detection and rate generation ──

// Minimal fiscal_year_settings shape for detection tests
type SettingsN = {
  inps_management: string;
  riduzione_35_attiva: boolean;
  riduzione_50_attiva: boolean;
  anno_apertura_piva: number | null;
};

// Realistic fiscal_rules params for 2026 (simplified for test clarity)
const mockFiscalRules2026: FiscalRulesParams = {
  fiscal_year: 2026,
  inps_rate_separata: 26.07,
  massimale_separata: 113520,
  aliquota_sostitutiva_5: 5,
  aliquota_sostitutiva_15: 15,
  inps_rate_artigiani: 24,
  inps_rate_artigiani_alta: 25,
  minimale_artigiani: 4427.04,
  massimale_artigiani: 86983,
  reddito_minimale: 18415,
  soglia_reddito_prima_fascia: 52190,
  maternita_annuale: 7.44,
  inps_rate_commercianti: 24.48,
  inps_rate_commercianti_alta: 25.48,
  minimale_commercianti: 4515.43,
  massimale_commercianti: 86983,
};

describe("Story 39-1: detectFirstYearArtComm", () => {
  it("artigiani first year → isFirstYear true", () => {
    const settingsN: SettingsN = {
      inps_management: "artigiani",
      riduzione_35_attiva: false,
      riduzione_50_attiva: false,
      anno_apertura_piva: 2026,
    };
    const result = detectFirstYearArtComm(settingsN, 2026);
    expect(result.isFirstYear).toBe(true);
    if (result.isFirstYear) {
      expect(result.gestione).toBe("artigiani");
      expect(result.riduzione35Attiva).toBe(false);
    }
  });

  it("commercianti first year → isFirstYear true", () => {
    const settingsN: SettingsN = {
      inps_management: "commercianti",
      riduzione_35_attiva: true,
      riduzione_50_attiva: false,
      anno_apertura_piva: 2026,
    };
    const result = detectFirstYearArtComm(settingsN, 2026);
    expect(result.isFirstYear).toBe(true);
    if (result.isFirstYear) {
      expect(result.gestione).toBe("commercianti");
      expect(result.riduzione35Attiva).toBe(true);
    }
  });

  it("separata → isFirstYear false (separata has no quarterly INPS)", () => {
    const settingsN: SettingsN = {
      inps_management: "separata",
      riduzione_35_attiva: false,
      riduzione_50_attiva: false,
      anno_apertura_piva: 2026,
    };
    const result = detectFirstYearArtComm(settingsN, 2026);
    expect(result.isFirstYear).toBe(false);
  });

  it("anno_apertura_piva null → isFirstYear false with error reason", () => {
    const settingsN: SettingsN = {
      inps_management: "artigiani",
      riduzione_35_attiva: false,
      riduzione_50_attiva: false,
      anno_apertura_piva: null,
    };
    const result = detectFirstYearArtComm(settingsN, 2026);
    expect(result.isFirstYear).toBe(false);
    expect((result as { isFirstYear: false; reason: string }).reason).toContain("Anno apertura");
  });

  it("anno_apertura_piva < paymentYear → isFirstYear false (not first year)", () => {
    const settingsN: SettingsN = {
      inps_management: "artigiani",
      riduzione_35_attiva: false,
      riduzione_50_attiva: false,
      anno_apertura_piva: 2024,
    };
    const result = detectFirstYearArtComm(settingsN, 2026);
    expect(result.isFirstYear).toBe(false);
    expect((result as { isFirstYear: false; reason: string }).reason).toContain("mancanti");
  });

  it("settingsN null → isFirstYear false", () => {
    const result = detectFirstYearArtComm(null, 2026);
    expect(result.isFirstYear).toBe(false);
  });
});

describe("Story 39-1: buildFirstYearINPSRows", () => {
  it("artigiani → generates exactly 4 rows (Q1-Q4) with correct buckets", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.bucket)).toEqual(["inps_q1", "inps_q2", "inps_q3", "inps_q4"]);
  });

  it("artigiani → due_date from getScadenzeFiscali(2026)", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    expect(rows[0].due_date).toBe("2026-02-16");
    expect(rows[1].due_date).toBe("2026-05-18"); // Circ. INPS 14/2026 — 16/05 sabato
    expect(rows[2].due_date).toBe("2026-08-20"); // pausa feriale + ferragosto
    expect(rows[3].due_date).toBe("2026-11-16");
  });

  it("artigiani → reference_year = paymentYear (same-year obligation)", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    for (const row of rows) {
      expect(row.reference_year).toBe(2026);
    }
  });

  it("artigiani → sum of total_expected = minimale_artigiani (exact via splitWithRemainder)", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    const sum = rows.reduce((acc, r) => sumMoney(acc, r.total_expected), 0);
    expect(sum).toBe(mockFiscalRules2026.minimale_artigiani);
  });

  it("artigiani → inps_balance + inps_advance = total_expected per row (exact)", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    for (const row of rows) {
      expect(row.inps_balance + row.inps_advance).toBe(row.total_expected);
    }
  });

  it("artigiani → inps_advance = maternita per rata (7.44/4 = 1.86)", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    const maternitaPerRata = Math.round((7.44 / 4) * 100) / 100; // 1.86
    for (const row of rows) {
      expect(row.inps_advance).toBe(maternitaPerRata);
    }
  });

  it("artigiani → tax_balance and tax_advance are zero", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    for (const row of rows) {
      expect(row.tax_balance).toBe(0);
      expect(row.tax_advance).toBe(0);
    }
  });

  it("commercianti → sum of total_expected = minimale_commercianti (exact)", () => {
    const rows = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, false, 2026);
    const sum = rows.reduce((acc, r) => sumMoney(acc, r.total_expected), 0);
    expect(sum).toBe(mockFiscalRules2026.minimale_commercianti);
  });

  it("artigiani con riduzione 35% → sum = minimale * 0.65 (exact via sumMoney)", () => {
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, true, 2026);
    const sum = rows.reduce((acc, r) => sumMoney(acc, r.total_expected), 0);
    // multiplyByPercent(4427.04, 65) = Math.round(4427.04 * 65) / 100 = 2877.58
    const expectedMinimale = Math.round(4427.04 * 65) / 100;
    expect(sum).toBe(expectedMinimale);
  });

  it("commercianti con riduzione 35% → sum = minimale * 0.65 (exact via sumMoney)", () => {
    const rows = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, true, 2026);
    const sum = rows.reduce((acc, r) => sumMoney(acc, r.total_expected), 0);
    const expectedMinimale = Math.round(4515.43 * 65) / 100;
    expect(sum).toBe(expectedMinimale);
  });

  it("commercianti → inps_advance = maternita per rata (7.44/4 = 1.86)", () => {
    const rows = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, false, 2026);
    const maternitaPerRata = Math.round((7.44 / 4) * 100) / 100; // 1.86
    for (const row of rows) {
      expect(row.inps_advance).toBe(maternitaPerRata);
    }
  });

  it("commercianti → due_date from getScadenzeFiscali(2026)", () => {
    const rows = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, false, 2026);
    expect(rows).toHaveLength(4);
    expect(rows[0].due_date).toBe("2026-02-16");
    expect(rows[1].due_date).toBe("2026-05-18"); // Circ. INPS 14/2026 — 16/05 sabato
    expect(rows[2].due_date).toBe("2026-08-20"); // pausa feriale + ferragosto
    expect(rows[3].due_date).toBe("2026-11-16");
  });

  it("commercianti → reference_year = paymentYear (same-year obligation)", () => {
    const rows = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, false, 2026);
    for (const row of rows) {
      expect(row.reference_year).toBe(2026);
    }
  });

  it("AC13: first-year rows (N) don't collide with Wizard skeleton rows (N+1)", () => {
    // First-year rates: payment_year = 2026, buckets inps_q1..q4
    const firstYearRows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    // Wizard skeleton: payment_year = 2027, same bucket names
    const skeletonPaymentYear = 2027;

    // The unique constraint is (user_id, payment_year, bucket).
    // Same buckets but different payment_year → no collision.
    for (const row of firstYearRows) {
      expect(row.reference_year).toBe(2026); // first-year rows use N
      // Skeleton rows would use payment_year = 2027
      expect(row.reference_year).not.toBe(skeletonPaymentYear);
    }

    // Buckets overlap (both use inps_q1..q4) but payment_year differs
    const firstYearKeys = firstYearRows.map((r) => `${2026}:${r.bucket}`);
    const skeletonKeys = ["inps_q1", "inps_q2", "inps_q3", "inps_q4", "june", "november"]
      .map((b) => `${skeletonPaymentYear}:${b}`);
    const overlap = firstYearKeys.filter((k) => skeletonKeys.includes(k));
    expect(overlap).toHaveLength(0);
  });
});

// ── Story 39-3: Orphan cleanup and gestione switch tests ──
// NOTE: I test "orphan cleanup" sotto sono DESIGN TESTS — validano l'intento della logica
// di cleanup (bucket validi, total_paid guard), non il codice Supabase reale che vive in
// regenerateFirstYearArtComm (hook asincrono con I/O non mockabile a questo livello).

describe("Story 39-3: orphan cleanup — cambio gestione e bucket validi", () => {
  it("buildFirstYearINPSRows genera SOLO bucket inps_q1..q4 (nessun bucket separata)", () => {
    // Scenario: utente passa da Separata ad Artigiani al primo anno
    // I bucket generati devono essere esattamente inps_q1..q4
    const rows = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    const buckets = rows.map((r) => r.bucket);
    expect(buckets).toEqual(["inps_q1", "inps_q2", "inps_q3", "inps_q4"]);
    // Nessun bucket separata (acconto_inps_1, acconto_inps_2, acconto_tax_1, acconto_tax_2, june, november)
    const separataBuckets = ["acconto_inps_1", "acconto_inps_2", "acconto_tax_1", "acconto_tax_2", "june", "november"];
    for (const b of separataBuckets) {
      expect(buckets).not.toContain(b);
    }
  });

  it("buildFirstYearINPSRows commercianti genera SOLO bucket inps_q1..q4", () => {
    const rows = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, false, 2026);
    const buckets = rows.map((r) => r.bucket);
    expect(buckets).toEqual(["inps_q1", "inps_q2", "inps_q3", "inps_q4"]);
  });

  it("detectFirstYearArtComm ritorna isFirstYear false per gestione separata (nessuna rate Q1-Q4)", () => {
    // Scenario: utente cambia da Art/Comm a Separata
    const settingsN: SettingsN = {
      inps_management: "separata",
      riduzione_35_attiva: false,
      riduzione_50_attiva: false,
      anno_apertura_piva: 2026,
    };
    const result = detectFirstYearArtComm(settingsN, 2026);
    expect(result.isFirstYear).toBe(false);
  });

  it("orphan cleanup: bucket validi per primo anno sono esattamente 4 (inps_q1..q4)", () => {
    // Verifica che il set di bucket validi usato dall'orphan cleanup
    // corrisponde esattamente ai bucket generati da buildFirstYearINPSRows
    const rowsArtigiani = buildFirstYearINPSRows("artigiani", mockFiscalRules2026, false, 2026);
    const rowsCommercianti = buildFirstYearINPSRows("commercianti", mockFiscalRules2026, false, 2026);
    const validBucketsArt = rowsArtigiani.map((r) => r.bucket);
    const validBucketsComm = rowsCommercianti.map((r) => r.bucket);

    // Entrambe le gestioni generano gli stessi bucket
    expect(validBucketsArt).toEqual(validBucketsComm);
    expect(validBucketsArt).toEqual(["inps_q1", "inps_q2", "inps_q3", "inps_q4"]);

    // Simulazione orphan cleanup: bucket "june" e "november" sarebbero orphan
    const existingBuckets = ["inps_q1", "inps_q2", "inps_q3", "inps_q4", "june", "november"];
    const orphans = existingBuckets.filter((b) => !validBucketsArt.includes(b));
    expect(orphans).toEqual(["june", "november"]);
  });

  it("orphan cleanup: bucket con total_paid > 0 NON vengono eliminati", () => {
    // Simulazione della logica di orphan cleanup dal codice di produzione
    const validBuckets = ["inps_q1", "inps_q2", "inps_q3", "inps_q4"];
    const existingSchedules = [
      { id: "s1", bucket: "inps_q1", total_paid: 0 },      // valid → keep
      { id: "s2", bucket: "june", total_paid: 0 },          // orphan, unpaid → delete
      { id: "s3", bucket: "november", total_paid: 500 },    // orphan, BUT paid → keep
      { id: "s4", bucket: "acconto_tax_1", total_paid: 0 }, // orphan, unpaid → delete
    ];

    // Replica della logica: !validBuckets.includes(bucket) && total_paid <= 0
    const orphanRows = existingSchedules.filter(
      (s) => !validBuckets.includes(s.bucket) && s.total_paid <= 0
    );
    expect(orphanRows.map((r) => r.id)).toEqual(["s2", "s4"]);
    // "s3" (november con total_paid=500) non viene eliminato
    expect(orphanRows.find((r) => r.id === "s3")).toBeUndefined();
  });
});
