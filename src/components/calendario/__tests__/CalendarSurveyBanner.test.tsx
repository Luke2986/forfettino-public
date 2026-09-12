import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarSurveyBanner } from "../CalendarSurveyBanner";

// --- Hoisted mock state ---

const mocks = vi.hoisted(() => {
  let _selectData: unknown[] = [];
  let _insertError: unknown = null;

  const mockInsert = vi.fn(() => Promise.resolve({ error: _insertError }));
  const mockRpc = vi.fn(() => Promise.resolve({ data: true, error: null }));

  const mockUpdate = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  }));

  const mockFrom = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.insert = mockInsert;
    chain.update = mockUpdate;
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: _selectData, error: null }).then(resolve);
    return chain;
  });

  return {
    mockFrom,
    mockInsert,
    mockRpc,
    setSelectData: (d: unknown[]) => { _selectData = d; },
    setInsertError: (e: unknown) => { _insertError = e; },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.mockFrom,
    rpc: mocks.mockRpc,
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

function renderBanner() {
  return render(<CalendarSurveyBanner />, { wrapper: createWrapper() });
}

// --- Tests ---

describe("CalendarSurveyBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setSelectData([]); // no prior response
    mocks.setInsertError(null);
    localStorage.clear();
  });

  it("renders when user has not responded", async () => {
    renderBanner();
    await waitFor(() => {
      expect(
        screen.getByText("Usi un calendario digitale per la tua attività?")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Google Calendar")).toBeInTheDocument();
    expect(screen.getByText("Apple Calendar")).toBeInTheDocument();
    expect(screen.getByText("Outlook")).toBeInTheDocument();
    expect(screen.getByText("Altro")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("increments dismiss count in localStorage and hides", async () => {
    renderBanner();
    await waitFor(() => {
      expect(screen.getByLabelText("Chiudi survey")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Chiudi survey"));
    expect(localStorage.getItem("forfettino:calendar-survey-dismiss-count")).toBe("1");
    expect(
      screen.queryByText("Usi un calendario digitale per la tua attività?")
    ).not.toBeInTheDocument();
  });

  it("hides permanently after 3 dismissals", async () => {
    localStorage.setItem("forfettino:calendar-survey-dismiss-count", "3");
    renderBanner();
    await waitFor(() => {
      expect(
        screen.queryByText("Usi un calendario digitale per la tua attività?")
      ).not.toBeInTheDocument();
    });
  });

  it("hides when user already responded", async () => {
    mocks.setSelectData([{ id: "existing-response" }]);
    renderBanner();
    await waitFor(() => {
      expect(
        screen.queryByText("Usi un calendario digitale per la tua attività?")
      ).not.toBeInTheDocument();
    });
  });

  it("saves response on provider click with correct payload", async () => {
    renderBanner();
    await waitFor(() => {
      expect(screen.getByText("Google Calendar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Google Calendar"));

    await waitFor(() => {
      expect(mocks.mockInsert).toHaveBeenCalledWith({
        user_id: "user-123",
        survey_key: "calendar_usage_v1",
        selected_reason: JSON.stringify({ provider: "google_calendar" }),
        free_text: null,
      });
    });

    // Should try to award contribution points
    expect(mocks.mockRpc).toHaveBeenCalledWith("record_calendar_survey_contribution");
  });

  it("tracks dismiss analytics event", async () => {
    const { track } = await import("@/lib/analytics");
    renderBanner();
    await waitFor(() => {
      expect(screen.getByLabelText("Chiudi survey")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Chiudi survey"));
    expect(track).toHaveBeenCalledWith("calendar_survey_dismissed", { dismiss_count: 1 });
  });

  it("hides banner after successful submission", async () => {
    renderBanner();
    await waitFor(() => {
      expect(screen.getByText("Apple Calendar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Apple Calendar"));

    await waitFor(() => {
      expect(
        screen.queryByText("Usi un calendario digitale per la tua attività?")
      ).not.toBeInTheDocument();
    });
  });

  it("shows text input when 'Altro' is clicked, then submits with free_text", async () => {
    renderBanner();
    await waitFor(() => {
      expect(screen.getByText("Altro")).toBeInTheDocument();
    });

    // First click: shows the input, does NOT submit
    fireEvent.click(screen.getByText("Altro"));
    expect(mocks.mockInsert).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText("Quale calendario usi?");
    expect(input).toBeInTheDocument();

    // "Invia" button should be disabled while input is empty
    expect(screen.getByText("Invia")).toBeDisabled();

    // Type a value and submit
    fireEvent.change(input, { target: { value: "Fantastical" } });
    expect(screen.getByText("Invia")).not.toBeDisabled();

    fireEvent.click(screen.getByText("Invia"));

    await waitFor(() => {
      expect(mocks.mockInsert).toHaveBeenCalledWith({
        user_id: "user-123",
        survey_key: "calendar_usage_v1",
        selected_reason: JSON.stringify({ provider: "other" }),
        free_text: "Fantastical",
      });
    });
  });
});
