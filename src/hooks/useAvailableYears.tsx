import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

const currentCalendarYear = new Date().getFullYear();
const FREE_YEARS = [currentCalendarYear - 1, currentCalendarYear, currentCalendarYear + 1];

export function useAvailableYears() {
  const { user } = useAuth();
  const { isPro } = useSubscription();

  const { data: dbYears, isLoading } = useQuery({
    queryKey: ["available_years", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("fiscal_year")
        .eq("user_id", user.id);
      if (error) throw error;
      return [...new Set((data || []).map((d) => d.fiscal_year))].sort(
        (a, b) => a - b
      );
    },
    enabled: !!user && isPro,
    staleTime: 5 * 60 * 1000,
  });

  // useMemo: stabilizza la referenza dell'array per evitare re-render a cascata
  // (dbYears è referenzialmente stabile grazie a React Query)
  const availableYears = useMemo(() => {
    if (!isPro) return FREE_YEARS;
    if (isLoading || !dbYears) return FREE_YEARS;

    const merged = [
      ...new Set([...dbYears, currentCalendarYear, currentCalendarYear + 1]),
    ];
    merged.sort((a, b) => a - b);
    return merged.length > 0 ? merged : FREE_YEARS;
  }, [isPro, isLoading, dbYears]);

  return {
    availableYears,
    isLoading: !isPro ? false : isLoading,
  };
}
