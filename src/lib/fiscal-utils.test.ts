/**
 * Test unitari per fiscal-utils.ts
 *
 * Copertura:
 * - deriveAliquotaSostitutiva: null input, guard, first 5 years, switch year,
 *   year before switch, far future, edge annoApertura === annoFiscale
 */

import { describe, it, expect } from "vitest";
import {
  deriveAliquotaSostitutiva,
  calcolaSogliaRagguagliata,
} from "@/lib/fiscal-utils";

describe("deriveAliquotaSostitutiva", () => {
  // === P0 ===

  it("[P0] returns null when annoAperturaPiva is null", () => {
    const result = deriveAliquotaSostitutiva(null, 2024);
    expect(result).toBeNull();
  });

  it("[P0] returns null when annoFiscale < annoAperturaPiva (guard)", () => {
    const result = deriveAliquotaSostitutiva(2024, 2023);
    expect(result).toBeNull();
  });

  it("[P0] within first 5 years returns aliquota 5%, derivata true, correct annoCorrente and anniRimanenti", () => {
    // annoApertura=2020, annoFiscale=2022 => year 3, switch at 2025, remaining=3
    const result = deriveAliquotaSostitutiva(2020, 2022);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.derivata).toBe(true);
    expect(result!.annoCorrente).toBe(3); // 2022-2020+1
    expect(result!.anniRimanenti).toBe(3); // max(0, 2025-2022)
  });

  it("[P0] exactly at switch year (annoApertura + 5) returns aliquota 15%", () => {
    // annoApertura=2020, switch=2025, annoFiscale=2025 => >= switch => 15%
    const result = deriveAliquotaSostitutiva(2020, 2025);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(15);
    expect(result!.derivata).toBe(true);
    expect(result!.annoCorrente).toBe(6); // 2025-2020+1
    expect(result!.anniRimanenti).toBe(0); // max(0, 2025-2025)
  });

  // === P1 ===

  it("[P1] year before switch returns aliquota 5%, anniRimanenti === 1", () => {
    // annoApertura=2020, switch=2025, annoFiscale=2024 => last year at 5%
    const result = deriveAliquotaSostitutiva(2020, 2024);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.anniRimanenti).toBe(1); // max(0, 2025-2024)
    expect(result!.annoCorrente).toBe(5); // 2024-2020+1
  });

  it("[P1] far future year returns aliquota 15%, anniRimanenti === 0", () => {
    // annoApertura=2020, annoFiscale=2050 => well past switch
    const result = deriveAliquotaSostitutiva(2020, 2050);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(15);
    expect(result!.anniRimanenti).toBe(0);
    expect(result!.annoCorrente).toBe(31); // 2050-2020+1
  });

  // === P2 ===

  it("[P2] annoApertura === annoFiscale (year 1) returns aliquota 5%, annoCorrente 1, anniRimanenti 5", () => {
    const result = deriveAliquotaSostitutiva(2024, 2024);
    expect(result).not.toBeNull();
    expect(result!.aliquota).toBe(5);
    expect(result!.annoCorrente).toBe(1); // 2024-2024+1
    expect(result!.anniRimanenti).toBe(5); // max(0, 2029-2024)
    expect(result!.derivata).toBe(true);
  });
});

/**
 * Story 88-1 — Ragguaglio ad anno della soglia 85k.
 *
 * Copertura:
 * - AC1: apertura 01/06/2026 -> 49.835,62 € (il caso calcolato a mano dal tester)
 * - AC2: apertura 01/01 -> soglia piena
 * - AC3: data null (utenti con solo l'anno) -> soglia piena, nessuna regressione
 * - AC4: anno successivo all'apertura -> soglia piena
 * - AC8: anno bisestile (divisore 366) + invarianza al timezone
 */
describe("calcolaSogliaRagguagliata", () => {
  it("[AC3] returns the full threshold when the opening date is unknown", () => {
    // Utenti pre-esistenti: hanno solo anno_apertura_piva, non il giorno.
    // Devono vedere esattamente cio' che vedevano prima della story.
    expect(calcolaSogliaRagguagliata(null, 2026)).toBe(85000);
  });

  it("[AC2] returns the full threshold for a 1 January opening", () => {
    expect(calcolaSogliaRagguagliata(new Date(2026, 0, 1), 2026)).toBe(85000);
  });

  // Il numero che il tester ha calcolato a mano nel suo feedback:
  // 85.000 × 214 / 365 = 49.835,62. 2026 non e' bisestile.
  it("[AC1] prorates a 1 June 2026 opening to 49835.62 (tester's case)", () => {
    expect(calcolaSogliaRagguagliata(new Date(2026, 5, 1), 2026)).toBe(49835.62);
  });

  it("[AC4] returns the full threshold for years after the opening year", () => {
    // Dal 2027 l'attivita' copre l'anno intero: nessun ragguaglio.
    expect(calcolaSogliaRagguagliata(new Date(2026, 5, 1), 2027)).toBe(85000);
  });

  it("prorates a 31 December opening to a single day", () => {
    // 85.000 × 1 / 365 = 232,88
    expect(calcolaSogliaRagguagliata(new Date(2026, 11, 31), 2026)).toBe(232.88);
  });

  // ADR-001 decisione 1: il divisore sono i giorni EFFETTIVI dell'anno.
  // Questo test e' il guard contro una regressione a /365 hardcodato, che
  // sarebbe invisibile fino al 2027 e sbagliato dal 2028.
  it("[AC8] uses 366 as the divisor in a leap year", () => {
    // 2028 e' bisestile. 1/7/2028 -> 31/12/2028 = 184 giorni (giorno incluso).
    // 85.000 × 184 / 366 = 42.732,24 (con /365 darebbe 42.849,32)
    expect(calcolaSogliaRagguagliata(new Date(2028, 6, 1), 2028)).toBe(42732.24);
  });

  it("[AC8] counts the opening day (ADR-001 decision 2)", () => {
    // 30/12/2026 -> 31/12 inclusi = 2 giorni, non 1
    // 85.000 × 2 / 365 = 465,75
    expect(calcolaSogliaRagguagliata(new Date(2026, 11, 30), 2026)).toBe(465.75);
  });

  it("honours an explicitly passed threshold", () => {
    // Per la futura 88-2, quando la soglia arrivera' dal DB per anno fiscale.
    // Esempio con 65.000: la soglia storica pre-L.197/2022, che il ragguaglio
    // lo prevedeva davvero.
    // NB: NON usare 100.000 come esempio — quella soglia non si ragguaglia MAI
    // (Circ. 32/E/2023 §4.3, «in termini assoluti»), e vederla qui inviterebbe
    // a passarla a questa funzione.
    // 65.000 × 214 / 365 = 38.109,59
    expect(calcolaSogliaRagguagliata(new Date(2026, 5, 1), 2026, 65000)).toBe(
      38109.59,
    );
  });

  it("[AC8] is invariant to the host timezone", () => {
    // Costruire le date in UTC (new Date("2026-06-01")) le sposta indietro di
    // un giorno nei fusi a est di Greenwich: il conteggio userebbe 215 giorni.
    const local = new Date(2026, 5, 1);
    expect(local.getDate()).toBe(1);
    expect(calcolaSogliaRagguagliata(local, 2026)).toBe(49835.62);
  });
});
