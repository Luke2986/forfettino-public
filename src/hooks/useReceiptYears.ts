/**
 * Hook che restituisce gli anni fiscali con almeno un incasso registrato.
 * Usato da ReportClienti per mostrare solo tab con dati reali.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useReceiptYears() {
  const { user } = useAuth();

  return useQuery<number[]>({
    queryKey: ["receipt-years", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("fiscal_year")
        .eq("user_id", user!.id);
      if (error) throw error;
      const years = [...new Set((data ?? []).map((r) => r.fiscal_year))];
      years.sort((a, b) => a - b);
      return years;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
