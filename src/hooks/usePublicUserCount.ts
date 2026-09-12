import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePublicUserCount() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-user-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_public_user_count" as any,
      );
      if (error) throw error;
      return data as number;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { count: data ?? null, isLoading };
}
