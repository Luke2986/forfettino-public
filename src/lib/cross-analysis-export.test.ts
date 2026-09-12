/**
 * Story 55.4 — Test export CSV analisi incrociata.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";

// Mock csv-export
const mockDownload = vi.fn();
vi.mock("@/lib/csv-export", () => ({
  csvSafe: (v: string) => `"${v}"`,
  downloadCsvItalian: (...args: any[]) => mockDownload(...args),
  formatNumberIT: (n: number) => n.toFixed(2).replace(".", ","),
}));

import { exportCrossAnalysis } from "./cross-analysis-export";

function buildTestData(): CrossAnalysisData {
  const matrix = new Map<string, Map<string, { totalGross: number; receiptCount: number }>>();
  matrix.set("c1", new Map([
    ["s1", { totalGross: 5000, receiptCount: 3 }],
    ["s2", { totalGross: 2000, receiptCount: 1 }],
  ]));
  matrix.set("c2", new Map([
    ["s1", { totalGross: 3000, receiptCount: 2 }],
  ]));

  return {
    entries: [],
    clients: [
      { id: "c1", name: "Acme", totalGross: 7000 },
      { id: "c2", name: "Beta", totalGross: 3000 },
    ],
    categories: [
      { id: "s1", name: "Consulenza", color: "#14b8a6", totalGross: 8000 },
      { id: "s2", name: "Design", color: "#8b5cf6", totalGross: 2000 },
    ],
    matrix,
    totals: {
      byClient: new Map([["c1", 7000], ["c2", 3000]]),
      byCategory: new Map([["s1", 8000], ["s2", 2000]]),
      grand: 10000,
    },
  };
}

describe("exportCrossAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("genera CSV con header matrice e filename con anno", () => {
    exportCrossAnalysis(buildTestData(), 2026);

    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [header, rows, filename] = mockDownload.mock.calls[0];

    // Header
    expect(header).toBe('Cliente;"Consulenza";"Design";Totale');

    // Rows: 2 clients + 1 totale
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('"Acme"');
    expect(rows[0]).toContain("5000,00");
    expect(rows[0]).toContain("7000,00");
    expect(rows[2]).toContain("Totale");
    expect(rows[2]).toContain("10000,00");

    // Filename
    expect(filename).toBe("analisi-incrociata-2026.csv");
  });

  it("usa 'totale' nel filename quando period è null", () => {
    exportCrossAnalysis(buildTestData(), null);
    const filename = mockDownload.mock.calls[0][2];
    expect(filename).toBe("analisi-incrociata-totale.csv");
  });

  it("non chiama download con dati vuoti", () => {
    const empty: CrossAnalysisData = {
      entries: [],
      clients: [],
      categories: [],
      matrix: new Map(),
      totals: { byClient: new Map(), byCategory: new Map(), grand: 0 },
    };
    exportCrossAnalysis(empty, 2026);
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
