import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminLeaderboardEntry {
  rank: number;
  userId: string;
  userCode: string;
  firstName: string | null;
  totalPts: number;
}

export function useAdminLeaderboard(limit = 50, includeInternal = false) {
  return useQuery<AdminLeaderboardEntry[]>({
    queryKey: ["admin-leaderboard", limit, includeInternal],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_admin_leaderboard" as any,
        { p_limit: limit, p_include_internal: includeInternal },
      );
      if (error) throw error;
      return ((data as any[]) ?? []).map((row: any) => ({
        rank: Number(row.rank),
        userId: row.user_id,
        userCode: row.user_code ?? "",
        firstName: row.first_name ?? null,
        totalPts: Number(row.total_pts),
      }));
    },
    staleTime: 60_000,
  });
}
