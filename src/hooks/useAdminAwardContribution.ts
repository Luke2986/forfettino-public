import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AwardContributionParams {
  userCode?: string;
  actionType: string;
  points?: number;
  reason?: string;
  allUsers: boolean;
}

export function useAdminAwardContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AwardContributionParams) => {
      const { data, error } = await supabase.rpc(
        "admin_award_contribution" as any,
        {
          p_user_code: params.userCode ?? null,
          p_action_type: params.actionType,
          p_points: params.points ?? null,
          p_reason: params.reason ?? null,
          p_all_users: params.allUsers,
        },
      );
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] });
    },
  });
}
