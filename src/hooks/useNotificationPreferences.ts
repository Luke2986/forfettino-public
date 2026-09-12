import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type NotificationCategory = "scadenze" | "insights" | "aggiornamenti";

export interface NotificationPreferences {
  scadenze: boolean;
  insights: boolean;
  aggiornamenti: boolean;
}

/**
 * Default quando non esistono righe in DB per l'utente (lazy creation).
 * Tutte le categorie attive per default (opt-out model).
 *
 * IMPORTANT: Deve restare allineato con CATEGORY_DEFAULTS in
 * supabase/functions/generate-deadline-notifications/index.ts — se cambi qui, cambia anche lì.
 */
export const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  scadenze: true,
  insights: true,
  aggiornamenti: true,
};

/**
 * Hook per ottenere le preferenze notifiche dell'utente corrente.
 * Se nessuna riga in DB, restituisce i default.
 * Tutte le categorie (scadenze, insights, aggiornamenti) sono modificabili dall'utente.
 *
 * QueryKey: ["notification_preferences", userId]
 * staleTime: 5min (ADR-2 — preferenze cambiano raramente)
 */
export function useNotificationPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notification_preferences", user?.id],
    queryFn: async () => {
      if (!user) return { ...NOTIFICATION_DEFAULTS };
      const { data, error } = await supabase
        .from("notification_preferences" as any)
        .select("category, enabled")
        .eq("user_id", user.id);
      if (error) throw error;

      const prefs: NotificationPreferences = { ...NOTIFICATION_DEFAULTS };
      for (const row of (data ?? []) as unknown as Array<{ category: string; enabled: boolean }>) {
        if (row.category in prefs) {
          (prefs as unknown as Record<string, boolean>)[row.category] = row.enabled;
        }
      }
      return prefs;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
