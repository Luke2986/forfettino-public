import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Hook per ottenere la lista notifiche dell'utente corrente.
 * Ordinate per created_at DESC, limite 50.
 * staleTime: 60s (ADR-2 — lista in dropdown)
 */
export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("delivery_channel", "sidebar")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
