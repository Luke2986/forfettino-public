import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * Mutation per segnare una singola notifica come letta.
 * Imposta read_at = now() e invalida le query notifications.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      trackAnonymous(ANALYTICS_EVENTS.NOTIFICA_LETTA);
      queryClient.invalidateQueries({ queryKey: ["notifications", "count", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
}
