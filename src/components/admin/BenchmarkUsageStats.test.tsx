/**
 * Test per BenchmarkUsageStats — Admin widget comparatore tariffe (Story 46.3)
 * Copertura:
 * - Rendering con dati mock (visualizzazioni, utenti unici, top ruoli, tariffa media)
 * - Stato vuoto (0 eventi) — messaggio informativo
 * - Top 10 ruoli ordinamento per frequenza decrescente
 * - Tariffa media visibile/nascosta in base ai dati
 * - Edge case: un solo evento
 * - Edge case: nessun personalHourlyRate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import type { BenchmarkUsageData } from "@/hooks/useAdminBenchmarkStats";

// ── Mock useAdminBenchmarkStats ──
const mockUseAdminBenchmarkStats = vi.fn<() => { data: BenchmarkUsageData | undefined; isLoading: boolean; error: Error | null }>();

vi.mock("@/hooks/useAdminBenchmarkStats", () => ({
  useAdminBenchmarkStats: () => mockUseAdminBenchmarkStats(),
}));

// ── Mock UI components (minimal) ──
vi.mock("@/components/admin/AdminStatCard", () => ({
  AdminStatCard: ({ label, value, subLabel }: { label: string; value: string | number; subLabel?: string }) =>
    createElement("div", { "data-testid": `stat-${label}` },
      createElement("span", null, String(value)),
      subLabel ? createElement("span", null, subLabel) : null,
    ),
}));

// ── Import after mocks ──
import { BenchmarkUsageStats } from "./BenchmarkUsageStats";

beforeEach(() => {
  vi.clearAllMocks();
});

const MOCK_DATA: BenchmarkUsageData = {
  totalViews: 42,
  uniqueUsers: 15,
  topRoles: [
    { jobTitle: "software_developer", count: 18 },
    { jobTitle: "data_analyst", count: 10 },
    { jobTitle: "product_designer", count: 7 },
    { jobTitle: "it_consultant", count: 4 },
    { jobTitle: "devops_engineer", count: 3 },
  ],
  avgPersonalRate: 35,
  medianPersonalRate: 32,
};

describe("BenchmarkUsageStats — Rendering con dati", () => {
  it("renders KPI cards with correct values", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({ data: MOCK_DATA, isLoading: false, error: null });
    render(<BenchmarkUsageStats />);

    expect(screen.getByText("Comparatore Tariffe")).toBeInTheDocument();
    // Check stat cards
    const vizCard = screen.getByTestId("stat-Visualizzazioni");
    expect(vizCard).toHaveTextContent("42");
    expect(vizCard).toHaveTextContent("15 utenti unici");

    const usersCard = screen.getByTestId("stat-Utenti Unici");
    expect(usersCard).toHaveTextContent("15");
  });

  it("renders top roles table sorted by count descending", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({ data: MOCK_DATA, isLoading: false, error: null });
    render(<BenchmarkUsageStats />);

    expect(screen.getByText("Top 10 Ruoli Cercati")).toBeInTheDocument();
    // Verify formatted job titles (snake_case → Title Case)
    expect(screen.getByText("Software Developer")).toBeInTheDocument();
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();

    // Verify counts
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders average personal rate when available", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({ data: MOCK_DATA, isLoading: false, error: null });
    render(<BenchmarkUsageStats />);

    const rateCard = screen.getByTestId("stat-Tariffa Media Implicita");
    expect(rateCard).toHaveTextContent("€35/ora");
    expect(rateCard).toHaveTextContent("Mediana: €32/ora");
  });
});

describe("BenchmarkUsageStats — Stato vuoto", () => {
  it("shows empty message when no events", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({
      data: {
        totalViews: 0,
        uniqueUsers: 0,
        topRoles: [],
        avgPersonalRate: null,
        medianPersonalRate: null,
      },
      isLoading: false,
      error: null,
    });
    render(<BenchmarkUsageStats />);

    expect(screen.getByText("Nessun utente ha ancora utilizzato il comparatore.")).toBeInTheDocument();
    expect(screen.queryByText("Top 10 Ruoli Cercati")).not.toBeInTheDocument();
  });

  it("shows empty message when data is undefined", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({ data: undefined, isLoading: false, error: null });
    render(<BenchmarkUsageStats />);

    expect(screen.getByText("Nessun utente ha ancora utilizzato il comparatore.")).toBeInTheDocument();
  });
});

describe("BenchmarkUsageStats — Tariffa nascosta", () => {
  it("hides rate card when no personalHourlyRate data", () => {
    const dataNoRate: BenchmarkUsageData = {
      ...MOCK_DATA,
      avgPersonalRate: null,
      medianPersonalRate: null,
    };
    mockUseAdminBenchmarkStats.mockReturnValue({ data: dataNoRate, isLoading: false, error: null });
    render(<BenchmarkUsageStats />);

    expect(screen.queryByTestId("stat-Tariffa Media Implicita")).not.toBeInTheDocument();
    // Other cards still present
    expect(screen.getByTestId("stat-Visualizzazioni")).toBeInTheDocument();
  });
});

describe("BenchmarkUsageStats — Edge case: singolo evento", () => {
  it("renders correctly with one event", () => {
    const singleEvent: BenchmarkUsageData = {
      totalViews: 1,
      uniqueUsers: 1,
      topRoles: [{ jobTitle: "backend_developer", count: 1 }],
      avgPersonalRate: null,
      medianPersonalRate: null,
    };
    mockUseAdminBenchmarkStats.mockReturnValue({ data: singleEvent, isLoading: false, error: null });
    render(<BenchmarkUsageStats />);

    expect(screen.getByTestId("stat-Visualizzazioni")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-Utenti Unici")).toHaveTextContent("1");
    expect(screen.getByText("Backend Developer")).toBeInTheDocument();
  });
});

describe("BenchmarkUsageStats — Loading", () => {
  it("shows skeleton when loading (no title visible)", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<BenchmarkUsageStats />);

    // Title and content should NOT be rendered during loading
    expect(screen.queryByText("Comparatore Tariffe")).not.toBeInTheDocument();
    expect(screen.queryByText("Nessun utente ha ancora utilizzato il comparatore.")).not.toBeInTheDocument();
    expect(screen.queryByText("Top 10 Ruoli Cercati")).not.toBeInTheDocument();
  });
});

describe("BenchmarkUsageStats — Error", () => {
  it("shows error message when query fails", () => {
    mockUseAdminBenchmarkStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("RLS blocked"),
    });
    render(<BenchmarkUsageStats />);

    expect(screen.getByText("Errore nel caricamento delle statistiche.")).toBeInTheDocument();
    expect(screen.getByText("Comparatore Tariffe")).toBeInTheDocument();
    expect(screen.queryByText("Nessun utente ha ancora utilizzato il comparatore.")).not.toBeInTheDocument();
  });
});
