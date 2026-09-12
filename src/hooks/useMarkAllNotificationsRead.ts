import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Mutation per segnare TUTTE le notifiche non lette come lette.
 * Imposta read_at = now() su tutte le notifiche con read_at IS NULL
 * e invalida le query notifications.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null)
        .eq("delivery_channel", "sidebar")
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "count", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
}
