/**
 * Tests for PricingSurveyResults — Admin Van Westendorp survey dashboard.
 *
 * Verifies progress bar, stats table, respondent list, and CSV export.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PricingSurveyResults } from "./PricingSurveyResults";

// --- Mock data ---
const mockResponses = [
  {
    id: "r1",
    selected_reason: JSON.stringify({ too_cheap: 10, good_value: 50, expensive_ok: 100, too_expensive: 200 }),
    free_text: "Vorrei un piano mensile",
    created_at: "2026-03-01T10:00:00Z",
    user_id: "u1",
  },
  {
    id: "r2",
    selected_reason: JSON.stringify({ too_cheap: 20, good_value: 60, expensive_ok: 120, too_expensive: 250 }),
    free_text: null,
    created_at: "2026-03-02T14:00:00Z",
    user_id: "u2",
  },
];

const mockProfiles = [
  { user_id: "u1", user_code: "ABC123DEF" },
  { user_id: "u2", user_code: "XYZ789GHI" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC not found" } }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "survey_responses") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockResponses }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: mockProfiles }),
          }),
        };
      }
      return { select: vi.fn() };
    }),
  },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("PricingSurveyResults", () => {
  it("should render the card title after loading", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    expect(await screen.findByText("Survey Pricing (Van Westendorp)")).toBeDefined();
  });

  it("should show progress area after data loads", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    const risposteEls = await screen.findAllByText(/risposte/);
    expect(risposteEls.length).toBeGreaterThanOrEqual(1);
  });

  it("should show 'Mancano' text when below target", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    expect(await screen.findByText(/Mancano/)).toBeDefined();
  });

  it("should render stats table headers", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    expect(await screen.findByText("Metrica")).toBeDefined();
    expect(screen.getByText("Mediana")).toBeDefined();
  });

  it("should render respondent user codes", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    // User code appears in respondent table AND in comments — use getAllByText
    const abcElements = await screen.findAllByText("ABC123DEF");
    expect(abcElements.length).toBeGreaterThanOrEqual(1);
  });

  it("should render free text comments section", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    expect(await screen.findByText("Commenti completi")).toBeDefined();
    const textElements = screen.getAllByText("Vorrei un piano mensile");
    expect(textElements.length).toBeGreaterThanOrEqual(1);
  });

  it("should render CSV export button when data exists", async () => {
    render(<PricingSurveyResults />, { wrapper: createWrapper() });
    expect(await screen.findByRole("button", { name: /Esporta CSV/ })).toBeDefined();
  });
});
