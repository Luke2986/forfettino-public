import { describe, it, expect } from "vitest";
import {
  MARCA_BOLLO_IMPORTO,
  MARCA_BOLLO_SOGLIA,
  isBolloDovuto,
  totaleConBollo,
  estraiBollo,
} from "./marca-bollo";

describe("marca-bollo helpers", () => {
  describe("costanti", () => {
    it("importo bollo e' 2 €", () => {
      expect(MARCA_BOLLO_IMPORTO).toBe(2);
    });

    it("soglia normativa e' 77,47 €", () => {
      expect(MARCA_BOLLO_SOGLIA).toBe(77.47);
    });
  });

  describe("isBolloDovuto", () => {
    it("false a soglia esatta (77,47): il bollo NON e' dovuto", () => {
      expect(isBolloDovuto(77.47)).toBe(false);
    });

    it("true appena sopra soglia (77,48)", () => {
      expect(isBolloDovuto(77.48)).toBe(true);
    });

    it("false sotto soglia", () => {
      expect(isBolloDovuto(50)).toBe(false);
      expect(isBolloDovuto(0)).toBe(false);
    });

    it("true per importi tipici da fattura", () => {
      expect(isBolloDovuto(100)).toBe(true);
      expect(isBolloDovuto(1000)).toBe(true);
      expect(isBolloDovuto(1040)).toBe(true);
    });

    it("false per input nulli o negativi", () => {
      expect(isBolloDovuto(-10)).toBe(false);
      expect(isBolloDovuto(null)).toBe(false);
      expect(isBolloDovuto(undefined)).toBe(false);
    });
  });

  describe("totaleConBollo", () => {
    it("somma 2 € al subtotale", () => {
      expect(totaleConBollo(1000)).toBe(1002);
    });

    it("compone dopo la rivalsa: compenso 1000 + rivalsa 40 + bollo 2 = 1042", () => {
      // Ordine da feedback utente: bollo sommato al totale DOPO la rivalsa
      expect(totaleConBollo(1040)).toBe(1042);
    });

    it("gestisce decimali dispari in centesimi", () => {
      expect(totaleConBollo(999.99)).toBeCloseTo(1001.99, 2);
      expect(totaleConBollo(1283.94)).toBeCloseTo(1285.94, 2);
    });

    it("ritorna 2 per subtotale zero/nullo (caso degenere, non raggiungibile da UI)", () => {
      expect(totaleConBollo(0)).toBe(2);
      expect(totaleConBollo(null)).toBe(2);
      expect(totaleConBollo(undefined)).toBe(2);
    });
  });

  describe("estraiBollo", () => {
    it("con flag ON estrae 2 € e resto = totale - 2", () => {
      expect(estraiBollo(1042, true)).toEqual({ bollo: 2, resto: 1040 });
    });

    it("con flag OFF ritorna bollo 0 e resto = totale", () => {
      expect(estraiBollo(1042, false)).toEqual({ bollo: 0, resto: 1042 });
    });

    it("round-trip: totaleConBollo -> estraiBollo ricostruisce il subtotale", () => {
      for (const subtotale of [100, 500, 1040, 2730.52, 9999.99]) {
        const totale = totaleConBollo(subtotale);
        const { bollo, resto } = estraiBollo(totale, true);
        expect(bollo).toBe(2);
        expect(resto).toBeCloseTo(subtotale, 2);
      }
    });

    it("clamp: totale < 2 con flag ON non produce resto negativo", () => {
      expect(estraiBollo(1.5, true)).toEqual({ bollo: 2, resto: 0 });
      expect(estraiBollo(0, true)).toEqual({ bollo: 2, resto: 0 });
    });

    it("input nulli trattati come zero", () => {
      expect(estraiBollo(null, true)).toEqual({ bollo: 2, resto: 0 });
      expect(estraiBollo(undefined, false)).toEqual({ bollo: 0, resto: 0 });
    });
  });
});
