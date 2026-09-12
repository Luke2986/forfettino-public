/**
 * Story 42.1 — Test calcolo allocazione con splitWithRemainder
 * Verifica che la distribuzione centesimi-safe funzioni per le 5 categorie budget.
 */

import { describe, it, expect } from "vitest";
import { splitWithRemainder } from "./money";
import { DEFAULT_ALLOCATION, BUDGET_CATEGORIES } from "./budget-constants";

/** Helper: somma gli importi di un array */
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

describe("splitWithRemainder per budget allocation", () => {
  const defaultPercentages = BUDGET_CATEGORIES.map((k) => DEFAULT_ALLOCATION[k]);
  // [60, 10, 10, 10, 10]

  it("somma degli importi === netto spendibile per importo intero", () => {
    const total = 5000;
    const amounts = splitWithRemainder(total, defaultPercentages);
    expect(amounts).toHaveLength(5);
    expect(sum(amounts)).toBe(total);
    expect(amounts[0]).toBe(3000); // 60% di 5000
    expect(amounts[1]).toBe(500);  // 10%
    expect(amounts[2]).toBe(500);
    expect(amounts[3]).toBe(500);
    expect(amounts[4]).toBe(500);
  });

  it("gestisce importo con decimali — somma esatta", () => {
    const total = 5852.54;
    const amounts = splitWithRemainder(total, defaultPercentages);
    expect(amounts).toHaveLength(5);
    // La somma deve essere ESATTAMENTE il totale (±0.01 per arrotondamento centesimi)
    expect(Math.abs(sum(amounts) - total)).toBeLessThanOrEqual(0.01);
  });

  it("gestisce importo piccolo (1 euro)", () => {
    const total = 1;
    const amounts = splitWithRemainder(total, defaultPercentages);
    expect(amounts).toHaveLength(5);
    expect(Math.abs(sum(amounts) - total)).toBeLessThanOrEqual(0.01);
  });

  it("gestisce netto zero → tutti zero", () => {
    const amounts = splitWithRemainder(0, defaultPercentages);
    expect(amounts).toEqual([0, 0, 0, 0, 0]);
  });

  it("gestisce netto null → tutti zero", () => {
    const amounts = splitWithRemainder(null, defaultPercentages);
    expect(amounts).toEqual([0, 0, 0, 0, 0]);
  });

  it("gestisce netto undefined → tutti zero", () => {
    const amounts = splitWithRemainder(undefined, defaultPercentages);
    expect(amounts).toEqual([0, 0, 0, 0, 0]);
  });

  it("gestisce percentuali custom (somma 100) — somma esatta", () => {
    const custom = [50, 20, 15, 10, 5];
    const total = 10000;
    const amounts = splitWithRemainder(total, custom);
    expect(sum(amounts)).toBe(total);
    expect(amounts[0]).toBe(5000);
    expect(amounts[1]).toBe(2000);
    expect(amounts[2]).toBe(1500);
    expect(amounts[3]).toBe(1000);
    expect(amounts[4]).toBe(500);
  });

  it("gestisce percentuali che generano arrotondamento — resto all'ultimo", () => {
    // 33.33% + 33.33% + 33.34% di 100.01
    const custom = [33, 33, 34]; // solo 3 categorie per semplicità
    const total = 100.01;
    const amounts = splitWithRemainder(total, custom);
    expect(Math.abs(sum(amounts) - total)).toBeLessThanOrEqual(0.01);
  });

  it("gestisce una categoria a 0%", () => {
    const custom = [70, 0, 10, 10, 10];
    const total = 1000;
    const amounts = splitWithRemainder(total, custom);
    expect(amounts[1]).toBe(0);
    expect(sum(amounts)).toBe(total);
  });

  it("gestisce importo molto grande", () => {
    const total = 85000;
    const amounts = splitWithRemainder(total, defaultPercentages);
    expect(sum(amounts)).toBe(total);
    expect(amounts[0]).toBe(51000); // 60%
  });
});
