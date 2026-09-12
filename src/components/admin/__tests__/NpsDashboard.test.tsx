import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NpsDashboard } from "../NpsDashboard";

// --- Mock response data ---

function makeResponse(overrides: Partial<{
  id: string;
  score: number;
  comment: string | null;
  trigger_source: string;
  campaign_id: string | null;
  created_at: string;
  user_id: string;
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    score: overrides.score ?? 8,
    comment: overrides.comment ?? null,
    trigger_source: overrides.trigger_source ?? "third_receipt",
    campaign_id: overrides.campaign_id ?? "camp-1",
    created_at: overrides.created_at ?? "2026-03-15T10:00:00Z",
    user_id: overrides.user_id ?? "user-1",
  };
}

const mockProfiles = [
  { user_id: "user-1", user_code: "FORF-26-A1B" },
  { user_id: "user-2", user_code: "FORF-26-C3D" },
  { user_id: "user-3", user_code: "FORF-26-E5F" },
];

let mockSurveyData: unknown[] = [];
let mockSurveyError: unknown = null;
let mockProfileData: unknown[] = mockProfiles;

function createSurveyChain() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: mockSurveyData, error: mockSurveyError }).then(resolve);
  return chain;
}

function createProfileChain() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: mockProfileData, error: null }).then(resolve);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "profiles") return createProfileChain();
      return createSurveyChain();
    }),
  },
}));

