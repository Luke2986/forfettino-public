import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUserBreakdownEntry {
  actionType: string;
  totalPoints: number;
  actionCount: number;
}

export function useAdminUserBreakdown(userId: string, enabled: boolean) {
  return useQuery<AdminUserBreakdownEntry[]>({
    queryKey: ["admin-user-breakdown", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_admin_user_contribution_breakdown" as any,
        { p_user_id: userId },
      );
      if (error) throw error;
      return ((data as any[]) ?? []).map((row: any) => ({
        actionType: row.action_type,
        totalPoints: Number(row.total_points),
        actionCount: Number(row.action_count),
      }));
    },
    enabled,
    staleTime: 60_000,
  });
}
