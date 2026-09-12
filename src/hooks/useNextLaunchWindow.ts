import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNextLaunchWindow() {
  const query = useQuery({
    queryKey: ["next-launch-window"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_next_launch_window_date" as any);
      if (error) throw error;
      return data ? new Date(data as unknown as string) : null;
    },
    staleTime: 5 * 60_000,
  });

  return {
    startsAt: query.data ?? null,
    isLoading: query.isLoading,
  };
}
