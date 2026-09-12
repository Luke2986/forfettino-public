/**
 * Story 55.4 — Test funzioni pure cross-analytics insight.
 */
import { describe, it, expect } from "vitest";
import {
  getTopServiceInsight,
  getCrossSellInsight,
  getMostDiversifiedInsight,
} from "./cross-analytics";
import type { CrossClient, CrossCategory, CrossCellData } from "@/hooks/useCrossAnalysis";

// Helper to build a matrix from entries
function buildMatrix(
  entries: { ck: string; catk: string; gross: number; count: number }[],
): Map<string, Map<string, CrossCellData>> {
  const m = new Map<string, Map<string, CrossCellData>>();
  for (const e of entries) {
    if (!m.has(e.ck)) m.set(e.ck, new Map());
    m.get(e.ck)!.set(e.catk, { totalGross: e.gross, receiptCount: e.count });
  }
  return m;
}

describe("getTopServiceInsight", () => {
  it("restituisce il servizio con fatturato più alto e percentuale corretta", () => {
    const cats: CrossCategory[] = [
      { id: "s1", name: "Consulenza", color: "#14b8a6", totalGross: 8000 },
      { id: "s2", name: "Design", color: "#8b5cf6", totalGross: 2000 },
    ];
    const result = getTopServiceInsight(cats, 10000);
    expect(result).not.toBeNull();
    expect(result!.icon).toBe("TrendingUp");
    expect(result!.text).toContain("Consulenza");
    expect(result!.text).toContain("80%");
  });

  it("restituisce null con categorie vuote", () => {
    expect(getTopServiceInsight([], 0)).toBeNull();
  });

  it("restituisce null con grandTotal zero", () => {
    const cats: CrossCategory[] = [
      { id: "s1", name: "A", color: "#000", totalGross: 0 },
    ];
    expect(getTopServiceInsight(cats, 0)).toBeNull();
  });
});

describe("getCrossSellInsight", () => {
  it("trova opportunità cross-sell per cliente mono-servizio", () => {
    const clients: CrossClient[] = [
      { id: "c1", name: "Acme", totalGross: 5000 },
      { id: "c2", name: "Beta", totalGross: 3000 },
    ];
    const cats: CrossCategory[] = [
      { id: "s1", name: "Consulenza", color: "#14b8a6", totalGross: 8000 },
      { id: "s2", name: "Design", color: "#8b5cf6", totalGross: 2000 },
    ];
    // Acme buys both, Beta buys only s1 with 3 receipts
    const matrix = buildMatrix([
      { ck: "c1", catk: "s1", gross: 5000, count: 3 },
      { ck: "c1", catk: "s2", gross: 2000, count: 1 },
      { ck: "c2", catk: "s1", gross: 3000, count: 3 },
    ]);

    const result = getCrossSellInsight(clients, cats, matrix, 10000);
    expect(result).not.toBeNull();
    expect(result!.icon).toBe("Lightbulb");
    expect(result!.text).toContain("Beta");
    expect(result!.text).toContain("Design");
  });

  it("non suggerisce se il cliente mono-servizio ha meno di 2 incassi", () => {
    const clients: CrossClient[] = [
      { id: "c1", name: "Solo", totalGross: 500 },
    ];
    const cats: CrossCategory[] = [
      { id: "s1", name: "A", color: "#000", totalGross: 500 },
      { id: "s2", name: "B", color: "#111", totalGross: 500 },
    ];
    const matrix = buildMatrix([
      { ck: "c1", catk: "s1", gross: 500, count: 1 },
    ]);
    expect(getCrossSellInsight(clients, cats, matrix, 1000)).toBeNull();
  });

  it("non suggerisce se il servizio alternativo è sotto il 10%", () => {
    const clients: CrossClient[] = [
      { id: "c1", name: "Mono", totalGross: 9500 },
    ];
    const cats: CrossCategory[] = [
      { id: "s1", name: "Big", color: "#000", totalGross: 9500 },
      { id: "s2", name: "Tiny", color: "#111", totalGross: 500 },
    ];
    const matrix = buildMatrix([
      { ck: "c1", catk: "s1", gross: 9500, count: 5 },
    ]);
    // s2 = 500/10000 = 5% < 10%
    expect(getCrossSellInsight(clients, cats, matrix, 10000)).toBeNull();
  });

  it("restituisce null con meno di 2 categorie", () => {
    const clients: CrossClient[] = [{ id: "c1", name: "A", totalGross: 100 }];
    const cats: CrossCategory[] = [{ id: "s1", name: "X", color: "#000", totalGross: 100 }];
    expect(getCrossSellInsight(clients, cats, new Map(), 100)).toBeNull();
  });
});

describe("getMostDiversifiedInsight", () => {
  it("trova il cliente più diversificato", () => {
    const clients: CrossClient[] = [
      { id: "c1", name: "Multi", totalGross: 5000 },
      { id: "c2", name: "Mono", totalGross: 3000 },
    ];
    const matrix = buildMatrix([
      { ck: "c1", catk: "s1", gross: 3000, count: 2 },
      { ck: "c1", catk: "s2", gross: 1000, count: 1 },
      { ck: "c1", catk: "s3", gross: 1000, count: 1 },
      { ck: "c2", catk: "s1", gross: 3000, count: 3 },
    ]);

    const result = getMostDiversifiedInsight(clients, matrix);
    expect(result).not.toBeNull();
    expect(result!.icon).toBe("Users");
    expect(result!.text).toContain("Multi");
    expect(result!.text).toContain("3 servizi");
  });

  it("restituisce null se tutti i clienti sono mono-servizio", () => {
    const clients: CrossClient[] = [
      { id: "c1", name: "A", totalGross: 100 },
    ];
    const matrix = buildMatrix([
      { ck: "c1", catk: "s1", gross: 100, count: 1 },
    ]);
    expect(getMostDiversifiedInsight(clients, matrix)).toBeNull();
  });

  it("restituisce null con clienti vuoti", () => {
    expect(getMostDiversifiedInsight([], new Map())).toBeNull();
  });

  it("gestisce clienti con null id", () => {
    const clients: CrossClient[] = [
      { id: null, name: "Senza cliente", totalGross: 2000 },
    ];
    const matrix = buildMatrix([
      { ck: "__null__", catk: "s1", gross: 1000, count: 1 },
      { ck: "__null__", catk: "s2", gross: 1000, count: 1 },
    ]);

    const result = getMostDiversifiedInsight(clients, matrix);
    expect(result).not.toBeNull();
    expect(result!.text).toContain("Senza cliente");
    expect(result!.text).toContain("2 servizi");
  });
});
