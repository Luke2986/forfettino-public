/**
 * Test unitari per money.ts
 *
 * Copertura:
 * - Conversioni euro/centesimi
 * - Arrotondamento deterministico
 * - Operazioni sicure (sum, subtract, multiply)
 * - Split con compensazione resto
 * - Calcoli fiscali (tax advances, INPS advances)
 * - Invarianti
 */

import { describe, it, expect } from "vitest";
import {
  toCents,
  toEuros,
  roundMoney,
  sumMoney,
  subtractMoney,
  multiplyByPercent,
  splitWithRemainder,
  split40_60,
  split50_50,
  isValidMoney,
  isNonNegative,
  sanitizeMoney,
  checkBreakdownEquals,
  calculateTaxAdvances,
  calculateInpsAdvances,
  formatCurrency,
} from "./money";

// === CONVERSIONI ===
describe("toCents", () => {
  it("converte euro in centesimi", () => {
    expect(toCents(100.50)).toBe(10050);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(1234.56)).toBe(123456);
  });

  it("gestisce null/undefined", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
  });

  it("gestisce NaN", () => {
    expect(toCents(NaN)).toBe(0);
  });

  it("arrotonda correttamente valori con più decimali", () => {
    // 100.505 * 100 = 10050.5 → arrotondato a 10051
    expect(toCents(100.505)).toBe(10051);
    expect(toCents(100.504)).toBe(10050);
  });
});

describe("toEuros", () => {
  it("converte centesimi in euro", () => {
    expect(toEuros(10050)).toBe(100.50);
    expect(toEuros(1)).toBe(0.01);
    expect(toEuros(123456)).toBe(1234.56);
  });
});

// === ARROTONDAMENTO ===
describe("roundMoney", () => {
  it("arrotonda a 2 decimali", () => {
    expect(roundMoney(100.555)).toBe(100.56);
    expect(roundMoney(100.554)).toBe(100.55);
    expect(roundMoney(100.5)).toBe(100.5);
  });

  it("gestisce null/undefined/NaN", () => {
    expect(roundMoney(null)).toBe(0);
    expect(roundMoney(undefined)).toBe(0);
    expect(roundMoney(NaN)).toBe(0);
  });
});

// === OPERAZIONI SICURE ===
describe("sumMoney", () => {
  it("somma importi correttamente", () => {
    // Famoso caso 0.1 + 0.2 = 0.30000000000000004
    expect(sumMoney(0.1, 0.2)).toBe(0.3);
    expect(sumMoney(100.10, 200.20, 300.30)).toBe(600.6);
  });

  it("gestisce null/undefined", () => {
    expect(sumMoney(100, null, 200, undefined)).toBe(300);
  });

  it("gestisce array vuoto", () => {
    expect(sumMoney()).toBe(0);
  });
});

describe("subtractMoney", () => {
  it("sottrae importi correttamente", () => {
    expect(subtractMoney(100, 30)).toBe(70);
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
  });

  it("gestisce null/undefined", () => {
    expect(subtractMoney(100, null)).toBe(100);
    expect(subtractMoney(null, 50)).toBe(-50);
  });
});

describe("multiplyByPercent", () => {
  it("moltiplica per percentuale", () => {
    expect(multiplyByPercent(1000, 15)).toBe(150); // 15% di 1000
    expect(multiplyByPercent(1000, 78)).toBe(780); // 78% di 1000
  });

  it("gestisce percentuali con decimali", () => {
    expect(multiplyByPercent(1000, 26.07)).toBe(260.7); // 26.07% di 1000
  });

  it("gestisce null/undefined", () => {
    expect(multiplyByPercent(null, 15)).toBe(0);
    expect(multiplyByPercent(undefined, 15)).toBe(0);
  });
});

// === SPLIT CON COMPENSAZIONE RESTO ===
describe("splitWithRemainder", () => {
  it("divide 50/50 correttamente", () => {
    const result = splitWithRemainder(100, [50, 50]);
    expect(result).toEqual([50, 50]);
    expect(result[0] + result[1]).toBe(100);
  });

  it("divide 40/60 correttamente", () => {
    const result = splitWithRemainder(100, [40, 60]);
    expect(result).toEqual([40, 60]);
    expect(result[0] + result[1]).toBe(100);
  });

  it("assegna resto alla seconda rata", () => {
    // 100.01 diviso 40/60 = 40.004 arrotondato a 40.00, resto 60.01
    const result = splitWithRemainder(100.01, [40, 60]);
    expect(result[0]).toBe(40);
    expect(result[1]).toBe(60.01);
    // Usa sumMoney per la verifica (evita floating point)
    expect(sumMoney(result[0], result[1])).toBe(100.01);
  });

  it("gestisce null/undefined", () => {
    const result = splitWithRemainder(null, [40, 60]);
    expect(result).toEqual([0, 0]);
  });

  it("gestisce tre rate", () => {
    const result = splitWithRemainder(100, [33, 33, 34]);
    expect(result[0] + result[1] + result[2]).toBe(100);
  });
});

