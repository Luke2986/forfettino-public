/**
 * Tests for demoData — Demo dashboard data constants.
 *
 * Story 38-1: Dashboard Demo Onboarding
 */
import { describe, it, expect } from "vitest";
import {
  getDemoData,
  DEMO_SEPARATA,
  DEMO_ARTIGIANI_COMMERCIANTI,
  DEMO_DISMISSED_KEY,
} from "./demoData";

describe("demoData", () => {
  describe("DEMO_DISMISSED_KEY", () => {
    it("should be 'forfettino_demo_dismissed'", () => {
      expect(DEMO_DISMISSED_KEY).toBe("forfettino_demo_dismissed");
    });
  });

  describe("DEMO_SEPARATA", () => {
    it("should have correct spendibile", () => {
      expect(DEMO_SEPARATA.spendibile).toBe(7678.21);
    });

    it("should have correct daCoprire", () => {
      expect(DEMO_SEPARATA.daCoprire).toBe(2321.79);
    });

    it("should have correct incassi", () => {
      expect(DEMO_SEPARATA.incassi).toBe(10000);
    });

    it("should have correct INPS", () => {
      expect(DEMO_SEPARATA.inps).toBe(2033.46);
    });

    it("should have correct imposta", () => {
      expect(DEMO_SEPARATA.imposta).toBe(288.33);
    });

    it("should have daCoprire = inps + imposta", () => {
      const sum = +(DEMO_SEPARATA.inps + DEMO_SEPARATA.imposta).toFixed(2);
      expect(sum).toBe(DEMO_SEPARATA.daCoprire);
    });

    it("should have spendibile + daCoprire = incassi", () => {
      const total = +(DEMO_SEPARATA.spendibile + DEMO_SEPARATA.daCoprire).toFixed(2);
      expect(total).toBe(DEMO_SEPARATA.incassi);
    });

    it("should include 'esempio' in disclaimer text", () => {
      expect(DEMO_SEPARATA.disclaimerText).toContain("esempio");
    });

    it("should NOT mention riduzione 35% in disclaimer", () => {
      expect(DEMO_SEPARATA.disclaimerText).not.toContain("riduzione 35%");
    });
  });

  describe("DEMO_ARTIGIANI_COMMERCIANTI", () => {
    it("should have correct spendibile", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.spendibile).toBe(6818.06);
    });

    it("should have correct daCoprire", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.daCoprire).toBe(3181.94);
    });

    it("should have correct incassi", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.incassi).toBe(10000);
    });

    it("should have correct INPS minimale ridotto", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.inps).toBe(2938.88);
    });

    it("should have correct imposta", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.imposta).toBe(243.06);
    });

    it("should have daCoprire = inps + imposta", () => {
      const sum = +(DEMO_ARTIGIANI_COMMERCIANTI.inps + DEMO_ARTIGIANI_COMMERCIANTI.imposta).toFixed(2);
      expect(sum).toBe(DEMO_ARTIGIANI_COMMERCIANTI.daCoprire);
    });

    it("should have spendibile + daCoprire = incassi", () => {
      const total = +(DEMO_ARTIGIANI_COMMERCIANTI.spendibile + DEMO_ARTIGIANI_COMMERCIANTI.daCoprire).toFixed(2);
      expect(total).toBe(DEMO_ARTIGIANI_COMMERCIANTI.incassi);
    });

    it("should include 'esempio' in disclaimer text", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.disclaimerText).toContain("esempio");
    });

    it("should mention 'riduzione 35%' in disclaimer text", () => {
      expect(DEMO_ARTIGIANI_COMMERCIANTI.disclaimerText).toContain("riduzione 35%");
    });
  });

  describe("getDemoData", () => {
    it("should return DEMO_SEPARATA for gestione 'separata'", () => {
      expect(getDemoData("separata")).toBe(DEMO_SEPARATA);
    });

    it("should return DEMO_ARTIGIANI_COMMERCIANTI for gestione 'artigiani'", () => {
      expect(getDemoData("artigiani")).toBe(DEMO_ARTIGIANI_COMMERCIANTI);
    });

    it("should return DEMO_ARTIGIANI_COMMERCIANTI for gestione 'commercianti'", () => {
      expect(getDemoData("commercianti")).toBe(DEMO_ARTIGIANI_COMMERCIANTI);
    });
  });
});
