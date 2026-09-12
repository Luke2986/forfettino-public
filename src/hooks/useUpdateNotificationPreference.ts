import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import type { NotificationCategory, NotificationPreferences } from "./useNotificationPreferences";

interface UpdatePreferenceParams {
  category: NotificationCategory;
  enabled: boolean;
}

/**
 * Mutation per aggiornare (upsert) una singola preferenza notifica.
 * Usa ON CONFLICT (user_id, category) DO UPDATE per gestire sia insert che update.
 * Optimistic update: aggiorna la cache immediatamente, rollback on error.
 * Invalida la query ["notification_preferences", userId] on success per risync.
 */
export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ category, enabled }: UpdatePreferenceParams) => {
      if (!user) throw new Error("Utente non autenticato");

      const { data, error } = await supabase
        .from("notification_preferences" as any)
        .upsert(
          { user_id: user.id, category, enabled },
          { onConflict: "user_id,category" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ category, enabled }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      const queryKey = ["notification_preferences", user?.id];
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey);

      // Optimistic update
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(queryKey, {
          ...previous,
          [category]: enabled,
        });
      }

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_preferences", user?.id] });
      toast({ title: "Preferenze aggiornate" });
    },
    onError: (_err, _vars, context) => {
      // Rollback to previous value
      if (context?.previous) {
        queryClient.setQueryData(
          ["notification_preferences", user?.id],
          context.previous,
        );
      }
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    },
  });
}
