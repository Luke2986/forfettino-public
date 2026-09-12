import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useActiveUserCount() {
  return useQuery({
    queryKey: ["active-user-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .or("is_internal.is.null,is_internal.eq.false");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}
