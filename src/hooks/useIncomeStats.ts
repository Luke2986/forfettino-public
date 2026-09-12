import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

export interface IncomeStats {
  count_total: number;
  count_year: number;
  last_income_at: string | null;
  first_income_at: string | null;
  total_year_amount: number;
}

const EMPTY_STATS: IncomeStats = {
  count_total: 0,
  count_year: 0,
  last_income_at: null,
  first_income_at: null,
  total_year_amount: 0,
};

export function useIncomeStats(yearOverride?: number) {
  const { user } = useAuth();
  const { selectedYear } = useFiscalYear();
  const currentYear = yearOverride ?? selectedYear;

  return useQuery<IncomeStats>({
    queryKey: ["income_stats", user?.id, currentYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_income_stats", {
        p_year: currentYear,
      });

      if (error) throw error;

      // The RPC returns JSON — Supabase client parses it automatically
      if (!data) return EMPTY_STATS;

      // data comes as the parsed JSON object
      const d = data as unknown as IncomeStats;
      return {
        count_total: Number(d.count_total) || 0,
        count_year: Number(d.count_year) || 0,
        last_income_at: d.last_income_at ?? null,
        first_income_at: d.first_income_at ?? null,
        total_year_amount: Number(d.total_year_amount) || 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000, // 30 seconds — re-fetched on query invalidation anyway
  });
}
