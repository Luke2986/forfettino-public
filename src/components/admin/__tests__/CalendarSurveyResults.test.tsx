import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarSurveyResults } from "../CalendarSurveyResults";

// --- Mocks ---

let mockQueryData: unknown[] = [];
let mockQueryError: unknown = null;

function createChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: mockQueryData, error: mockQueryError }).then(resolve);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => createChain()),
  },
}));

// --- Helpers ---

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function makeResponse(provider: string, id?: string) {
  return {
    id: id || `resp-${provider}`,
    selected_reason: JSON.stringify({ provider }),
  };
}

// --- Tests ---

describe("CalendarSurveyResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryData = [];
    mockQueryError = null;
  });

  it("shows empty state when no responses", async () => {
    render(<CalendarSurveyResults />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Nessuna risposta ricevuta ancora.")).toBeInTheDocument();
    });
  });

  it("renders breakdown with correct counts and percentages", async () => {
    mockQueryData = [
      makeResponse("google_calendar", "1"),
      makeResponse("google_calendar", "2"),
      makeResponse("apple_calendar", "3"),
      makeResponse("no", "4"),
    ];

    render(<CalendarSurveyResults />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("4 risposte totali")).toBeInTheDocument();
    });

    // 3 out of 4 use a calendar (75%)
    expect(screen.getByText(/75% usa un calendario/)).toBeInTheDocument();
    expect(screen.getByText(/3\/4/)).toBeInTheDocument();

    // Google: 2 (50%)
    expect(screen.getByText("Google Calendar")).toBeInTheDocument();
    expect(screen.getByText("2 (50%)")).toBeInTheDocument();

    // Apple and No both have 1 (25%) — use getAllByText
    expect(screen.getByText("Apple Calendar")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    const items25 = screen.getAllByText("1 (25%)");
    expect(items25.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 0 count for providers with no responses", async () => {
    mockQueryData = [
      makeResponse("google_calendar", "1"),
    ];

    render(<CalendarSurveyResults />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("1 risposta totale")).toBeInTheDocument();
    });

    // Outlook should show 0 — multiple providers have 0 (0%)
    expect(screen.getByText("Outlook")).toBeInTheDocument();
    const zeroItems = screen.getAllByText("0 (0%)");
    expect(zeroItems.length).toBeGreaterThanOrEqual(1);
  });

  it("uses singular form for 1 response", async () => {
    mockQueryData = [makeResponse("google_calendar", "1")];
    render(<CalendarSurveyResults />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("1 risposta totale")).toBeInTheDocument();
    });
  });

  it("renders the widget title with calendar icon", async () => {
    render(<CalendarSurveyResults />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Survey Calendario Digitale")).toBeInTheDocument();
    });
  });
});