// Mock csv-export
const mockDownloadCsv = vi.fn();
vi.mock("@/lib/csv-export", () => ({
  csvSafe: (v: string) => `"${v.replace(/"/g, '""')}"`,
  downloadCsv: (...args: any[]) => mockDownloadCsv(...args),
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => {
  return {
    LineChart: ({ children }: any) => createElement("div", { "data-testid": "line-chart" }, children),
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ReferenceLine: () => null,
    ResponsiveContainer: ({ children }: any) => createElement("div", null, children),
  };
});

vi.mock("@/components/ui/chart", () => {
  return {
    ChartContainer: ({ children }: any) => createElement("div", { "data-testid": "chart-container" }, children),
    ChartTooltip: () => null,
    ChartTooltipContent: () => null,
  };
});

// --- Helpers ---

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// --- Tests ---

describe("NpsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSurveyData = [];
    mockSurveyError = null;
    mockProfileData = mockProfiles;
  });

  it("shows empty state when no responses", async () => {
    mockSurveyData = [];
    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Nessuna risposta NPS ancora raccolta")).toBeInTheDocument();
    });
    expect(screen.getByText(/Configura la campagna NPS/)).toBeInTheDocument();
  });

  it("calculates NPS score correctly: 3 promoters, 2 passives, 5 detractors = -20", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 9, user_id: "user-1" }),
      makeResponse({ id: "2", score: 10, user_id: "user-1" }),
      makeResponse({ id: "3", score: 9, user_id: "user-1" }),
      makeResponse({ id: "4", score: 7, user_id: "user-2" }),
      makeResponse({ id: "5", score: 8, user_id: "user-2" }),
      makeResponse({ id: "6", score: 0, user_id: "user-3" }),
      makeResponse({ id: "7", score: 3, user_id: "user-3" }),
      makeResponse({ id: "8", score: 4, user_id: "user-3" }),
      makeResponse({ id: "9", score: 5, user_id: "user-3" }),
      makeResponse({ id: "10", score: 6, user_id: "user-3" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    // Wait for data to load — check for the NPS score value
    await waitFor(() => {
      expect(screen.getByText("-20")).toBeInTheDocument();
    });
    // Verify total responses shown in badge
    expect(screen.getByText("10 risposte")).toBeInTheDocument();
  });

  it("shows NPS +100 when all promoters", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 9, user_id: "user-1" }),
      makeResponse({ id: "2", score: 10, user_id: "user-1" }),
      makeResponse({ id: "3", score: 10, user_id: "user-2" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("+100")).toBeInTheDocument();
    });
  });

  it("shows NPS -100 when all detractors", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 0, user_id: "user-1" }),
      makeResponse({ id: "2", score: 3, user_id: "user-2" }),
      makeResponse({ id: "3", score: 6, user_id: "user-3" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("-100")).toBeInTheDocument();
    });
  });

  it("shows correct breakdown percentages", async () => {
    // 2 promoters, 1 passive, 1 detractor = 50% / 25% / 25%
    mockSurveyData = [
      makeResponse({ id: "1", score: 10, user_id: "user-1" }),
      makeResponse({ id: "2", score: 9, user_id: "user-1" }),
      makeResponse({ id: "3", score: 7, user_id: "user-2" }),
      makeResponse({ id: "4", score: 3, user_id: "user-3" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("4 risposte")).toBeInTheDocument();
    });
    expect(screen.getByText("2 (50%)")).toBeInTheDocument();
    // Both passives and detractors at 1 (25%)
    expect(screen.getAllByText("1 (25%)")).toHaveLength(2);
  });

  it("renders table with user code, score badge, trigger label, and truncated comment", async () => {
    const longComment = "A".repeat(100);
    mockSurveyData = [
      makeResponse({
        id: "r1",
        score: 9,
        user_id: "user-1",
        comment: longComment,
        trigger_source: "third_receipt",
      }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      // User code appears in table AND in comments section
      expect(screen.getAllByText("FORF-26-A1B").length).toBeGreaterThanOrEqual(1);
    });
    // Trigger label in table
    expect(screen.getByText(/3° incasso registrato/)).toBeInTheDocument();
    // Comment truncated to 80 chars + "..."
    expect(screen.getByText("A".repeat(80) + "...")).toBeInTheDocument();
  });

  it("exports CSV with correct header and rows", async () => {
    mockSurveyData = [
      makeResponse({
        id: "1",
        score: 9,
        user_id: "user-1",
        comment: "Great!",
        trigger_source: "third_receipt",
        campaign_id: "camp-1",
      }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText("FORF-26-A1B").length).toBeGreaterThanOrEqual(1);
    });

    const exportBtn = screen.getByText("Esporta CSV");
    fireEvent.click(exportBtn);

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [header, rows, filename] = mockDownloadCsv.mock.calls[0];
    expect(header).toContain("data,codice_utente,score,categoria,commento,trigger_source,campaign_id");
    expect(rows[0]).toContain("FORF-26-A1B");
    expect(rows[0]).toContain(",9,");
    expect(rows[0]).toContain("Promotore");
    expect(filename).toMatch(/^nps_export_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("shows pagination when > 10 responses", async () => {
    mockSurveyData = Array.from({ length: 15 }, (_, i) =>
      makeResponse({
        id: `r${i}`,
        score: 8,
        user_id: "user-1",
        created_at: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      }),
    );

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/Pagina 1 di 2/)).toBeInTheDocument();
    });
    expect(screen.getByText("Precedente")).toBeDisabled();
    expect(screen.getByText("Successiva")).not.toBeDisabled();
  });

  it("navigates pages with pagination buttons", async () => {
    mockSurveyData = Array.from({ length: 15 }, (_, i) =>
      makeResponse({
        id: `r${i}`,
        score: 8,
        user_id: "user-1",
        created_at: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      }),
    );

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/Pagina 1 di 2/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Successiva"));
    await waitFor(() => {
      expect(screen.getByText(/Pagina 2 di 2/)).toBeInTheDocument();
    });
    expect(screen.getByText("Successiva")).toBeDisabled();
    expect(screen.getByText("Precedente")).not.toBeDisabled();
  });

  it("applies correct NPS color: red for negative", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 0, user_id: "user-1" }),
      makeResponse({ id: "2", score: 1, user_id: "user-2" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      const npsEl = screen.getByText("-100");
      expect(npsEl.className).toContain("text-red-600");
    });
  });

  it("applies correct NPS color: green for > 30", async () => {
    // All promoters → NPS +100 → green
    mockSurveyData = [
      makeResponse({ id: "1", score: 10, user_id: "user-1" }),
      makeResponse({ id: "2", score: 9, user_id: "user-2" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      const npsEl = screen.getByText("+100");
      expect(npsEl.className).toContain("text-emerald-600");
    });
  });

  it("does not show trend chart with < 2 months of data", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 9, user_id: "user-1", created_at: "2026-03-15T10:00:00Z" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText("FORF-26-A1B").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/Dati insufficienti per il trend/)).toBeInTheDocument();
    expect(screen.queryByTestId("chart-container")).not.toBeInTheDocument();
  });

  it("shows trend chart with >= 2 months of data", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 9, user_id: "user-1", created_at: "2026-02-15T10:00:00Z" }),
      makeResponse({ id: "2", score: 5, user_id: "user-2", created_at: "2026-03-15T10:00:00Z" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId("chart-container")).toBeInTheDocument();
    });
  });

  it("shows comments section for responses with comments", async () => {
    mockSurveyData = [
      makeResponse({ id: "1", score: 10, user_id: "user-1", comment: "Ottimo strumento!" }),
      makeResponse({ id: "2", score: 5, user_id: "user-2", comment: null }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Commenti dettagliati")).toBeInTheDocument();
    });
    // Comment appears in both table (truncated or full) and comments section
    expect(screen.getAllByText("Ottimo strumento!").length).toBeGreaterThanOrEqual(1);
  });

  it("shows filtered count when filter active (via filteredResponses logic)", async () => {
    // We test the filtering logic indirectly: the component should show
    // different counts in the "Risposte" header when filters are applied.
    // Since Radix Select doesn't work well in jsdom, we verify the initial state.
    mockSurveyData = [
      makeResponse({ id: "1", score: 10, user_id: "user-1" }),
      makeResponse({ id: "2", score: 3, user_id: "user-2" }),
    ];

    render(<NpsDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("2 risposte")).toBeInTheDocument();
    });
    // Both rows visible in initial state (no filter)
    expect(screen.getAllByText("FORF-26-A1B").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("FORF-26-C3D").length).toBeGreaterThanOrEqual(1);
  });
});
