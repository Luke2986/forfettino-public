import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SURVEY_COOLDOWN_DAYS = 60;

interface SurveyBudgetResult {
  /** true if the user can see a new survey (no survey in last 60 days) */
  canShowSurvey: boolean;
  /** days remaining until next survey is allowed (0 if allowed) */
  daysUntilNextSurvey: number;
  /** loading state */
  isLoading: boolean;
}

/**
 * Client-side check for the 60-day survey budget.
 * This is a UX optimization — server-side enforcement is in record_nps_response RPC.
 */
export function useSurveyBudget(): SurveyBudgetResult {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["survey-budget", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("last_survey_completed_at")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (!profile) return null;
      return (profile as any).last_survey_completed_at as string | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading || !user || isError) {
    return { canShowSurvey: false, daysUntilNextSurvey: SURVEY_COOLDOWN_DAYS, isLoading };
  }

  // Never completed a survey → allowed
  if (data === null || data === undefined) {
    return { canShowSurvey: true, daysUntilNextSurvey: 0, isLoading: false };
  }

  const lastCompleted = new Date(data);
  const now = new Date();
  const diffMs = now.getTime() - lastCompleted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, SURVEY_COOLDOWN_DAYS - diffDays);

  return {
    canShowSurvey: diffDays >= SURVEY_COOLDOWN_DAYS,
    daysUntilNextSurvey: daysRemaining,
    isLoading: false,
  };
}
