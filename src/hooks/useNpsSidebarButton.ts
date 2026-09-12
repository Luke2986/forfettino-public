import { useNpsEligibility } from "@/hooks/useNpsEligibility";
import { useSurveyBudget } from "@/hooks/useSurveyBudget";

interface NpsSidebarButtonResult {
  /** Whether the "Valuta Forfettino" sidebar button should be visible */
  isVisible: boolean;
  /** Active campaign ID (needed if sidebar triggers the popup) */
  activeCampaignId: string | null;
  /** Loading state — button hidden while loading to avoid flash */
  isLoading: boolean;
}

/**
 * Controls visibility of the "Valuta Forfettino" sidebar button.
 * Reuses useNpsEligibility and useSurveyBudget — no additional queries.
 *
 * Unlike useNpsTrigger, this hook does NOT gate on:
 * - isDashboard (button is visible on any page)
 * - dismissed (user can always click the button manually)
 */
export function useNpsSidebarButton(): NpsSidebarButtonResult {
  const { activeCampaign, hasRespondedCurrentCampaign, isLoading: eligibilityLoading } = useNpsEligibility();
  const { canShowSurvey, isLoading: budgetLoading } = useSurveyBudget();

  const isLoading = eligibilityLoading || budgetLoading;

  const isVisible =
    !isLoading &&
    activeCampaign !== null &&
    !hasRespondedCurrentCampaign &&
    canShowSurvey;

  return {
    isVisible,
    activeCampaignId: activeCampaign?.id ?? null,
    isLoading,
  };
}
