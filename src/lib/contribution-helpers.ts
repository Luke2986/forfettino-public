/**
 * Contribution system helpers — pure functions for the Contributo feature.
 * 7 action types, DB-driven config, no hardcoded point values.
 */

// --- Action Types (7 actions) ---

export type ContributionActionType =
  | "call_completed"
  | "feedback_submitted"
  | "referral_signup"
  | "first_import_xml"
  | "welcome_gift"
  | "admin_manual"
  | "nps_survey_completed"
  | "pricing_survey_completed"
  | "calendar_survey_completed";

// --- Action Config (from DB) ---

export interface ActionConfig {
  actionType: ContributionActionType;
  points: number;
  label: string;
  frequencyLabel: string;
  colorBg: string;
  colorText: string;
  displayOrder: number;
}

/**
 * Map DB row from get_action_config() RPC to ActionConfig type.
 */
export function mapRpcToActionConfig(row: {
  action_type: string;
  points: number;
  label: string;
  frequency_label: string;
  color_bg: string;
  color_text: string;
  display_order: number;
}): ActionConfig {
  return {
    actionType: row.action_type as ContributionActionType,
    points: Number(row.points),
    label: row.label,
    frequencyLabel: row.frequency_label,
    colorBg: row.color_bg,
    colorText: row.color_text,
    displayOrder: Number(row.display_order),
  };
}

// --- Referral Cap (still hardcoded — matches Edge Function + SQL trigger) ---

export const MONTHLY_REFERRAL_CAP = 10;

// --- Contribution Breakdown Type (7 actions) ---

export interface ContributionBreakdown {
  callPts: number;
  feedbackPts: number;
  referralPts: number;
  firstImportXmlPts: number;
  welcomeGiftPts: number;
  adminManualPts: number;
  npsSurveyPts: number;
  pricingSurveyPts: number;
  calendarSurveyPts: number;
  totalPts: number;
  myRank: number;
  monthlyReferralCount: number;
}

// --- Progress Bar Segment Calculation ---

export interface BarSegment {
  action: ContributionActionType;
  points: number;
  percent: number;
  color: string;
}

/**
 * Compute progress bar segments from a contribution breakdown.
 * Colors come from ActionConfig (DB-driven).
 * Returns segments with percent > 0 only, ordered by config display order.
 *
 * When `maxPts` is provided and > totalPts, percentages are relative to
 * maxPts so the bar fills proportionally (e.g., 5 pts / 1330 max = tiny sliver).
 * Without maxPts, percentages sum to 100% (distribution view).
 */
export function computeBarSegments(
  breakdown: ContributionBreakdown,
  configs: ActionConfig[],
  maxPts?: number,
): BarSegment[] {
  const total = breakdown.totalPts;
  if (total === 0) return [];

  // When maxPts is provided and > total, use it as denominator
  // so the bar fills proportionally to the goal
  const useGoalMode = maxPts != null && maxPts > total;
  const denominator = useGoalMode ? maxPts : total;

  const actionPoints: Record<string, number> = {
    call_completed: breakdown.callPts,
    feedback_submitted: breakdown.feedbackPts,
    referral_signup: breakdown.referralPts,
    first_import_xml: breakdown.firstImportXmlPts,
    welcome_gift: breakdown.welcomeGiftPts,
    admin_manual: breakdown.adminManualPts,
    nps_survey_completed: breakdown.npsSurveyPts,
    pricing_survey_completed: breakdown.pricingSurveyPts,
    calendar_survey_completed: breakdown.calendarSurveyPts,
  };

  const raw = configs
    .map((c) => ({
      action: c.actionType,
      points: actionPoints[c.actionType] ?? 0,
      color: c.colorBg,
    }))
    .filter((s) => s.points > 0);

  if (raw.length === 0) return [];

  // Compute raw percentages; ensure at least 1% for visible non-zero segments
  const segments: BarSegment[] = raw.map((s) => ({
    action: s.action,
    points: s.points,
    percent: useGoalMode
      ? Math.max(1, Math.round((s.points / denominator) * 100))
      : Math.floor((s.points / denominator) * 100),
    color: s.color,
  }));

  if (useGoalMode) {
    // In goal mode, cap total so min-1% adjustments don't overshoot
    const expectedTotal = Math.max(segments.length, Math.round((total / denominator) * 100));
    const sumPercent = segments.reduce((acc, s) => acc + s.percent, 0);
    if (sumPercent > expectedTotal) {
      let largestIdx = 0;
      for (let i = 1; i < segments.length; i++) {
        if (segments[i].percent > segments[largestIdx].percent) {
          largestIdx = i;
        }
      }
      const excess = sumPercent - expectedTotal;
      segments[largestIdx].percent = Math.max(1, segments[largestIdx].percent - excess);
    }
  } else {
    // Distribution mode: adjust rounding so percentages sum to exactly 100%
    const sumPercent = segments.reduce((acc, s) => acc + s.percent, 0);
    const remainder = 100 - sumPercent;
    if (remainder > 0 && segments.length > 0) {
      let largestIdx = 0;
      for (let i = 1; i < segments.length; i++) {
        if (segments[i].points > segments[largestIdx].points) {
          largestIdx = i;
        }
      }
      segments[largestIdx].percent += remainder;
    }
  }

  return segments;
}

