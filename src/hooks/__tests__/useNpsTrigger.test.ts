import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---- Mocks ----

const mockCanShowSurvey = vi.fn().mockReturnValue(true);
const mockBudgetLoading = vi.fn().mockReturnValue(false);
vi.mock("@/hooks/useSurveyBudget", () => ({
  useSurveyBudget: () => ({
    canShowSurvey: mockCanShowSurvey(),
    daysUntilNextSurvey: 0,
    isLoading: mockBudgetLoading(),
  }),
}));

const mockActiveCampaign = vi.fn().mockReturnValue({ id: "camp-1", enabled_triggers: [] });
const mockHasResponded = vi.fn().mockReturnValue(false);
const mockEnabledTriggers = vi.fn().mockReturnValue([]);
const mockEligibilityLoading = vi.fn().mockReturnValue(false);
vi.mock("@/hooks/useNpsEligibility", () => ({
  useNpsEligibility: () => ({
    activeCampaign: mockActiveCampaign(),
    hasRespondedCurrentCampaign: mockHasResponded(),
    enabledTriggers: mockEnabledTriggers(),
    isLoading: mockEligibilityLoading(),
  }),
}));

const mockProfile = vi.fn().mockReturnValue(null);
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: mockProfile() }),
}));

const mockIncomeStats = vi.fn().mockReturnValue(null);
vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({ data: mockIncomeStats() }),
}));

const mockMilestoneClaims = vi.fn().mockReturnValue([]);
vi.mock("@/hooks/useMilestones", () => ({
  useMyMilestoneClaims: () => ({ data: mockMilestoneClaims() }),
}));

const mockPathname = vi.fn().mockReturnValue("/dashboard");
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: mockPathname() }),
}));

// Must import after mocks
import { useNpsTrigger } from "../useNpsTrigger";

// ---- Helpers ----

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function setupDefaults() {
  mockCanShowSurvey.mockReturnValue(true);
  mockBudgetLoading.mockReturnValue(false);
  mockActiveCampaign.mockReturnValue({ id: "camp-1", enabled_triggers: [] });
  mockHasResponded.mockReturnValue(false);
  mockEnabledTriggers.mockReturnValue([]);
  mockEligibilityLoading.mockReturnValue(false);
  mockProfile.mockReturnValue({
    onboarding_completed: false,
    created_at: new Date().toISOString(), // today — not 30 days
  });
  mockIncomeStats.mockReturnValue({ count_total: 0, count_year: 0 });
  mockMilestoneClaims.mockReturnValue([]);
  mockPathname.mockReturnValue("/dashboard");
  localStorage.clear();
}

// ---- Tests ----

describe("useNpsTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // --- Trigger conditions ---

  it("shouldShow: true when 3rd receipt trigger fires (third_receipt)", () => {
    mockIncomeStats.mockReturnValue({ count_total: 3, count_year: 3 });

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.triggerSource).toBe("third_receipt");
  });

  it("shouldShow: true when account 30+ days old (30days_active)", () => {
    mockProfile.mockReturnValue({
      onboarding_completed: false,
      created_at: daysAgo(31),
    });

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.triggerSource).toBe("30days_active");
  });

  it("shouldShow: true when wizard completed + first receipt (wizard_plus_receipt)", () => {
    mockProfile.mockReturnValue({
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    });
    mockIncomeStats.mockReturnValue({ count_total: 1, count_year: 1 });

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.triggerSource).toBe("wizard_plus_receipt");
  });

  it("shouldShow: true when 2nd calendar visit (calendar_2nd_visit)", () => {
    localStorage.setItem("forfettino_calendar_visits", "2");

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.triggerSource).toBe("calendar_2nd_visit");
  });

  it("shouldShow: true when milestone reached recently (milestone_reached)", () => {
    mockMilestoneClaims.mockReturnValue([
      { milestoneId: "m-1", reachedAt: daysAgo(3), rewardClaimed: false },
    ]);

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.triggerSource).toBe("milestone_reached");
  });

  it("shouldShow: false when no trigger conditions are met", () => {
    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(false);
    expect(result.current.triggerSource).toBeNull();
  });

  // --- Priority ---

  it("returns highest-priority trigger when multiple are active", () => {
    // third_receipt (priority 1) + 30days_active (priority 3)
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    mockProfile.mockReturnValue({
      onboarding_completed: true,
      created_at: daysAgo(60),
    });

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.triggerSource).toBe("third_receipt");
  });

  // --- Gate: Dashboard-only ---

  it("shouldShow: false when NOT on dashboard", () => {
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    mockPathname.mockReturnValue("/incassi");

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shouldShow: true on root path / (alias for dashboard)", () => {
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    mockPathname.mockReturnValue("/");

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);
  });

  // --- Gate: Budget 60gg ---

  it("shouldShow: false when budget 60gg is active", () => {
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    mockCanShowSurvey.mockReturnValue(false);

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(false);
  });

  // --- Gate: Already responded ---

  it("shouldShow: false when already responded to current campaign", () => {
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    mockHasResponded.mockReturnValue(true);

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(false);
  });

  // --- Gate: No active campaign ---

  it("shouldShow: false when no active campaign", () => {
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    mockActiveCampaign.mockReturnValue(null);

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(false);
  });

  // --- Dismiss ---

  it("shouldShow: false after dismiss() is called", () => {
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.shouldShow).toBe(true);

    act(() => result.current.dismiss());

    expect(result.current.shouldShow).toBe(false);
  });

  // --- Campaign ID ---

  it("exposes activeCampaignId from eligibility", () => {
    mockActiveCampaign.mockReturnValue({ id: "camp-42", enabled_triggers: [] });

    const { result } = renderHook(() => useNpsTrigger());
    expect(result.current.activeCampaignId).toBe("camp-42");
  });

  // --- Enabled triggers filter ---

  it("only evaluates triggers enabled by campaign config", () => {
    // Campaign only enables "30days_active"
    mockEnabledTriggers.mockReturnValue(["30days_active"]);
    // User has 5 receipts (would trigger "third_receipt" if enabled)
    mockIncomeStats.mockReturnValue({ count_total: 5, count_year: 5 });
    // But account is only 10 days old (30days_active NOT met)
    mockProfile.mockReturnValue({
      onboarding_completed: false,
      created_at: daysAgo(10),
    });

    const { result } = renderHook(() => useNpsTrigger());
    // third_receipt is NOT enabled by campaign, so it shouldn't fire
    expect(result.current.shouldShow).toBe(false);
  });
});
