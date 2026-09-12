import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const PREFETCH_STALE_TIME = 5 * 60 * 1000; // 5 min

export function usePrefetchAdjacentYears(
  selectedYear: number,
  availableYears: number[]
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || availableYears.length === 0) return;

    const adjacentYears = [selectedYear - 1, selectedYear + 1].filter(
      (y) => availableYears.includes(y) && y !== selectedYear
    );

    for (const year of adjacentYears) {
      // Prefetch fiscal_year_settings — maybeSingle: anno senza settings non è errore
      queryClient.prefetchQuery({
        queryKey: ["fiscal_year_settings", user.id, year],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("fiscal_year_settings")
            .select("*")
            .eq("user_id", user.id)
            .eq("fiscal_year", year)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        staleTime: PREFETCH_STALE_TIME,
      });

      // Prefetch receipts
      queryClient.prefetchQuery({
        queryKey: ["receipts_ytd", user.id, year],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("receipts")
            .select("*")
            .eq("user_id", user.id)
            .eq("fiscal_year", year);
          if (error) throw error;
          return data || [];
        },
        staleTime: PREFETCH_STALE_TIME,
      });

      // Prefetch fiscalRules — maybeSingle: anno senza regole non è errore
      queryClient.prefetchQuery({
        queryKey: ["fiscalRules", year],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("fiscal_rules")
            .select("*")
            .eq("fiscal_year", year)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        staleTime: PREFETCH_STALE_TIME,
      });

      // Prefetch current_year_schedules
      queryClient.prefetchQuery({
        queryKey: ["current_year_schedules", user.id, year],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("tax_schedule")
            .select("*")
            .eq("user_id", user.id)
            .eq("payment_year", year)
            .order("due_date");
          if (error) throw error;
          return data || [];
        },
        staleTime: PREFETCH_STALE_TIME,
      });
    }
  }, [selectedYear, availableYears, user?.id, queryClient]);
}
