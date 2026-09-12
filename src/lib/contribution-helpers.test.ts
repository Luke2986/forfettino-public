import { describe, it, expect } from "vitest";
import {
  computeBarSegments,
  mapRpcToBreakdown,
  mapRpcToActionConfig,
  getBreakdownItems,
  getMilestoneProgress,
  mapRpcToMilestone,
  type ContributionBreakdown,
  type ActionConfig,
  type Milestone,
} from "./contribution-helpers";

// --- Test fixtures ---

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

describe("contribution-helpers", () => {
  describe("mapRpcToActionConfig", () => {
    it("maps DB row to ActionConfig type", () => {
      const row = {
        action_type: "call_completed",
        points: 50,
        label: "Call completata",
        frequency_label: "ogni call",
        color_bg: "bg-rose-500",
        color_text: "text-rose-700",
        display_order: 1,
      };
      const result = mapRpcToActionConfig(row);
      expect(result).toEqual({
        actionType: "call_completed",
        points: 50,
        label: "Call completata",
        frequencyLabel: "ogni call",
        colorBg: "bg-rose-500",
        colorText: "text-rose-700",
        displayOrder: 1,
      });
    });

    it("converts numeric strings from Supabase", () => {
      const row = {
        action_type: "feedback_submitted",
        points: "15" as any,
        label: "Feedback",
        frequency_label: "ogni feedback",
        color_bg: "bg-amber-500",
        color_text: "text-amber-700",
        display_order: "2" as any,
      };
      const result = mapRpcToActionConfig(row);
      expect(result.points).toBe(15);
      expect(result.displayOrder).toBe(2);
    });
  });

  describe("computeBarSegments", () => {
    it("returns empty for zero total", () => {
      const breakdown: ContributionBreakdown = {
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
        myRank: 1,
        monthlyReferralCount: 0,
      };
      expect(computeBarSegments(breakdown, MOCK_CONFIGS)).toEqual([]);
    });

    it("returns single segment when only one category", () => {
      const breakdown: ContributionBreakdown = {
        callPts: 50,
        feedbackPts: 0,
        referralPts: 0,
        firstImportXmlPts: 0,
        welcomeGiftPts: 0,
        adminManualPts: 0,
        npsSurveyPts: 0,
        pricingSurveyPts: 0,
        calendarSurveyPts: 0,
        totalPts: 50,
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const segments = computeBarSegments(breakdown, MOCK_CONFIGS);
      expect(segments).toHaveLength(1);
      expect(segments[0].action).toBe("call_completed");
      expect(segments[0].percent).toBe(100);
      expect(segments[0].color).toBe("bg-rose-500");
    });

    it("computes correct percentages for multiple categories", () => {
      const breakdown: ContributionBreakdown = {
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
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const segments = computeBarSegments(breakdown, MOCK_CONFIGS);
      expect(segments).toHaveLength(4);
      const total = segments.reduce((acc, s) => acc + s.percent, 0);
      expect(total).toBe(100);
    });

    it("filters out zero-point categories", () => {
      const breakdown: ContributionBreakdown = {
        callPts: 50,
        feedbackPts: 0,
        referralPts: 30,
        firstImportXmlPts: 0,
        welcomeGiftPts: 0,
        adminManualPts: 0,
        npsSurveyPts: 0,
        pricingSurveyPts: 0,
        calendarSurveyPts: 0,
        totalPts: 80,
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const segments = computeBarSegments(breakdown, MOCK_CONFIGS);
      expect(segments).toHaveLength(2);
      expect(segments.map((s) => s.action)).toContain("call_completed");
      expect(segments.map((s) => s.action)).toContain("referral_signup");
    });

    it("ensures percentages sum to 100 with rounding", () => {
      // 33.33... each — should round correctly
      const breakdown: ContributionBreakdown = {
        callPts: 100,
        feedbackPts: 100,
        referralPts: 100,
        firstImportXmlPts: 0,
        welcomeGiftPts: 0,
        adminManualPts: 0,
        npsSurveyPts: 0,
        pricingSurveyPts: 0,
        calendarSurveyPts: 0,
        totalPts: 300,
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const segments = computeBarSegments(breakdown, MOCK_CONFIGS);
      const total = segments.reduce((acc, s) => acc + s.percent, 0);
      expect(total).toBe(100);
    });

    describe("with maxPts (goal mode)", () => {
      it("returns proportional fill when maxPts > totalPts", () => {
        const breakdown: ContributionBreakdown = {
          callPts: 50,
          feedbackPts: 0,
          referralPts: 0,
          firstImportXmlPts: 0,
          welcomeGiftPts: 0,
          adminManualPts: 0,
          npsSurveyPts: 0,
          pricingSurveyPts: 0,
          calendarSurveyPts: 0,
          totalPts: 50,
          myRank: 1,
          monthlyReferralCount: 0,
        };
        const segments = computeBarSegments(breakdown, MOCK_CONFIGS, 1000);
        expect(segments).toHaveLength(1);
        // 50/1000 = 5%
        expect(segments[0].percent).toBe(5);
      });

      it("ensures minimum 1% for tiny point values", () => {
        const breakdown: ContributionBreakdown = {
          callPts: 5,
          feedbackPts: 0,
          referralPts: 0,
          firstImportXmlPts: 0,
          welcomeGiftPts: 0,
          adminManualPts: 0,
          npsSurveyPts: 0,
          pricingSurveyPts: 0,
          calendarSurveyPts: 0,
          totalPts: 5,
          myRank: 1,
          monthlyReferralCount: 0,
        };
        const segments = computeBarSegments(breakdown, MOCK_CONFIGS, 1330);
        expect(segments).toHaveLength(1);
        // 5/1330 ≈ 0.38% → clamped to 1%
        expect(segments[0].percent).toBeGreaterThanOrEqual(1);
      });

      it("falls back to distribution mode when maxPts <= totalPts", () => {
        const breakdown: ContributionBreakdown = {
          callPts: 50,
          feedbackPts: 0,
          referralPts: 0,
          firstImportXmlPts: 0,
          welcomeGiftPts: 0,
          adminManualPts: 0,
          npsSurveyPts: 0,
          pricingSurveyPts: 0,
          calendarSurveyPts: 0,
          totalPts: 50,
          myRank: 1,
          monthlyReferralCount: 0,
        };
        // maxPts <= totalPts → distribution mode (100%)
        const segments = computeBarSegments(breakdown, MOCK_CONFIGS, 50);
        expect(segments[0].percent).toBe(100);
      });

      it("segments sum to less than 100% in goal mode", () => {
        const breakdown: ContributionBreakdown = {
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
          myRank: 1,
          monthlyReferralCount: 0,
        };
        // 110/1330 ≈ 8.3% total fill
        const segments = computeBarSegments(breakdown, MOCK_CONFIGS, 1330);
        const total = segments.reduce((acc, s) => acc + s.percent, 0);
        expect(total).toBeLessThan(100);
        expect(total).toBeGreaterThan(0);
      });
    });
  });

  describe("mapRpcToBreakdown", () => {
    it("maps all fields correctly", () => {
      const rpcRow = {
        feedback_pts: 20,
        referral_pts: 30,
        call_pts: 50,
        first_import_xml_pts: 15,
        welcome_gift_pts: 5,
        admin_manual_pts: 10,
        total_pts: 130,
        my_rank: 3,
        monthly_referral_count: 2,
      };
      const result = mapRpcToBreakdown(rpcRow);
      expect(result).toEqual({
        feedbackPts: 20,
        referralPts: 30,
        callPts: 50,
        firstImportXmlPts: 15,
        welcomeGiftPts: 5,
        adminManualPts: 10,
        npsSurveyPts: 0,
        pricingSurveyPts: 0,
        calendarSurveyPts: 0,
        totalPts: 130,
        myRank: 3,
        monthlyReferralCount: 2,
      });
    });

    it("maps separate survey columns", () => {
      const rpcRow = {
        feedback_pts: 0,
        referral_pts: 0,
        call_pts: 0,
        first_import_xml_pts: 0,
        welcome_gift_pts: 5,
        admin_manual_pts: 0,
        nps_survey_pts: 5,
        pricing_survey_pts: 10,
        calendar_survey_pts: 5,
        total_pts: 25,
        my_rank: 1,
        monthly_referral_count: 0,
      };
      const result = mapRpcToBreakdown(rpcRow);
      expect(result.npsSurveyPts).toBe(5);
      expect(result.pricingSurveyPts).toBe(10);
      expect(result.calendarSurveyPts).toBe(5);
      expect(result.totalPts).toBe(25);
    });

    it("converts string numbers from Supabase", () => {
      const rpcRow = {
        feedback_pts: "10" as any,
        referral_pts: "0" as any,
        call_pts: "0" as any,
        first_import_xml_pts: "15" as any,
        welcome_gift_pts: "5" as any,
        admin_manual_pts: "0" as any,
        total_pts: "30" as any,
        my_rank: "1" as any,
        monthly_referral_count: "4" as any,
      };
      const result = mapRpcToBreakdown(rpcRow);
      expect(result.feedbackPts).toBe(10);
      expect(result.firstImportXmlPts).toBe(15);
      expect(result.totalPts).toBe(30);
      expect(result.myRank).toBe(1);
      expect(result.monthlyReferralCount).toBe(4);
    });

    it("defaults welcomeGiftPts to 0 when absent", () => {
      const rpcRow = {
        feedback_pts: 0,
        referral_pts: 0,
        call_pts: 0,
        first_import_xml_pts: 0,
        total_pts: 0,
        my_rank: 0,
      };
      const result = mapRpcToBreakdown(rpcRow);
      expect(result.welcomeGiftPts).toBe(0);
    });

    it("defaults adminManualPts to 0 when absent", () => {
      const rpcRow = {
        feedback_pts: 0,
        referral_pts: 0,
        call_pts: 0,
        first_import_xml_pts: 0,
        total_pts: 0,
        my_rank: 0,
      };
      const result = mapRpcToBreakdown(rpcRow);
      expect(result.adminManualPts).toBe(0);
    });

    it("defaults monthlyReferralCount to 0 when absent", () => {
      const rpcRow = {
        feedback_pts: 0,
        referral_pts: 0,
        call_pts: 0,
        first_import_xml_pts: 0,
        total_pts: 0,
        my_rank: 0,
      };
      const result = mapRpcToBreakdown(rpcRow);
      expect(result.monthlyReferralCount).toBe(0);
    });
  });

  describe("getBreakdownItems", () => {
    it("returns items sorted by points descending", () => {
      const breakdown: ContributionBreakdown = {
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
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const items = getBreakdownItems(breakdown, MOCK_CONFIGS);
      expect(items).toHaveLength(4);
      expect(items[0].action).toBe("call_completed");
      expect(items[1].action).toBe("referral_signup");
      // feedback and first_import_xml are both 15, order depends on stable sort
    });

    it("filters out zero-point items", () => {
      const breakdown: ContributionBreakdown = {
        callPts: 0,
        feedbackPts: 10,
        referralPts: 0,
        firstImportXmlPts: 0,
        welcomeGiftPts: 0,
        adminManualPts: 0,
        npsSurveyPts: 0,
        pricingSurveyPts: 0,
        calendarSurveyPts: 0,
        totalPts: 10,
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const items = getBreakdownItems(breakdown, MOCK_CONFIGS);
      expect(items).toHaveLength(1);
      expect(items[0].action).toBe("feedback_submitted");
    });

    it("includes labels and colors from config", () => {
      const breakdown: ContributionBreakdown = {
        callPts: 50,
        feedbackPts: 0,
        referralPts: 0,
        firstImportXmlPts: 0,
        welcomeGiftPts: 0,
        adminManualPts: 0,
        npsSurveyPts: 0,
        pricingSurveyPts: 0,
        calendarSurveyPts: 0,
        totalPts: 50,
        myRank: 1,
        monthlyReferralCount: 0,
      };
      const items = getBreakdownItems(breakdown, MOCK_CONFIGS);
      expect(items[0].label).toBe("Call completata");
      expect(items[0].color).toBe("bg-rose-500");
      expect(items[0].textColor).toBe("text-rose-700");
    });

    it("returns empty for all-zero breakdown", () => {
      const breakdown: ContributionBreakdown = {
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
        myRank: 1,
        monthlyReferralCount: 0,
      };
      expect(getBreakdownItems(breakdown, MOCK_CONFIGS)).toEqual([]);
    });
  });

  describe("getMilestoneProgress", () => {
    const milestones: Milestone[] = [
      { id: "m1", level: 1, name: "Supporter", pointsRequired: 110, rewardType: "badge", rewardLabel: "Badge Supporter" },
      { id: "m2", level: 2, name: "Contributor", pointsRequired: 330, rewardType: "discount_15", rewardLabel: "Sconto 15%" },
      { id: "m3", level: 3, name: "Champion", pointsRequired: 660, rewardType: "discount_30", rewardLabel: "Sconto 30%" },
      { id: "m4", level: 4, name: "Ambassador", pointsRequired: 1000, rewardType: "pro_3_months", rewardLabel: "3 mesi Pro" },
      { id: "m5", level: 5, name: "Legend", pointsRequired: 1330, rewardType: "pro_12_months", rewardLabel: "12 mesi Pro" },
    ];

    it("returns nulls for empty milestones array", () => {
      const result = getMilestoneProgress(100, []);
      expect(result).toEqual({ current: null, next: null, percent: 0 });
    });

    it("returns first milestone as next when 0 points", () => {
      const result = getMilestoneProgress(0, milestones);
      expect(result.current).toBeNull();
      expect(result.next?.id).toBe("m1");
      expect(result.percent).toBe(0);
    });

    it("returns partial progress toward first milestone", () => {
      const result = getMilestoneProgress(55, milestones);
      expect(result.current).toBeNull();
      expect(result.next?.id).toBe("m1");
      expect(result.percent).toBe(50); // 55/110 = 50%
    });

    it("shows first milestone reached and progress toward second", () => {
      const result = getMilestoneProgress(220, milestones);
      expect(result.current?.id).toBe("m1");
      expect(result.next?.id).toBe("m2");
      // range = 330 - 110 = 220, progress = 220 - 110 = 110 → 50%
      expect(result.percent).toBe(50);
    });

    it("handles exact milestone threshold", () => {
      const result = getMilestoneProgress(330, milestones);
      expect(result.current?.id).toBe("m2");
      expect(result.next?.id).toBe("m3");
      expect(result.percent).toBe(0); // exactly at m2, 0% toward m3
    });

    it("handles progress between middle milestones", () => {
      const result = getMilestoneProgress(495, milestones);
      expect(result.current?.id).toBe("m2");
      expect(result.next?.id).toBe("m3");
      // range = 660 - 330 = 330, progress = 495 - 330 = 165 → 50%
      expect(result.percent).toBe(50);
    });

    it("returns 100% when all milestones reached", () => {
      const result = getMilestoneProgress(5000, milestones);
      expect(result.current?.id).toBe("m5");
      expect(result.next).toBeNull();
      expect(result.percent).toBe(100);
    });

    it("returns 100% when exactly at last milestone", () => {
      const result = getMilestoneProgress(1330, milestones);
      expect(result.current?.id).toBe("m5");
      expect(result.next).toBeNull();
      expect(result.percent).toBe(100);
    });

    it("caps percent at 100", () => {
      const single: Milestone[] = [
        { id: "s1", level: 1, name: "Test", pointsRequired: 100, rewardType: "badge", rewardLabel: "Badge" },
      ];
      const result = getMilestoneProgress(200, single);
      expect(result.percent).toBe(100);
    });
  });

  describe("mapRpcToMilestone", () => {
    it("maps all DB fields to Milestone type", () => {
      const rpcRow = {
        id: "abc-123",
        level: 3,
        name: "Champion",
        points_required: 660,
        reward_type: "discount_30",
        reward_label: "Sconto 30%",
      };
      const result = mapRpcToMilestone(rpcRow);
      expect(result).toEqual({
        id: "abc-123",
        level: 3,
        name: "Champion",
        pointsRequired: 660,
        rewardType: "discount_30",
        rewardLabel: "Sconto 30%",
      });
    });

    it("preserves all field types", () => {
      const rpcRow = {
        id: "uuid-test",
        level: 1,
        name: "Supporter",
        points_required: 110,
        reward_type: "badge",
        reward_label: "Badge Supporter",
      };
      const result = mapRpcToMilestone(rpcRow);
      expect(typeof result.id).toBe("string");
      expect(typeof result.level).toBe("number");
      expect(typeof result.pointsRequired).toBe("number");
      expect(typeof result.rewardType).toBe("string");
    });
  });
});