/**
 * Convert the RPC response row to our ContributionBreakdown type.
 */
export function mapRpcToBreakdown(row: {
  feedback_pts: number;
  referral_pts: number;
  call_pts: number;
  first_import_xml_pts: number;
  welcome_gift_pts?: number;
  admin_manual_pts?: number;
  nps_survey_pts?: number;
  pricing_survey_pts?: number;
  calendar_survey_pts?: number;
  total_pts: number;
  my_rank: number;
  monthly_referral_count?: number;
}): ContributionBreakdown {
  return {
    feedbackPts: Number(row.feedback_pts),
    referralPts: Number(row.referral_pts),
    callPts: Number(row.call_pts),
    firstImportXmlPts: Number(row.first_import_xml_pts),
    welcomeGiftPts: Number(row.welcome_gift_pts ?? 0),
    adminManualPts: Number(row.admin_manual_pts ?? 0),
    npsSurveyPts: Number(row.nps_survey_pts ?? 0),
    pricingSurveyPts: Number(row.pricing_survey_pts ?? 0),
    calendarSurveyPts: Number(row.calendar_survey_pts ?? 0),
    totalPts: Number(row.total_pts),
    myRank: Number(row.my_rank),
    monthlyReferralCount: Number(row.monthly_referral_count ?? 0),
  };
}

/**
 * Get the breakdown list items for display, ordered by points descending.
 * Labels and colors come from ActionConfig (DB-driven).
 */
export function getBreakdownItems(
  breakdown: ContributionBreakdown,
  configs: ActionConfig[],
): Array<{
  action: ContributionActionType;
  label: string;
  points: number;
  color: string;
  textColor: string;
}> {
  const actionPoints: Record<string, number> = {
    call_completed: breakdown.callPts,
    feedback_submitted: breakdown.feedbackPts,
    referral_signup: breakdown.referralPts,
    first_import_xml: breakdown.firstImportXmlPts,
    welcome_gift: breakdown.welcomeGiftPts,
    admin_manual: breakdown.adminManualPts,
    nps_survey_completed: breakdown.npsSurveyPts,
    pricing_survey_completed: breakdown.pricingSurveyPts,
    calendar_survey_completed: breakdown.calendarSurveyPts,
  };

  return configs
    .map((c) => ({
      action: c.actionType,
      label: c.label,
      points: actionPoints[c.actionType] ?? 0,
      color: c.colorBg,
      textColor: c.colorText,
    }))
    .filter((i) => i.points > 0)
    .sort((a, b) => b.points - a.points);
}

// --- Milestone Types & Helpers (unchanged) ---

export interface Milestone {
  id: string;
  level: number;
  name: string;
  pointsRequired: number;
  rewardType: string;
  rewardLabel: string;
}

export interface UserMilestoneClaim {
  milestoneId: string;
  reachedAt: string;
  rewardClaimed: boolean;
}

export interface MilestoneProgress {
  /** Last milestone the user surpassed (null if none) */
  current: Milestone | null;
  /** Next milestone to reach (null if all reached) */
  next: Milestone | null;
  /** Progress percent toward next milestone (0-100) */
  percent: number;
}

/**
 * Compute progress toward the next milestone.
 * Milestones must be sorted by level ASC.
 */
export function getMilestoneProgress(
  totalPts: number,
  milestones: Milestone[],
): MilestoneProgress {
  if (milestones.length === 0) {
    return { current: null, next: null, percent: 0 };
  }

  let current: Milestone | null = null;
  let next: Milestone | null = null;

  for (const m of milestones) {
    if (totalPts >= m.pointsRequired) {
      current = m;
    } else {
      next = m;
      break;
    }
  }

  // All milestones reached
  if (!next) {
    return { current, next: null, percent: 100 };
  }

  // Compute % from previous threshold to next
  const prevThreshold = current ? current.pointsRequired : 0;
  const range = next.pointsRequired - prevThreshold;
  const progress = totalPts - prevThreshold;
  const percent = range > 0 ? Math.min(100, Math.floor((progress / range) * 100)) : 0;

  return { current, next, percent };
}

/**
 * Map DB row from get_milestones() RPC to Milestone type.
 */
export function mapRpcToMilestone(row: {
  id: string;
  level: number;
  name: string;
  points_required: number;
  reward_type: string;
  reward_label: string;
}): Milestone {
  return {
    id: row.id,
    level: row.level,
    name: row.name,
    pointsRequired: row.points_required,
    rewardType: row.reward_type,
    rewardLabel: row.reward_label,
  };
}

// --- Milestone Reward Type Labels (Italian) ---

export const REWARD_TYPE_LABELS: Record<string, string> = {
  badge: "Badge",
  discount_15: "Sconto 15%",
  discount_30: "Sconto 30%",
  pro_3_months: "3 mesi Pro gratis",
  pro_12_months: "12 mesi Pro gratis",
};
