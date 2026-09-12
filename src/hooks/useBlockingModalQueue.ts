import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Hook per gestire la coda FIFO dei pop-up modali bloccanti (Story 25.2).
 *
 * Query: notifiche con delivery_channel='popup' AND dismissed_at IS NULL,
 * ordinate per created_at ASC (FIFO — la più vecchia prima).
 *
 * dismissCurrent(): aggiorna dismissed_at = now() → invalida query → next in queue.
 *
 * isAppReady: se false, currentPopup è sempre null (timing post-load).
 *
 * QueryKey: ["notifications", "popup-queue", userId]
 */
export function useBlockingModalQueue({ isAppReady = true }: { isAppReady?: boolean } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: popupQueue } = useQuery({
    queryKey: ["notifications", "popup-queue", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("delivery_channel", "popup")
        .is("dismissed_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && isAppReady,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", "popup-queue", user?.id],
      });
    },
  });

  return {
    currentPopup: isAppReady ? (popupQueue?.[0] ?? null) : null,
    dismissCurrent: () => {
      if (popupQueue?.[0]) {
        dismissMutation.mutate(popupQueue[0].id);
      }
    },
    queueLength: popupQueue?.length ?? 0,
  };
}
