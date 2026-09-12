import { describe, it, expect } from "vitest";
import {
  classifyDelta,
  greenBandCents,
  shouldAskReason,
  DEFAULT_TOLERANCE,
} from "@/lib/tolerance";

describe("greenBandCents", () => {
  it("usa la percentuale quando supera il floor (importi grandi)", () => {
    // 10.000 EUR → 2% = 200 EUR = 20000 cent > floor 2500
    expect(greenBandCents(1_000_000)).toBe(20_000);
  });

  it("usa il floor quando la percentuale e' sotto (importi piccoli)", () => {
    // 400 EUR → 2% = 8 EUR = 800 cent < floor 2500 → floor vince
    expect(greenBandCents(40_000)).toBe(2_500);
  });
});

describe("classifyDelta — gli esempi dell'utente", () => {
  it("1.000 EUR di delta su 10.000 EUR e' verde (1%)", () => {
    const r = classifyDelta(1_000_000, 1_010_000);
    expect(r.band).toBe("green");
    expect(r.deltaCents).toBe(10_000);
    expect(r.deltaPct).toBeCloseTo(0.01, 5);
  });

  it("100 EUR di delta su 10.000 EUR e' verde (1%)", () => {
    expect(classifyDelta(1_000_000, 1_010_000 - 0).band).toBe("green");
    expect(classifyDelta(1_000_000, 1_010_000).band).toBe("green");
    expect(classifyDelta(1_000_000, 1_000_000 + 10_000).band).toBe("green");
  });

  it("100 EUR di delta su 400 EUR e' rosso (25%)", () => {
    // floor 25 EUR; 100 EUR delta >> floor e > 10%
    const r = classifyDelta(40_000, 50_000);
    expect(r.band).toBe("red");
    expect(r.deltaCents).toBe(10_000);
    expect(r.deltaPct).toBeCloseTo(0.25, 5);
  });
});

describe("classifyDelta — confini banda", () => {
  it("delta esattamente sul confine verde e' verde", () => {
    // est 10.000 EUR → green band 200 EUR
    expect(classifyDelta(1_000_000, 1_000_000 + 20_000).band).toBe("green");
  });

  it("1 cent oltre il verde scende a giallo", () => {
    expect(classifyDelta(1_000_000, 1_000_000 + 20_001).band).toBe("yellow");
  });

  it("delta sul confine 10% e' giallo, oltre e' rosso", () => {
    // est 10.000 EUR → yellow band 1.000 EUR
    expect(classifyDelta(1_000_000, 1_000_000 + 100_000).band).toBe("yellow");
    expect(classifyDelta(1_000_000, 1_000_000 + 100_001).band).toBe("red");
  });

  it("e' simmetrico: pagato meno della stima usa il valore assoluto", () => {
    expect(classifyDelta(1_000_000, 1_000_000 - 20_000).band).toBe("green");
    expect(classifyDelta(1_000_000, 1_000_000 - 20_001).band).toBe("yellow");
    expect(classifyDelta(40_000, 30_000).band).toBe("red");
  });

  it("rate piccole hanno una finestra gialla (yellowFloorCents)", () => {
    // est 150 EUR: green floor 25 EUR, yellow floor 50 EUR
    // delta 30 EUR sta tra i due → giallo (prima sarebbe stato rosso)
    expect(classifyDelta(15_000, 15_000 + 3_000).band).toBe("yellow");
    // delta 20 EUR (sotto 25) → verde
    expect(classifyDelta(15_000, 15_000 + 2_000).band).toBe("green");
    // delta 60 EUR (oltre 50) → rosso
    expect(classifyDelta(15_000, 15_000 + 6_000).band).toBe("red");
  });
});

describe("classifyDelta — edge cases", () => {
  it("delta zero e' verde", () => {
    const r = classifyDelta(50_000, 50_000);
    expect(r.band).toBe("green");
    expect(r.deltaCents).toBe(0);
    expect(r.deltaPct).toBe(0);
  });

  it("stima zero non divide per zero, deltaPct = 0", () => {
    const r = classifyDelta(0, 10_000);
    expect(r.deltaPct).toBe(0);
    // 100 EUR su stima 0: oltre floor → rosso
    expect(r.band).toBe("red");
  });

  it("arrotonda ogni operando: il delta e' sempre intero", () => {
    const r = classifyDelta(50_000.4, 50_000.6);
    expect(Number.isInteger(r.deltaCents)).toBe(true);
    expect(r.deltaCents).toBe(1); // round(50000.6) - round(50000.4)
    // operandi gia' uguali → delta 0
    expect(classifyDelta(50_000.6, 50_000.6).deltaCents).toBe(0);
  });

  it("delta firmato: positivo se pagato di piu', negativo se di meno", () => {
    expect(classifyDelta(50_000, 60_000).deltaCents).toBe(10_000);
    expect(classifyDelta(60_000, 50_000).deltaCents).toBe(-10_000);
  });
});

describe("shouldAskReason", () => {
  it("non chiede motivo se verde", () => {
    expect(shouldAskReason("green")).toBe(false);
  });
  it("chiede motivo se giallo o rosso", () => {
    expect(shouldAskReason("yellow")).toBe(true);
    expect(shouldAskReason("red")).toBe(true);
  });
});

describe("DEFAULT_TOLERANCE", () => {
  it("espone le soglie tarabili", () => {
    expect(DEFAULT_TOLERANCE.relPct).toBe(0.02);
    expect(DEFAULT_TOLERANCE.floorCents).toBe(2500);
    expect(DEFAULT_TOLERANCE.yellowPct).toBe(0.1);
    expect(DEFAULT_TOLERANCE.yellowFloorCents).toBe(5000);
  });
});
