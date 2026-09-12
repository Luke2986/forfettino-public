import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock dependencies
const mockEligibility = {
  activeCampaign: null as { id: string } | null,
  hasRespondedCurrentCampaign: false,
  enabledTriggers: [] as string[],
  isLoading: false,
};
vi.mock("@/hooks/useNpsEligibility", () => ({
  useNpsEligibility: () => mockEligibility,
}));

const mockBudget = {
  canShowSurvey: true,
  daysUntilNextSurvey: 0,
  isLoading: false,
};
vi.mock("@/hooks/useSurveyBudget", () => ({
  useSurveyBudget: () => mockBudget,
}));

import { useNpsSidebarButton } from "../useNpsSidebarButton";

describe("useNpsSidebarButton", () => {
  beforeEach(() => {
    // Reset to defaults
    mockEligibility.activeCampaign = null;
    mockEligibility.hasRespondedCurrentCampaign = false;
    mockEligibility.enabledTriggers = [];
    mockEligibility.isLoading = false;
    mockBudget.canShowSurvey = true;
    mockBudget.daysUntilNextSurvey = 0;
    mockBudget.isLoading = false;
  });

  it("returns isVisible: true when campaign active, not responded, budget ok", () => {
    mockEligibility.activeCampaign = { id: "camp-1" };
    mockEligibility.hasRespondedCurrentCampaign = false;
    mockBudget.canShowSurvey = true;

    const { result } = renderHook(() => useNpsSidebarButton());

    expect(result.current.isVisible).toBe(true);
    expect(result.current.activeCampaignId).toBe("camp-1");
    expect(result.current.isLoading).toBe(false);
  });

  it("returns isVisible: false when no active campaign", () => {
    mockEligibility.activeCampaign = null;

    const { result } = renderHook(() => useNpsSidebarButton());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.activeCampaignId).toBeNull();
  });

  it("returns isVisible: false when user already responded to current campaign", () => {
    mockEligibility.activeCampaign = { id: "camp-1" };
    mockEligibility.hasRespondedCurrentCampaign = true;

    const { result } = renderHook(() => useNpsSidebarButton());

    expect(result.current.isVisible).toBe(false);
  });

  it("returns isVisible: false when 60-day budget exhausted", () => {
    mockEligibility.activeCampaign = { id: "camp-1" };
    mockBudget.canShowSurvey = false;
    mockBudget.daysUntilNextSurvey = 42;

    const { result } = renderHook(() => useNpsSidebarButton());

    expect(result.current.isVisible).toBe(false);
  });

  it("returns isVisible: false when eligibility is loading (no flash)", () => {
    mockEligibility.activeCampaign = { id: "camp-1" };
    mockEligibility.isLoading = true;

    const { result } = renderHook(() => useNpsSidebarButton());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("returns isVisible: false when budget is loading (no flash)", () => {
    mockEligibility.activeCampaign = { id: "camp-1" };
    mockBudget.isLoading = true;

    const { result } = renderHook(() => useNpsSidebarButton());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });
});
