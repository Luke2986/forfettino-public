import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Formatta il conteggio waitlist per social proof.
 * - count < 10 → null (il componente mostra testo generico)
 * - count 10-99 → arrotonda al multiplo di 10 (floor) + "+"
 * - count >= 100 → arrotonda al multiplo di 25 (floor) + "+"
 */
export function formatWaitlistCount(count: number): string | null {
  if (count < 10) return null;
  const step = count < 100 ? 10 : 25;
  return `${Math.floor(count / step) * step}+`;
}

export function useWaitlistCount() {
  const query = useQuery({
    queryKey: ["waitlist-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_active_count" as any);
      if (error) throw error;
      return data as number;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return {
    count: query.data ?? null,
    isLoading: query.isLoading,
  };
}
