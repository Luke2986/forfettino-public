/**
 * Tests for PricingSurveyNudge — Van Westendorp pricing survey nudge banner.
 *
 * Verifies visibility conditions, dismiss behavior, and dialog opening.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PricingSurveyNudge } from "./PricingSurveyNudge";

// --- Mocks ---
const mockUser = { id: "user-123" };
const mockProfile = {
  id: "p1",
  user_id: "user-123",
  first_name: "Luca",
  last_name: null,
  onboarding_completed: true,
  user_code: "ABC123DEF",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
const mockIncomeStats = {
  count_total: 5,
  count_year: 3,
  last_income_at: "2026-02-15",
  first_income_at: "2026-01-10",
  total_year_amount: 10000,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let profileData = mockProfile as typeof mockProfile | null;
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: profileData }),
}));

let incomeData = mockIncomeStats as typeof mockIncomeStats | null;
vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({ data: incomeData }),
}));

let surveyResponseData: any[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ data: surveyResponseData }),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

let npsActiveCampaign: any = null;
let npsLoading = false;
vi.mock("@/hooks/useNpsEligibility", () => ({
  useNpsEligibility: () => ({
    activeCampaign: npsActiveCampaign,
    hasRespondedCurrentCampaign: false,
    enabledTriggers: [],
    isLoading: npsLoading,
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: {},
}));

vi.mock("./PricingSurveyDialog", () => ({
  PricingSurveyDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pricing-dialog">Dialog Open</div> : null,
}));

// Mock Date.now without fake timers (fake timers block React Query)
let mockNow = new Date("2026-03-05T12:00:00").getTime();
const realDateNow = Date.now;

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("PricingSurveyNudge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileData = mockProfile;
    incomeData = mockIncomeStats;
    surveyResponseData = [];
    npsActiveCampaign = null;
    npsLoading = false;
    localStorage.clear();
    mockNow = new Date("2026-03-05T12:00:00").getTime();
    Date.now = () => mockNow;
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  it("should render the nudge banner when all conditions are met", async () => {
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Forfettino resterà gratuito. Sto costruendo il Pro.")).toBeDefined();
    });
  });

  it("should render 'Rispondi' and 'Non ora' buttons", async () => {
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Rispondi" })).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "Non ora" })).toBeDefined();
  });

  it("should hide when user has fewer than 3 incassi", async () => {
    incomeData = { ...mockIncomeStats, count_total: 2 };
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    // Even after query resolves, should still be hidden
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Sto decidendo il futuro di Forfettino.")).toBeNull();
  });

  it("should hide when profile is less than 14 days old", async () => {
    profileData = { ...mockProfile, created_at: "2026-02-25" };
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Sto decidendo il futuro di Forfettino.")).toBeNull();
  });

  it("should hide when dismiss count >= 3", async () => {
    localStorage.setItem("forfettino:pricing-nudge-dismiss-count", "3");
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Sto decidendo il futuro di Forfettino.")).toBeNull();
  });

  it("should hide when last dismiss was less than 7 days ago", async () => {
    localStorage.setItem("forfettino:pricing-nudge-dismiss-count", "1");
    const threeDaysAgo = mockNow - 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem("forfettino:pricing-nudge-dismiss-at", String(threeDaysAgo));
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Sto decidendo il futuro di Forfettino.")).toBeNull();
  });

  it("should show banner after 7-day cooldown from dismiss", async () => {
    localStorage.setItem("forfettino:pricing-nudge-dismiss-count", "1");
    const eightDaysAgo = mockNow - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem("forfettino:pricing-nudge-dismiss-at", String(eightDaysAgo));
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Forfettino resterà gratuito. Sto costruendo il Pro.")).toBeDefined();
    });
  });

  it("should dismiss and increment counter on 'Non ora' click", async () => {
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Non ora" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Non ora" }));
    expect(localStorage.getItem("forfettino:pricing-nudge-dismiss-count")).toBe("1");
    expect(localStorage.getItem("forfettino:pricing-nudge-dismiss-at")).toBeTruthy();
    expect(screen.queryByText("Sto decidendo il futuro di Forfettino.")).toBeNull();
  });

  it("should open dialog when 'Rispondi' is clicked", async () => {
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Rispondi" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Rispondi" }));
    expect(screen.getByTestId("pricing-dialog")).toBeDefined();
  });

  it("should have aria-label on the banner region", async () => {
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Survey sul prezzo" })).toBeDefined();
    });
  });

  // --- G1: hasResponded = true → banner nascosto ---
  it("should hide when user has already responded to the survey", async () => {
    surveyResponseData = [{ id: "resp-1" }];
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Forfettino resterà gratuito. Sto costruendo il Pro.")).toBeNull();
  });

  // --- G2: NPS campaign attiva → banner nascosto ---
  it("should hide when an NPS campaign is active", async () => {
    npsActiveCampaign = { id: "nps-1", is_active: true };
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Forfettino resterà gratuito. Sto costruendo il Pro.")).toBeNull();
  });

  // --- G4: created_at as full ISO timestamp (not just date) ---
  it("should correctly parse created_at with full ISO timestamp format", async () => {
    profileData = { ...mockProfile, created_at: "2026-01-01T14:30:00+00:00" };
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Forfettino resterà gratuito. Sto costruendo il Pro.")).toBeDefined();
    });
  });

  it("Story 81-6 (AC #10) — outer ha squircle-md, NON rounded-xl", async () => {
    render(<PricingSurveyNudge />, { wrapper: createWrapper() });
    const region = await screen.findByRole("region", { name: "Survey sul prezzo" });
    expect(region.className).toContain("squircle-md");
    expect(region.className).not.toMatch(/(?:^|\s)rounded-xl(?:\s|$)/);
  });
});