describe("split40_60", () => {
  it("divide correttamente", () => {
    const { first, second } = split40_60(100);
    expect(first).toBe(40);
    expect(second).toBe(60);
  });

  it("somma uguale al totale", () => {
    const { first, second } = split40_60(257.53);
    // Usa sumMoney per evitare floating point nel test
    expect(sumMoney(first, second)).toBe(257.53);
  });
});

describe("split50_50", () => {
  it("divide correttamente", () => {
    const { first, second } = split50_50(100);
    expect(first).toBe(50);
    expect(second).toBe(50);
  });

  it("somma uguale al totale con decimali dispari", () => {
    const { first, second } = split50_50(100.01);
    // Usa sumMoney per evitare floating point nel test
    expect(sumMoney(first, second)).toBe(100.01);
  });
});

// === VALIDAZIONE ===
describe("isValidMoney", () => {
  it("riconosce numeri validi", () => {
    expect(isValidMoney(100)).toBe(true);
    expect(isValidMoney(0)).toBe(true);
    expect(isValidMoney(-50)).toBe(true);
  });

  it("riconosce valori invalidi", () => {
    expect(isValidMoney(NaN)).toBe(false);
    expect(isValidMoney(Infinity)).toBe(false);
    expect(isValidMoney("100")).toBe(false);
    expect(isValidMoney(null)).toBe(false);
    expect(isValidMoney(undefined)).toBe(false);
  });
});

describe("isNonNegative", () => {
  it("accetta valori >= 0", () => {
    expect(isNonNegative(100)).toBe(true);
    expect(isNonNegative(0)).toBe(true);
    expect(isNonNegative(0.01)).toBe(true);
  });

  it("rifiuta valori negativi", () => {
    expect(isNonNegative(-1)).toBe(false);
    expect(isNonNegative(-0.01)).toBe(false);
  });

  it("accetta null/undefined come 0", () => {
    expect(isNonNegative(null)).toBe(true);
    expect(isNonNegative(undefined)).toBe(true);
  });
});

describe("sanitizeMoney", () => {
  it("sanifica numeri validi", () => {
    expect(sanitizeMoney(100.555)).toBe(100.56);
    expect(sanitizeMoney(100)).toBe(100);
  });

  it("converte stringhe numeriche", () => {
    expect(sanitizeMoney("100.50")).toBe(100.5);
    expect(sanitizeMoney("invalid")).toBe(0);
  });

  it("gestisce valori invalidi", () => {
    expect(sanitizeMoney(null)).toBe(0);
    expect(sanitizeMoney(undefined)).toBe(0);
    expect(sanitizeMoney(NaN)).toBe(0);
    expect(sanitizeMoney({})).toBe(0);
  });
});

// === INVARIANTI ===
describe("checkBreakdownEquals", () => {
  it("verifica somma corretta", () => {
    expect(checkBreakdownEquals(100, [40, 60])).toBe(true);
    expect(checkBreakdownEquals(100, [30, 30, 40])).toBe(true);
  });

  it("tollera 0.01 di differenza", () => {
    // checkBreakdownEquals usa sumMoney internamente quindi funziona
    // Ma 40 + 59.99 = 99.99 che è a 0.01 dal 100, quindi dovrebbe passare
    expect(checkBreakdownEquals(99.99, [40, 59.99])).toBe(true);
    expect(checkBreakdownEquals(100.01, [40, 60.01])).toBe(true);
  });

  it("rifiuta differenze > 0.01", () => {
    expect(checkBreakdownEquals(100, [40, 59])).toBe(false);
    expect(checkBreakdownEquals(100, [40, 61])).toBe(false);
  });
});

// === CALCOLI FISCALI ===
describe("calculateTaxAdvances", () => {
  it("nessun acconto se <= 51.65", () => {
    const result = calculateTaxAdvances(51.65);
    expect(result.total).toBe(0);
    expect(result.first).toBe(0);
    expect(result.second).toBe(0);
    expect(result.single).toBe(0);
    expect(result.hasTwoPayments).toBe(false);
  });

  it("rata unica se 51.66 - 257.52", () => {
    const result = calculateTaxAdvances(200);
    expect(result.total).toBe(200);
    expect(result.first).toBe(0);
    expect(result.second).toBe(0);
    expect(result.single).toBe(200);
    expect(result.hasTwoPayments).toBe(false);
  });

  it("due rate se > 257.52", () => {
    const result = calculateTaxAdvances(1000);
    expect(result.total).toBe(1000);
    expect(result.first).toBe(400); // 40%
    expect(result.second).toBe(600); // 60%
    expect(result.single).toBe(0);
    expect(result.hasTwoPayments).toBe(true);
  });

  it("somma rate = totale", () => {
    const result = calculateTaxAdvances(1234.56);
    if (result.hasTwoPayments) {
      expect(result.first + result.second).toBe(result.total);
    } else {
      expect(result.single).toBe(result.total);
    }
  });
});

