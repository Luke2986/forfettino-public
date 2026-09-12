/**
 * Story 42.1 — Test unitari per budget-constants.ts
 * Copertura: validazione, totali, default, edge cases
 */

import { describe, it, expect } from "vitest";
import {
  BUDGET_CATEGORIES,
  DEFAULT_ALLOCATION,
  CATEGORY_LABELS,
  CATEGORY_BAR_COLORS,
  isValidBudgetAllocation,
  allocationTotal,
  type BudgetAllocation,
} from "./budget-constants";

describe("budget-constants", () => {
  describe("DEFAULT_ALLOCATION", () => {
    it("ha esattamente 5 categorie", () => {
      expect(Object.keys(DEFAULT_ALLOCATION)).toHaveLength(5);
    });

    it("somma a 100%", () => {
      expect(allocationTotal(DEFAULT_ALLOCATION)).toBe(100);
    });

    it("default: necessità 60%, resto 10% ciascuno", () => {
      expect(DEFAULT_ALLOCATION.necessita).toBe(60);
      expect(DEFAULT_ALLOCATION.investimenti).toBe(10);
      expect(DEFAULT_ALLOCATION.risparmio).toBe(10);
      expect(DEFAULT_ALLOCATION.formazione).toBe(10);
      expect(DEFAULT_ALLOCATION.svago).toBe(10);
    });
  });

  describe("BUDGET_CATEGORIES", () => {
    it("ogni categoria ha label, colore barra e colore dot", () => {
      for (const key of BUDGET_CATEGORIES) {
        expect(CATEGORY_LABELS[key]).toBeTruthy();
        expect(CATEGORY_BAR_COLORS[key]).toMatch(/^bg-/);
      }
    });
  });

  describe("isValidBudgetAllocation", () => {
    it("accetta una config valida", () => {
      expect(isValidBudgetAllocation(DEFAULT_ALLOCATION)).toBe(true);
    });

    it("accetta config custom con somma != 100 (la validazione somma è separata)", () => {
      const custom: BudgetAllocation = { necessita: 50, investimenti: 20, risparmio: 20, formazione: 5, svago: 5 };
      expect(isValidBudgetAllocation(custom)).toBe(true);
    });

    it("rifiuta null / undefined / non-oggetto", () => {
      expect(isValidBudgetAllocation(null)).toBe(false);
      expect(isValidBudgetAllocation(undefined)).toBe(false);
      expect(isValidBudgetAllocation("stringa")).toBe(false);
      expect(isValidBudgetAllocation(42)).toBe(false);
    });

    it("rifiuta oggetto con chiavi mancanti", () => {
      expect(isValidBudgetAllocation({ necessita: 60 })).toBe(false);
    });

    it("rifiuta oggetto con valori non numerici", () => {
      expect(isValidBudgetAllocation({
        necessita: "60", investimenti: 10, risparmio: 10, formazione: 10, svago: 10,
      })).toBe(false);
    });

    it("rifiuta valori negativi", () => {
      expect(isValidBudgetAllocation({
        necessita: -10, investimenti: 10, risparmio: 10, formazione: 10, svago: 10,
      })).toBe(false);
    });

    it("rifiuta valori > 100", () => {
      expect(isValidBudgetAllocation({
        necessita: 110, investimenti: 10, risparmio: 10, formazione: 10, svago: 10,
      })).toBe(false);
    });
  });

  describe("allocationTotal", () => {
    it("calcola la somma delle percentuali", () => {
      expect(allocationTotal(DEFAULT_ALLOCATION)).toBe(100);
    });

    it("calcola somma per config custom", () => {
      const custom: BudgetAllocation = { necessita: 50, investimenti: 20, risparmio: 15, formazione: 10, svago: 5 };
      expect(allocationTotal(custom)).toBe(100);
    });

    it("gestisce config con somma != 100", () => {
      const bad: BudgetAllocation = { necessita: 50, investimenti: 10, risparmio: 10, formazione: 10, svago: 10 };
      expect(allocationTotal(bad)).toBe(90);
    });

    it("gestisce tutti zero", () => {
      const zeros: BudgetAllocation = { necessita: 0, investimenti: 0, risparmio: 0, formazione: 0, svago: 0 };
      expect(allocationTotal(zeros)).toBe(0);
    });
  });
});
