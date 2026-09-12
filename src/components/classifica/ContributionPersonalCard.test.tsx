import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ContributionPersonalCard } from "./ContributionPersonalCard";
import type { ContributionBreakdown, ActionConfig } from "@/lib/contribution-helpers";

const MOCK_CONFIGS: ActionConfig[] = [
  {
    actionType: "call_completed",
    points: 50,
    label: "Call completata",
    frequencyLabel: "ogni call",
    colorBg: "bg-rose-500",
    colorText: "text-rose-700",
    displayOrder: 1,
  },
  {
    actionType: "feedback_submitted",
    points: 15,
    label: "Feedback inviato",
    frequencyLabel: "ogni feedback",
    colorBg: "bg-amber-500",
    colorText: "text-amber-700",
    displayOrder: 2,
  },
  {
    actionType: "referral_signup",
    points: 30,
    label: "Referral",
    frequencyLabel: "max 10/mese",
    colorBg: "bg-violet-500",
    colorText: "text-violet-700",
    displayOrder: 3,
  },
  {
    actionType: "first_import_xml",
    points: 15,
    label: "Primo import XML",
    frequencyLabel: "una tantum",
    colorBg: "bg-blue-500",
    colorText: "text-blue-700",
    displayOrder: 4,
  },
];

const ZERO_BREAKDOWN: ContributionBreakdown = {
  callPts: 0,
  feedbackPts: 0,
  referralPts: 0,
  firstImportXmlPts: 0,
  welcomeGiftPts: 0,
  adminManualPts: 0,
  npsSurveyPts: 0,
  pricingSurveyPts: 0,
  calendarSurveyPts: 0,
  totalPts: 0,
  myRank: 0,
  monthlyReferralCount: 0,
};

const SAMPLE_BREAKDOWN: ContributionBreakdown = {
  callPts: 100,
  feedbackPts: 30,
  referralPts: 60,
  firstImportXmlPts: 15,
  welcomeGiftPts: 5,
  adminManualPts: 0,
  npsSurveyPts: 0,
  pricingSurveyPts: 0,
  calendarSurveyPts: 0,
  totalPts: 210,
  myRank: 3,
  monthlyReferralCount: 0,
};

describe("ContributionPersonalCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading skeleton when isLoading", () => {
    const { container } = render(
      <ContributionPersonalCard
        breakdown={ZERO_BREAKDOWN}
        configs={MOCK_CONFIGS}
        isLoading={true}
      />,
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders 'Punti accumulati' label", () => {
    render(<ContributionPersonalCard breakdown={SAMPLE_BREAKDOWN} configs={MOCK_CONFIGS} />);
    expect(screen.getByText("Punti accumulati")).toBeInTheDocument();
  });

  it("does not render rank badge even when myRank > 0", () => {
    render(<ContributionPersonalCard breakdown={SAMPLE_BREAKDOWN} configs={MOCK_CONFIGS} />);
    expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
  });

  it("animates count to total value", () => {
    render(<ContributionPersonalCard breakdown={SAMPLE_BREAKDOWN} configs={MOCK_CONFIGS} />);

    // Initially shows 0 (animation reset)
    expect(screen.getByText("0")).toBeInTheDocument();

    // Advance timers to complete animation (1000ms / 30 steps = ~33ms per step x 30 steps)
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Should show final total
    expect(screen.getByText("210")).toBeInTheDocument();
  });

  it("displays 0 when totalPts is 0", () => {
    render(<ContributionPersonalCard breakdown={ZERO_BREAKDOWN} configs={MOCK_CONFIGS} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
