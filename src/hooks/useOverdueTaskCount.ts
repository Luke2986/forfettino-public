import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useOverdueTaskCount(isAdmin: boolean) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["user_tasks_overdue_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const today = new Date();
      const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const { count, error } = await (supabase as any)
        .from("user_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "completato")
        .lte("due_date", todayISO);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user && isAdmin,
  });

  return { overdueCount: query.data ?? 0, isLoading: query.isLoading };
}
