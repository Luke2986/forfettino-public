import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContributionProgressBar } from "./ContributionProgressBar";
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

const EMPTY_BREAKDOWN: ContributionBreakdown = {
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

const MIXED_BREAKDOWN: ContributionBreakdown = {
  callPts: 50,
  feedbackPts: 15,
  referralPts: 30,
  firstImportXmlPts: 15,
  welcomeGiftPts: 0,
  adminManualPts: 0,
  npsSurveyPts: 0,
  pricingSurveyPts: 0,
  calendarSurveyPts: 0,
  totalPts: 110,
  myRank: 3,
  monthlyReferralCount: 0,
};

describe("ContributionProgressBar", () => {
  it("shows empty message when totalPts is 0", () => {
    render(<ContributionProgressBar breakdown={EMPTY_BREAKDOWN} configs={MOCK_CONFIGS} />);
    expect(screen.getByText("Nessun punto ancora")).toBeInTheDocument();
  });

  it("renders segments when breakdown has points", () => {
    render(<ContributionProgressBar breakdown={MIXED_BREAKDOWN} configs={MOCK_CONFIGS} />);
    const bar = screen.getByRole("img");
    expect(bar).toHaveAttribute("aria-label");
    expect(bar.getAttribute("aria-label")).toContain("Call completata");
    expect(bar.getAttribute("aria-label")).toContain("Referral");
  });

  it("renders only non-zero segments", () => {
    const onlyCall: ContributionBreakdown = {
      ...EMPTY_BREAKDOWN,
      callPts: 50,
      totalPts: 50,
      myRank: 1,
    };
    render(<ContributionProgressBar breakdown={onlyCall} configs={MOCK_CONFIGS} />);
    const bar = screen.getByRole("img");
    const label = bar.getAttribute("aria-label") ?? "";
    expect(label).toContain("Call completata");
    expect(label).not.toContain("Referral");
    expect(label).not.toContain("Feedback");
  });

  it("segment widths sum to 100% without maxPts (distribution mode)", () => {
    const { container } = render(
      <ContributionProgressBar breakdown={MIXED_BREAKDOWN} configs={MOCK_CONFIGS} />,
    );
    const bar = container.querySelector("[role='img']");
    const segments = bar?.children;
    if (!segments) throw new Error("No segments found");

    let totalWidth = 0;
    for (const seg of Array.from(segments)) {
      const style = (seg as HTMLElement).style.width;
      totalWidth += parseFloat(style);
    }
    expect(totalWidth).toBe(100);
  });

  it("segment widths sum to less than 100% with maxPts (goal mode)", () => {
    const { container } = render(
      <ContributionProgressBar breakdown={MIXED_BREAKDOWN} configs={MOCK_CONFIGS} maxPts={1330} />,
    );
    const bar = container.querySelector("[role='img']");
    const segments = bar?.children;
    if (!segments) throw new Error("No segments found");

    let totalWidth = 0;
    for (const seg of Array.from(segments)) {
      const style = (seg as HTMLElement).style.width;
      totalWidth += parseFloat(style);
    }
    // 110/1330 ≈ 8.3% — segments should NOT fill the entire bar
    expect(totalWidth).toBeLessThan(100);
    expect(totalWidth).toBeGreaterThan(0);
  });

  it("bar container has bg-slate-100 track background", () => {
    const { container } = render(
      <ContributionProgressBar breakdown={MIXED_BREAKDOWN} configs={MOCK_CONFIGS} maxPts={1330} />,
    );
    const bar = container.querySelector("[role='img']");
    expect(bar?.className).toContain("bg-slate-100");
  });
});
