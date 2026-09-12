import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface SubmitFeedbackParams {
  scheduleEventId: string;
  notificationId: string;
  response: "yes" | "no" | "dismissed";
  reason?: "no_money" | "forgot" | "unclear_amount" | "other" | null;
  freeText?: string | null;
}

/**
 * Hook per salvare il feedback post-scadenza (Story 25.5).
 *
 * INSERT in deadline_feedback (risposta utente).
 * Il dismiss della notifica popup (dismissed_at) è gestito da dismissCurrent()
 * in useBlockingModalQueue — separazione responsabilità.
 *
 * Invalida la popup-queue in onSuccess per consistenza cache.
 */
export function useDeadlineFeedback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitFeedbackParams) => {
      const { error: feedbackError } = await supabase
        .from("deadline_feedback" as any)
        .insert({
          user_id: user!.id,
          schedule_event_id: params.scheduleEventId,
          response: params.response,
          reason: params.reason ?? null,
          free_text: params.freeText?.slice(0, 200) ?? null,
        });

      if (feedbackError) throw feedbackError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", "popup-queue", user?.id],
      });
    },
  });
}
