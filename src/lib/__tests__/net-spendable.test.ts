/**
 * Test per le pure functions del "Netto Spendibile" — fix tech debt formula incoerente
 * (Impostazioni preview vs Dashboard).
 *
 * Le funzioni testate vivono in src/lib/fiscal-engine.ts:
 *   - computeBufferAmount
 *   - computeMonthlyToolCost / computeYearlyToolCost
 *   - computeUnpaidCurrentYearTotal
 *   - computeDaCopireAmount
 *   - computeNetSpendable
 *
 * Vedi memoria CLAUDE.md "tech debt Impostazioni netto spendibile".
 */

import { describe, it, expect } from "vitest";
import {
  computeBufferAmount,
  computeMonthlyToolCost,
  computeYearlyToolCost,
  computeUnpaidCurrentYearTotal,
  computePaidCurrentYearTotal,
  computeDaCopireAmount,
  computeNetSpendable,
  computeNetSpendableRaw,
  type NetSpendableInput,
  type DaCopireInput,
} from "../fiscal-engine";

// ============================================================================
// computeBufferAmount
// ============================================================================
describe("computeBufferAmount", () => {
  it("bufferBase=receipts: applica % su incassi YTD", () => {
    expect(computeBufferAmount("receipts", 5000, 20000, 5)).toBe(1000);
  });

  it("bufferBase=reserve: applica % su totalWithholding", () => {
    expect(computeBufferAmount("reserve", 5000, 20000, 10)).toBe(500);
  });

  it("rate 0%: ritorna 0 in entrambe le basi", () => {
    expect(computeBufferAmount("receipts", 5000, 20000, 0)).toBe(0);
    expect(computeBufferAmount("reserve", 5000, 20000, 0)).toBe(0);
  });

  it("totalWithholding NaN/null sanitizzato a 0 (base reserve)", () => {
    expect(computeBufferAmount("reserve", NaN as unknown as number, 20000, 10)).toBe(0);
    expect(computeBufferAmount("reserve", null as unknown as number, 20000, 10)).toBe(0);
  });

  it("incassiYTD NaN/null sanitizzato a 0 (base receipts)", () => {
    expect(computeBufferAmount("receipts", 5000, NaN as unknown as number, 5)).toBe(0);
  });
});

// ============================================================================
// computeMonthlyToolCost / computeYearlyToolCost
// ============================================================================
describe("computeMonthlyToolCost", () => {
  it("subscriptions vuote o null: ritorna 0", () => {
    expect(computeMonthlyToolCost(null)).toBe(0);
    expect(computeMonthlyToolCost(undefined)).toBe(0);
    expect(computeMonthlyToolCost([])).toBe(0);
  });

  it("normalizza yearly / quarterly / monthly", () => {
    const subs = [
      { cost: 120, frequency: "yearly" }, // 10/mese
      { cost: 30, frequency: "quarterly" }, // 10/mese
      { cost: 5, frequency: "monthly" }, // 5/mese
    ];
    expect(computeMonthlyToolCost(subs)).toBe(25);
  });

  it("cost null/NaN sanitizzato a 0", () => {
    const subs = [
      { cost: null as unknown as number, frequency: "monthly" },
      { cost: 12, frequency: "yearly" },
    ];
    expect(computeMonthlyToolCost(subs)).toBe(1); // 12/12
  });
});

describe("computeYearlyToolCost", () => {
  it("monthly × 12", () => {
    expect(computeYearlyToolCost(25)).toBe(300);
    expect(computeYearlyToolCost(0)).toBe(0);
  });

  it("monthly NaN/null → 0", () => {
    expect(computeYearlyToolCost(NaN as unknown as number)).toBe(0);
    expect(computeYearlyToolCost(null as unknown as number)).toBe(0);
  });
});

