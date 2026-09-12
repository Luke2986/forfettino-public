import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeedbackDistribution {
  yes: number;
  no: number;
  dismissed: number;
  total: number;
}

export interface ReasonDistribution {
  no_money: number;
  forgot: number;
  unclear_amount: number;
  other: number;
}

export interface AdminFeedbackStats {
  distribution: FeedbackDistribution;
  reasons: ReasonDistribution;
}

/**
 * Hook per le statistiche feedback post-scadenza nell'admin (Story 25.5, AC #7).
 *
 * Query diretta su deadline_feedback con RLS admin (service_role o is_admin check).
 * @param days — filtro temporale: 30, 90, o null per tutti
 */
export function useAdminFeedbackStats(days: number | null = 30) {
  return useQuery({
    queryKey: ["admin", "feedback-stats", days],
    queryFn: async () => {
      let query = supabase
        .from("deadline_feedback" as any)
        .select("response, reason, created_at");

      if (days !== null) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte("created_at", since.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        response: string;
        reason: string | null;
        created_at: string;
      }>;

      const distribution: FeedbackDistribution = {
        yes: 0,
        no: 0,
        dismissed: 0,
        total: rows.length,
      };

      const reasons: ReasonDistribution = {
        no_money: 0,
        forgot: 0,
        unclear_amount: 0,
        other: 0,
      };

      for (const row of rows) {
        if (row.response === "yes") distribution.yes++;
        else if (row.response === "no") distribution.no++;
        else if (row.response === "dismissed") distribution.dismissed++;

        if (row.response === "no" && row.reason) {
          const r = row.reason as keyof ReasonDistribution;
          if (r in reasons) reasons[r]++;
        }
      }

      return { distribution, reasons } satisfies AdminFeedbackStats;
    },
    staleTime: 60_000,
  });
}
