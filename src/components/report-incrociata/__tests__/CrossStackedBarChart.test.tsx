/**
 * Story 55.4 — Test CrossStackedBarChart rendering.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { CrossStackedBarChart } from "../CrossStackedBarChart";
import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";

type RechartsNodeProps = { children?: ReactNode };
type BarChartProps = RechartsNodeProps & { data?: unknown[] };
type BarProps = { dataKey?: string };

// Mock Recharts (jsdom doesn't support SVG layout)
vi.mock("recharts", () => {
  return {
    ResponsiveContainer: ({ children }: RechartsNodeProps) => createElement("div", { "data-testid": "responsive-container" }, children),
    BarChart: ({ children, data }: BarChartProps) => createElement("div", { "data-testid": "bar-chart", "data-count": data?.length }, children),
    Bar: ({ dataKey }: BarProps) => createElement("div", { "data-testid": `bar-${dataKey}` }),
    XAxis: () => createElement("div", { "data-testid": "x-axis" }),
    YAxis: () => createElement("div", { "data-testid": "y-axis" }),
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

function buildTestData(clientCount = 2): CrossAnalysisData {
  const clients = Array.from({ length: clientCount }, (_, i) => ({
    id: `c${i}`,
    name: `Client ${i}`,
    totalGross: 1000 * (clientCount - i),
  }));

  const categories = [
    { id: "s1", name: "Consulenza", color: "#14b8a6", totalGross: 5000 },
  ];

  const matrix = new Map<string, Map<string, { totalGross: number; receiptCount: number }>>();
  for (const c of clients) {
    matrix.set(c.id!, new Map([["s1", { totalGross: c.totalGross, receiptCount: 1 }]]));
  }

  return {
    entries: [],
    clients,
    categories,
    matrix,
    totals: {
      byClient: new Map(clients.map((c) => [c.id!, c.totalGross])),
      byCategory: new Map([["s1", 5000]]),
      grand: 5000,
    },
  };
}

describe("CrossStackedBarChart", () => {
  it("renderizza il chart con dati", () => {
    render(<CrossStackedBarChart data={buildTestData()} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar-s1")).toBeInTheDocument();
  });

  it("mostra nota 'top 10' quando ci sono più di 10 clienti", () => {
    render(<CrossStackedBarChart data={buildTestData(12)} />);
    expect(screen.getByText(/primi 10 clienti/)).toBeInTheDocument();
    // Chart should have 10 data points
    expect(screen.getByTestId("bar-chart").getAttribute("data-count")).toBe("10");
  });

  it("non mostra nota 'top 10' con meno di 11 clienti", () => {
    render(<CrossStackedBarChart data={buildTestData(5)} />);
    expect(screen.queryByText(/primi 10 clienti/)).not.toBeInTheDocument();
  });

  it("non renderizza nulla con dati vuoti", () => {
    const emptyData: CrossAnalysisData = {
      entries: [],
      clients: [],
      categories: [],
      matrix: new Map(),
      totals: { byClient: new Map(), byCategory: new Map(), grand: 0 },
    };
    const { container } = render(<CrossStackedBarChart data={emptyData} />);
    expect(container.innerHTML).toBe("");
  });
});