// ============================================================================
// computeUnpaidCurrentYearTotal
// ============================================================================
describe("computeUnpaidCurrentYearTotal", () => {
  it("schedules vuote/null: ritorna 0", () => {
    expect(computeUnpaidCurrentYearTotal(null, 0, 0)).toBe(0);
    expect(computeUnpaidCurrentYearTotal([], 0, 0)).toBe(0);
  });

  it("filtra status='paid' e somma residui", () => {
    const schedules = [
      { status: "non_pagato", total_expected: 1000, total_paid: 200 }, // 800
      { status: "non_pagato", total_expected: 500, total_paid: 0 },    // 500
      { status: "paid", total_expected: 999, total_paid: 999 },        // skip
    ];
    expect(computeUnpaidCurrentYearTotal(schedules, 0, 0)).toBe(1300);
  });

  it("sottrae acconti versati e clampa a 0", () => {
    const schedules = [
      { status: "non_pagato", total_expected: 1000, total_paid: 0 },
    ];
    expect(computeUnpaidCurrentYearTotal(schedules, 300, 200)).toBe(500);
    // Sopra-coverage: acconti totali > residuo → 0 (nessun negativo)
    expect(computeUnpaidCurrentYearTotal(schedules, 700, 500)).toBe(0);
  });

  it("acconti versati NaN/null sanitizzati", () => {
    const schedules = [
      { status: "non_pagato", total_expected: 1000, total_paid: 0 },
    ];
    expect(
      computeUnpaidCurrentYearTotal(schedules, NaN as unknown as number, null as unknown as number),
    ).toBe(1000);
  });
});

// ============================================================================
// computeDaCopireAmount
// ============================================================================
describe("computeDaCopireAmount", () => {
  it("Separata (Fix F1): imposta(deducibilità) + INPS totale, ignora totalWithholding lordo", () => {
    const input: DaCopireInput = {
      inpsManagement: "separata",
      totalWithholding: 9999, // lordo, ora ignorato dal ramo Separata
      impostaConDeducibilita: 3000,
      inpsVariabile: 0,
      inpsTotale: 1500,
    };
    expect(computeDaCopireAmount(input)).toBe(4500);
  });

  it("Artigiani: ritorna impostaConDeducibilita + inpsVariabile (no minimale)", () => {
    const input: DaCopireInput = {
      inpsManagement: "artigiani",
      totalWithholding: 9999, // ignorato
      impostaConDeducibilita: 2000,
      inpsVariabile: 800,
      inpsTotale: 5000, // ignorato per Art/Comm (minimale già nelle scadenze)
    };
    expect(computeDaCopireAmount(input)).toBe(2800);
  });

  it("Commercianti: ritorna impostaConDeducibilita + inpsVariabile (no minimale)", () => {
    const input: DaCopireInput = {
      inpsManagement: "commercianti",
      totalWithholding: 9999, // ignorato
      impostaConDeducibilita: 1500,
      inpsVariabile: 600,
      inpsTotale: 5000, // ignorato per Art/Comm
    };
    expect(computeDaCopireAmount(input)).toBe(2100);
  });

  it("input NaN/null sanitizzati", () => {
    const input: DaCopireInput = {
      inpsManagement: "separata",
      totalWithholding: NaN as unknown as number,
      impostaConDeducibilita: NaN as unknown as number,
      inpsVariabile: 0,
      inpsTotale: NaN as unknown as number,
    };
    expect(computeDaCopireAmount(input)).toBe(0);
  });
});