describe("calculateInpsAdvances", () => {
  it("calcola 80% del totale", () => {
    const result = calculateInpsAdvances(1000);
    expect(result.total).toBe(800); // 80% di 1000
  });

  it("divide 50/50", () => {
    const result = calculateInpsAdvances(1000);
    expect(result.first).toBe(400); // 50% di 800
    expect(result.second).toBe(400); // 50% di 800
  });

  it("somma rate = totale acconti", () => {
    const result = calculateInpsAdvances(1234.56);
    expect(result.first + result.second).toBe(result.total);
  });

  it("gestisce valori con decimali", () => {
    const result = calculateInpsAdvances(1234.56);
    expect(result.total).toBe(987.65); // 80% di 1234.56 = 987.648 → 987.65
  });
});

// === FORMATTAZIONE ===
describe("formatCurrency", () => {
  it("formatta in euro italiano", () => {
    const formatted = formatCurrency(1234.56);
    // Il formato può variare tra ambienti (es. "1.234,56 €" o "€ 1.234,56")
    expect(formatted).toContain("€");
    expect(formatted).toContain("1234"); // almeno le cifre principali
  });

  it("gestisce null/undefined", () => {
    expect(formatCurrency(null)).toContain("€");
    expect(formatCurrency(undefined)).toContain("€");
  });
});

// === CASI EDGE ===
describe("Edge cases", () => {
  it("gestisce 0 correttamente", () => {
    expect(toCents(0)).toBe(0);
    expect(toEuros(0)).toBe(0);
    expect(roundMoney(0)).toBe(0);
    expect(sumMoney(0, 0, 0)).toBe(0);
    expect(multiplyByPercent(0, 15)).toBe(0);
  });

  it("gestisce numeri molto grandi", () => {
    expect(toCents(10000000)).toBe(1000000000);
    expect(roundMoney(10000000.999)).toBe(10000001);
  });

  it("gestisce numeri molto piccoli", () => {
    expect(toCents(0.001)).toBe(0); // arrotondato
    expect(toCents(0.005)).toBe(1); // arrotondato a 1 cent
  });
});

// === SCENARIO REALE ===
describe("Scenario reale: calcolo completo anno fiscale", () => {
  it("calcola correttamente un anno fiscale tipico", () => {
    // Incassi lordi: 50.000€
    // Coefficiente redditività: 78%
    // Aliquota imposta: 15%
    // Aliquota INPS: 26.07%

    const incassiLordi = 50000;
    const profitCoeff = 78;
    const taxRate = 15;
    const inpsRate = 26.07;

    // Imponibile
    const taxable = multiplyByPercent(incassiLordi, profitCoeff);
    expect(taxable).toBe(39000); // 78% di 50000

    // Imposta
    const tax = multiplyByPercent(taxable, taxRate);
    expect(tax).toBe(5850); // 15% di 39000

    // INPS
    const inps = multiplyByPercent(taxable, inpsRate);
    expect(inps).toBe(10167.3); // 26.07% di 39000

    // Acconti imposta (sopra soglia 257.52)
    const taxAdv = calculateTaxAdvances(tax);
    expect(taxAdv.hasTwoPayments).toBe(true);
    expect(taxAdv.first).toBe(2340); // 40%
    expect(taxAdv.second).toBe(3510); // 60%
    expect(taxAdv.first + taxAdv.second).toBe(tax);

    // Acconti INPS (80% diviso 50/50)
    const inpsAdv = calculateInpsAdvances(inps);
    expect(inpsAdv.total).toBe(8133.84); // 80% di 10167.3
    expect(inpsAdv.first + inpsAdv.second).toBe(inpsAdv.total);

    // Verifica breakdown giugno
    const juneTotal = sumMoney(tax, inps, taxAdv.first, inpsAdv.first);
    expect(checkBreakdownEquals(juneTotal, [tax, inps, taxAdv.first, inpsAdv.first])).toBe(true);

    // Verifica breakdown novembre
    const novTotal = sumMoney(taxAdv.second, inpsAdv.second);
    expect(checkBreakdownEquals(novTotal, [taxAdv.second, inpsAdv.second])).toBe(true);
  });
});
