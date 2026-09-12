import { describe, it, expect } from "vitest";
import { isCategoryEnabled, CATEGORY_DEFAULTS } from "./notification-preferences";

describe("isCategoryEnabled", () => {
  it("scadenze usa il valore userPrefs se presente", () => {
    expect(isCategoryEnabled({ scadenze: true }, "scadenze")).toBe(true);
    expect(isCategoryEnabled({ scadenze: false }, "scadenze")).toBe(false);
  });

  it("scadenze fallback al default (true) quando nessuna pref", () => {
    expect(isCategoryEnabled({}, "scadenze")).toBe(true);
  });

  it("insights usa il valore userPrefs se presente", () => {
    expect(isCategoryEnabled({ insights: false }, "insights")).toBe(false);
    expect(isCategoryEnabled({ insights: true }, "insights")).toBe(true);
  });

  it("aggiornamenti usa il valore userPrefs se presente", () => {
    expect(isCategoryEnabled({ aggiornamenti: true }, "aggiornamenti")).toBe(true);
    expect(isCategoryEnabled({ aggiornamenti: false }, "aggiornamenti")).toBe(false);
  });

  it("insights fallback al default (true) quando nessuna pref", () => {
    expect(isCategoryEnabled({}, "insights")).toBe(true);
  });

  it("aggiornamenti fallback al default (true) quando nessuna pref", () => {
    expect(isCategoryEnabled({}, "aggiornamenti")).toBe(true);
  });

  it("categoria sconosciuta fallback a false", () => {
    expect(isCategoryEnabled({}, "unknown")).toBe(false);
  });

  it("CATEGORY_DEFAULTS ha i valori corretti", () => {
    expect(CATEGORY_DEFAULTS).toEqual({
      scadenze: true,
      insights: true,
      aggiornamenti: true,
    });
  });
});