// ============================================================================
// computeNetSpendable — formula finale unificata
// ============================================================================
describe("computeNetSpendable", () => {
  it("scenario base Separata: tutti i deduttori aggiuntivi a 0", () => {
    const input: NetSpendableInput = {
      saldoInizialeCC: 0,
      incassiYTD: 10000,
      daCopireAmount: 2500,
      bufferAmount: 500,
      yearlyToolCost: 0,
      unpaidCurrentYearTotal: 0,
      paidCurrentYearTotal: 0,
      reserveAmount: 0,
    };
    expect(computeNetSpendable(input)).toBe(7000);
  });

  it("include saldoInizialeCC nella base (Story 19-1)", () => {
    const input: NetSpendableInput = {
      saldoInizialeCC: 3000,
      incassiYTD: 10000,
      daCopireAmount: 2500,
      bufferAmount: 500,
      yearlyToolCost: 600,
      unpaidCurrentYearTotal: 1000,
      paidCurrentYearTotal: 0,
      reserveAmount: 200,
    };
    // 3000 + 10000 − 2500 − 500 − 600 − 1000 − 200 = 8200
    expect(computeNetSpendable(input)).toBe(8200);
  });

  it("clampa a 0 quando deduttori superano la base", () => {
    const input: NetSpendableInput = {
      saldoInizialeCC: 0,
      incassiYTD: 1000,
      daCopireAmount: 2000,
      bufferAmount: 0,
      yearlyToolCost: 0,
      unpaidCurrentYearTotal: 0,
      paidCurrentYearTotal: 0,
      reserveAmount: 0,
    };
    expect(computeNetSpendable(input)).toBe(0);
  });

  it("input NaN/null sanitizzati a 0", () => {
    const input: NetSpendableInput = {
      saldoInizialeCC: NaN as unknown as number,
      incassiYTD: 10000,
      daCopireAmount: null as unknown as number,
      bufferAmount: undefined as unknown as number,
      yearlyToolCost: 0,
      unpaidCurrentYearTotal: 0,
      paidCurrentYearTotal: 0,
      reserveAmount: 0,
    };
    expect(computeNetSpendable(input)).toBe(10000);
  });

  it("scenario Art/Comm: daCopireAmount esclude minimale (già in unpaidCurrentYearTotal)", () => {
    // Simula utente Artigiano:
    //   saldoInizialeCC = 0
    //   incassi = 30.000
    //   imposta deducibilità = 1.800, INPS variabile = 600 → daCopire = 2.400
    //   minimale INPS già ripartito in 4 rate trimestrali nello schedule → unpaid = 2.939
    //   buffer 5% × 30.000 = 1.500
    //   yearlyToolCost = 0, reserve = 0
    // Totale = 30.000 − 2.400 − 1.500 − 2.939 = 23.161
    const input: NetSpendableInput = {
      saldoInizialeCC: 0,
      incassiYTD: 30000,
      daCopireAmount: 2400,
      bufferAmount: 1500,
      yearlyToolCost: 0,
      unpaidCurrentYearTotal: 2939,
      paidCurrentYearTotal: 0,
      reserveAmount: 0,
    };
    expect(computeNetSpendable(input)).toBe(23161);
  });

  it("è deterministica e pura — chiamate multiple ritornano stesso valore", () => {
    const input: NetSpendableInput = {
      saldoInizialeCC: 1234.56,
      incassiYTD: 5678.9,
      daCopireAmount: 1000,
      bufferAmount: 100,
      yearlyToolCost: 50,
      unpaidCurrentYearTotal: 200,
      paidCurrentYearTotal: 0,
      reserveAmount: 30,
    };
    const r1 = computeNetSpendable(input);
    const r2 = computeNetSpendable(input);
    const r3 = computeNetSpendable({ ...input });
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it("INVARIANTE: Dashboard e Impostazioni con stessi input devono ritornare lo STESSO spendable", () => {
    // Garanzia formale del fix tech debt: chiamate da call site diversi (Dashboard, Impostazioni)
    // producono valore identico se l'input è identico — single source of truth.
    const sharedInput: NetSpendableInput = {
      saldoInizialeCC: 2000,
      incassiYTD: 15000,
      daCopireAmount: 3500,
      bufferAmount: 750,
      yearlyToolCost: 240,
      unpaidCurrentYearTotal: 1100,
      paidCurrentYearTotal: 0,
      reserveAmount: 500,
    };
    const fromDashboard = computeNetSpendable(sharedInput);
    const fromImpostazioni = computeNetSpendable(sharedInput);
    expect(fromDashboard).toBe(fromImpostazioni);
    // 2000 + 15000 − 3500 − 750 − 240 − 1100 − 0 − 500 = 10910
    expect(fromDashboard).toBe(10910);
  });
});

// ============================================================================
// computePaidCurrentYearTotal
// ============================================================================
describe("computePaidCurrentYearTotal", () => {
  it("schedules vuote/null: ritorna 0", () => {
    expect(computePaidCurrentYearTotal(null)).toBe(0);
    expect(computePaidCurrentYearTotal([])).toBe(0);
  });

  it("somma total_paid di TUTTE le righe (pagate + parziali + aperte)", () => {
    const schedules = [
      { status: "paid", total_expected: 1000, total_paid: 1000 },
      { status: "partial", total_expected: 500, total_paid: 200 },
      { status: "open", total_expected: 800, total_paid: 0 },
    ];
    expect(computePaidCurrentYearTotal(schedules)).toBe(1200);
  });

  it("total_paid NaN/null sanitizzato a 0", () => {
    const schedules = [
      { status: "paid", total_expected: 1000, total_paid: NaN as unknown as number },
      { status: "partial", total_expected: 500, total_paid: null as unknown as number },
    ];
    expect(computePaidCurrentYearTotal(schedules)).toBe(0);
  });
});

// ============================================================================
// INVARIANTE OPZIONE 2 — segnare una rata pagata NON cambia il netto spendibile
// ============================================================================
describe("INVARIANTE: mark-as-paid non altera il netto spendibile", () => {
  // Base comune: incassi 20.000, daCopire 3.000, buffer 0, tool 0, reserve 0,
  // acconti 0. Una sola scadenza anno corrente da 2.000.
  const buildInput = (
    schedules: { status: string; total_expected: number; total_paid: number }[],
  ): NetSpendableInput => ({
    saldoInizialeCC: 0,
    incassiYTD: 20000,
    daCopireAmount: 3000,
    bufferAmount: 0,
    yearlyToolCost: 0,
    unpaidCurrentYearTotal: computeUnpaidCurrentYearTotal(schedules, 0, 0),
    paidCurrentYearTotal: computePaidCurrentYearTotal(schedules),
    reserveAmount: 0,
  });

  it("pagamento PIENO: spendibile identico prima e dopo", () => {
    const before = [{ status: "open", total_expected: 2000, total_paid: 0 }];
    const after = [{ status: "paid", total_expected: 2000, total_paid: 2000 }];

    const spendableBefore = computeNetSpendable(buildInput(before));
    const spendableAfter = computeNetSpendable(buildInput(after));

    // Prima del fix: dopo saliva di 2.000. Ora invariato.
    expect(spendableAfter).toBe(spendableBefore);
    // 20000 − 3000 − 2000(unpaid) − 0(paid) = 15000  → identico dopo:
    // 20000 − 3000 − 0(unpaid) − 2000(paid) = 15000
    expect(spendableBefore).toBe(15000);
  });

  it("pagamento PARZIALE: spendibile identico (residuo + pagato si compensano)", () => {
    const before = [{ status: "open", total_expected: 2000, total_paid: 0 }];
    const partial = [{ status: "partial", total_expected: 2000, total_paid: 800 }];

    expect(computeNetSpendable(buildInput(partial))).toBe(
      computeNetSpendable(buildInput(before)),
    );
  });

  it("raw (pre-clamp) coerente: la deduzione paidCurrentYearTotal entra nella formula", () => {
    const paid = [{ status: "paid", total_expected: 2000, total_paid: 2000 }];
    const input = buildInput(paid);
    // raw = 20000 − 3000 − 0 − 2000 − 0 = 15000
    expect(computeNetSpendableRaw(input)).toBe(15000);
  });
});
