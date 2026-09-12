/**
 * Story 55.4 — Test CrossAnalysisHeatmap rendering.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrossAnalysisHeatmap } from "../CrossAnalysisHeatmap";
import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";

function buildTestData(): CrossAnalysisData {
  const matrix = new Map<string, Map<string, { totalGross: number; receiptCount: number }>>();
  matrix.set("c1", new Map([
    ["s1", { totalGross: 5000, receiptCount: 3 }],
    ["s2", { totalGross: 2000, receiptCount: 1 }],
  ]));
  matrix.set("c2", new Map([
    ["s1", { totalGross: 3000, receiptCount: 2 }],
    // c2 x s2 = 0 (not present)
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

describe("CrossAnalysisHeatmap", () => {
  it("renderizza clienti e categorie", () => {
    render(<CrossAnalysisHeatmap data={buildTestData()} />);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Consulenza")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
  });

  it("mostra trattino per celle vuote", () => {
    render(<CrossAnalysisHeatmap data={buildTestData()} />);
    // Beta x Design = 0 → "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renderizza riga totali nel footer", () => {
    render(<CrossAnalysisHeatmap data={buildTestData()} />);
    // "Totale" label in thead and tfoot
    const totaleLabels = screen.getAllByText("Totale");
    expect(totaleLabels.length).toBeGreaterThanOrEqual(2); // header col + footer row
  });

  it("applica tooltip sulle celle con valore", () => {
    const { container } = render(<CrossAnalysisHeatmap data={buildTestData()} />);
    const cellsWithTitle = container.querySelectorAll("td[title]");
    expect(cellsWithTitle.length).toBeGreaterThanOrEqual(3); // 3 celle con valore
  });

  it("applica sfondo teal sulle celle con valore", () => {
    const { container } = render(<CrossAnalysisHeatmap data={buildTestData()} />);
    const cellsWithBg = container.querySelectorAll("td[style]");
    expect(cellsWithBg.length).toBeGreaterThanOrEqual(3);
    // Check intensity: max cell = 5000, so 5000/5000 = 1.0 → opacity 0.40
    const maxCell = cellsWithBg[0];
    expect(maxCell.getAttribute("style")).toContain("rgba(20, 184, 166,");
  });
});
