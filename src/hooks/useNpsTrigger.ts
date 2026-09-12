import { useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSurveyBudget } from "@/hooks/useSurveyBudget";
import { useNpsEligibility } from "@/hooks/useNpsEligibility";
import { useProfile } from "@/hooks/useProfile";
import { useIncomeStats } from "@/hooks/useIncomeStats";
import { useMyMilestoneClaims } from "@/hooks/useMilestones";

const CALENDAR_VISITS_KEY = "forfettino_calendar_visits";
const NPS_DISMISS_KEY = "forfettino_nps_dismissed_at";
const DISMISS_COOLDOWN_DAYS = 30;
const RECENT_DAYS_WINDOW = 7;

function isDismissCooldownActive(): boolean {
  try {
    const raw = localStorage.getItem(NPS_DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = new Date(raw);
    const diffDays = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < DISMISS_COOLDOWN_DAYS;
  } catch {
    return false;
  }
}

function persistDismiss(): void {
  try {
    localStorage.setItem(NPS_DISMISS_KEY, new Date().toISOString());
  } catch {
    // localStorage unavailable
  }
}

/** Trigger source names in priority order (highest first) */
const TRIGGER_PRIORITY: string[] = [
  "third_receipt",
  "wizard_plus_receipt",
  "30days_active",
  "milestone_reached",
  "calendar_2nd_visit",
];

export interface NpsTriggerResult {
  /** Whether the NPS popup should be shown right now */
  shouldShow: boolean;
  /** Which trigger caused the popup (null if not showing) */
  triggerSource: string | null;
  /** Active campaign ID for persisting the response */
  activeCampaignId: string | null;
  /** Call when user dismisses the popup without completing */
  dismiss: () => void;
}

/**
 * NPS trigger engine — evaluates OR conditions to decide when to show the NPS popup.
 * Only fires on Dashboard. Respects 60-day survey budget, campaign eligibility,
 * and prior response for the current campaign.
 *
 * Trigger conditions (OR logic — any one is sufficient):
 * 1. third_receipt: user has >= 3 total receipts
 * 2. 30days_active: account age >= 30 days
 * 3. calendar_2nd_visit: >= 2 visits to Calendario page (localStorage)
 * 4. wizard_plus_receipt: wizard completed AND >= 1 receipt
 * 5. milestone_reached: a milestone was reached within the last 7 days
 *
 * NOTE: post_deadline trigger deferred — useScadenziarioUnified requires
 * FiscalYearContext not available in AppLayout. To be added in future iteration.
 */
export function useNpsTrigger(): NpsTriggerResult {
  const { pathname } = useLocation();
  const { canShowSurvey, isLoading: budgetLoading } = useSurveyBudget();
  const { activeCampaign, hasRespondedCurrentCampaign, enabledTriggers, isLoading: eligibilityLoading } = useNpsEligibility();
  const { data: profile } = useProfile();
  const { data: incomeStats } = useIncomeStats();
  const { data: milestoneClaims } = useMyMilestoneClaims();

  const [dismissed, setDismissed] = useState(() => isDismissCooldownActive());

  const dismiss = useCallback(() => {
    persistDismiss();
    setDismissed(true);
  }, []);

  // Evaluate all trigger conditions
  const activeTrigger = useMemo(() => {
    // Gate 1: session dismiss
    if (dismissed) return null;

    // Gate 2: budget (cheapest check)
    if (!canShowSurvey) return null;

    // Gate 3: campaign eligibility
    if (!activeCampaign || hasRespondedCurrentCampaign) return null;

    // Gate 4: Dashboard-only
    const isDashboard = pathname === "/" || pathname === "/dashboard";
    if (!isDashboard) return null;

    // Gate 5: still loading data
    if (budgetLoading || eligibilityLoading) return null;

    // Helper: check if trigger is enabled by campaign config
    const isTriggerEnabled = (trigger: string) =>
      enabledTriggers.length === 0 || enabledTriggers.includes(trigger);

    // Evaluate individual trigger conditions
    const conditions: { source: string; active: boolean }[] = [];

    // Trigger 1: third_receipt
    if (isTriggerEnabled("third_receipt")) {
      conditions.push({
        source: "third_receipt",
        active: (incomeStats?.count_total ?? 0) >= 3,
      });
    }

    // Trigger 2: wizard_plus_receipt
    if (isTriggerEnabled("wizard_plus_receipt")) {
      conditions.push({
        source: "wizard_plus_receipt",
        active:
          (profile?.onboarding_completed ?? false) &&
          (incomeStats?.count_total ?? 0) >= 1,
      });
    }

    // Trigger 3: 30days_active
    if (isTriggerEnabled("30days_active") && profile?.created_at) {
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      conditions.push({
        source: "30days_active",
        active: daysSinceCreation >= 30,
      });
    }

    // Trigger 4: milestone_reached (within last 7 days)
    if (isTriggerEnabled("milestone_reached") && milestoneClaims) {
      const now = new Date();
      const recentMilestone = milestoneClaims.some((claim) => {
        const reachedAt = new Date(claim.reachedAt);
        const daysSince = (now.getTime() - reachedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= RECENT_DAYS_WINDOW;
      });
      conditions.push({
        source: "milestone_reached",
        active: recentMilestone,
      });
    }

    // Trigger 5: calendar_2nd_visit (localStorage)
    if (isTriggerEnabled("calendar_2nd_visit")) {
      try {
        const visits = parseInt(localStorage.getItem(CALENDAR_VISITS_KEY) || "0", 10);
        conditions.push({
          source: "calendar_2nd_visit",
          active: visits >= 2,
        });
      } catch {
        // localStorage unavailable — skip this trigger
      }
    }

    // Return highest-priority active trigger (OR logic)
    for (const trigger of TRIGGER_PRIORITY) {
      const match = conditions.find((c) => c.source === trigger && c.active);
      if (match) return match.source;
    }

    return null;
  }, [
    dismissed,
    canShowSurvey,
    activeCampaign,
    hasRespondedCurrentCampaign,
    enabledTriggers,
    pathname,
    budgetLoading,
    eligibilityLoading,
    incomeStats,
    profile,
    milestoneClaims,
  ]);

  return {
    shouldShow: activeTrigger !== null,
    triggerSource: activeTrigger,
    activeCampaignId: activeCampaign?.id ?? null,
    dismiss,
  };
}
