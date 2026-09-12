import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Milestone, mapRpcToMilestone, UserMilestoneClaim } from "@/lib/contribution-helpers";

/**
 * Fetch active milestones (public — available to all authenticated users).
 */
export function useMilestones() {
  return useQuery<Milestone[]>({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_milestones" as any,
      );
      if (error) throw error;
      if (!data || !Array.isArray(data)) return [];
      return (data as any[]).map(mapRpcToMilestone);
    },
    staleTime: 5 * 60_000, // 5 minutes — milestones rarely change
  });
}

/**
 * Fetch current user's milestone claims (which milestones they've reached/claimed).
 */
export function useMyMilestoneClaims() {
  return useQuery<UserMilestoneClaim[]>({
    queryKey: ["my-milestone-claims"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_milestone_claims" as any)
        .select("milestone_id, reached_at, reward_claimed")
        .eq("user_id", user.id);
      if (error) throw error;
      if (!data || !Array.isArray(data)) return [];
      return (data as any[]).map((row) => ({
        milestoneId: row.milestone_id,
        reachedAt: row.reached_at,
        rewardClaimed: row.reward_claimed,
      }));
    },
    staleTime: 2 * 60_000,
  });
}
