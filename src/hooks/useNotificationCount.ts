import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Hook per ottenere il conteggio delle notifiche non lette.
 * staleTime: 30s (ADR-2 — badge deve essere fresco)
 * refetchOnWindowFocus: true
 *
 * QueryKey pattern: ["notifications", "count", userId]
 * La key ["notifications", userId] (senza "count") è usata da useNotifications.
 * Il segmento "count" evita collisioni nel prefix matching di React Query.
 * Le mutation invalidano esplicitamente entrambe le key.
 */
export function useNotificationCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", "count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null)
        .eq("delivery_channel", "sidebar");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
