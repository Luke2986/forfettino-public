import { describe, it, expect } from "vitest";
import {
  RIVALSA_INPS_RATE,
  breakdownFromCompenso,
  breakdownFromTotale,
  isGestioneSeparata,
} from "./rivalsa-inps";

describe("rivalsa-inps helpers", () => {
  describe("RIVALSA_INPS_RATE", () => {
    it("e' 4%", () => {
      expect(RIVALSA_INPS_RATE).toBe(4);
    });
  });

  describe("breakdownFromCompenso", () => {
    it("calcola rivalsa 4% e totale fattura su un compenso", () => {
      const { compenso, rivalsa, totale } = breakdownFromCompenso(1000);
      expect(compenso).toBe(1000);
      expect(rivalsa).toBe(40);
      expect(totale).toBe(1040);
    });

    it("gestisce importi con decimali", () => {
      const { compenso, rivalsa, totale } = breakdownFromCompenso(1234.56);
      expect(compenso).toBe(1234.56);
      expect(rivalsa).toBeCloseTo(49.38, 2);
      expect(totale).toBeCloseTo(1283.94, 2);
    });

    it("ritorna zero per compenso nullo", () => {
      expect(breakdownFromCompenso(0)).toEqual({ compenso: 0, rivalsa: 0, totale: 0 });
      expect(breakdownFromCompenso(null)).toEqual({ compenso: 0, rivalsa: 0, totale: 0 });
      expect(breakdownFromCompenso(undefined)).toEqual({ compenso: 0, rivalsa: 0, totale: 0 });
    });
  });

  describe("breakdownFromTotale", () => {
    it("estrae rivalsa e compenso dato il totale fattura (round-trip 1040 -> 1000+40)", () => {
      const { compenso, rivalsa, totale } = breakdownFromTotale(1040);
      expect(totale).toBe(1040);
      expect(rivalsa).toBe(40);
      expect(compenso).toBe(1000);
    });

    it("roundtrip: breakdownFromCompenso(x).totale fed into breakdownFromTotale ricostruisce compenso entro il centesimo", () => {
      for (const original of [100, 500, 1000, 2500, 9999.99, 1234.56]) {
        const { totale } = breakdownFromCompenso(original);
        const { compenso } = breakdownFromTotale(totale);
        // Tolleranza stretta: 1 centesimo max (rounding cumulativo ammesso)
        expect(Math.abs(compenso - original)).toBeLessThanOrEqual(0.01);
      }
    });

    it("ritorna zero per totale nullo o negativo", () => {
      expect(breakdownFromTotale(0)).toEqual({ compenso: 0, rivalsa: 0, totale: 0 });
      expect(breakdownFromTotale(-100)).toEqual({ compenso: 0, rivalsa: 0, totale: 0 });
      expect(breakdownFromTotale(null)).toEqual({ compenso: 0, rivalsa: 0, totale: 0 });
    });

    it("somma coerente: compenso + rivalsa = totale (entro tolleranza centesimo)", () => {
      for (const totale of [100, 500, 1040, 2730.52, 9999.99]) {
        const { compenso, rivalsa } = breakdownFromTotale(totale);
        expect(compenso + rivalsa).toBeCloseTo(totale, 2);
      }
    });
  });

  describe("isGestioneSeparata", () => {
    it("true per 'gestione_separata'", () => {
      expect(isGestioneSeparata("gestione_separata")).toBe(true);
    });

    it("true per variazioni case/separator", () => {
      expect(isGestioneSeparata("Gestione_Separata")).toBe(true);
      expect(isGestioneSeparata("GESTIONE_SEPARATA")).toBe(true);
      expect(isGestioneSeparata("gestione-separata")).toBe(true);
      expect(isGestioneSeparata("gestione separata")).toBe(true);
    });

    it("false per altri inps_type", () => {
      expect(isGestioneSeparata("artigiani")).toBe(false);
      expect(isGestioneSeparata("commercianti")).toBe(false);
      expect(isGestioneSeparata("artigiani_commercianti")).toBe(false);
      expect(isGestioneSeparata("")).toBe(false);
      expect(isGestioneSeparata(null)).toBe(false);
      expect(isGestioneSeparata(undefined)).toBe(false);
    });
  });
});
