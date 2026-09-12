import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NpsCampaign {
  id: string;
  is_active: boolean;
  enabled_triggers: string[] | null;
  repeat_interval: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface NpsEligibilityResult {
  /** The currently active NPS campaign, or null if none */
  activeCampaign: NpsCampaign | null;
  /** Whether the user has already responded to the current campaign */
  hasRespondedCurrentCampaign: boolean;
  /** Which triggers are enabled for the active campaign (empty = all) */
  enabledTriggers: string[];
  /** Loading state */
  isLoading: boolean;
}

/**
 * Check if there's an active NPS campaign and whether the user has already responded.
 * Uses long staleTime (10min) since campaigns change rarely.
 */
export function useNpsEligibility(): NpsEligibilityResult {
  const { user } = useAuth();

  // Query active campaign
  const campaignQuery = useQuery<NpsCampaign | null>({
    queryKey: ["nps-active-campaign"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("nps_campaigns")
        .select("*")
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as NpsCampaign;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const activeCampaign = campaignQuery.data ?? null;

  // Query whether user already responded to this campaign (with repeat logic)
  const responseQuery = useQuery<boolean>({
    queryKey: ["nps-responded", activeCampaign?.id, activeCampaign?.repeat_interval],
    queryFn: async () => {
      if (!activeCampaign || !user) return false;
      const { data, error } = await (supabase as any)
        .from("survey_responses")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("survey_key", "nps_v1")
        .eq("campaign_id", activeCampaign.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return false;

      // User has responded — check repeat_interval
      const repeatInterval = activeCampaign.repeat_interval;
      if (repeatInterval === "never") return true;

      const repeatMonths: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12 };
      const months = repeatMonths[repeatInterval];
      if (!months) return true;

      const lastResponseDate = new Date(data[0].created_at);
      const threshold = new Date(lastResponseDate);
      threshold.setMonth(threshold.getMonth() + months);

      // If threshold is still in the future, user is still blocked
      return new Date() < threshold;
    },
    enabled: !!user && !!activeCampaign,
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = campaignQuery.isLoading || (!!activeCampaign && responseQuery.isLoading);

  const enabledTriggers = activeCampaign?.enabled_triggers ?? [];

  return {
    activeCampaign,
    hasRespondedCurrentCampaign: responseQuery.data ?? false,
    enabledTriggers: Array.isArray(enabledTriggers) ? enabledTriggers : [],
    isLoading,
  };
}
