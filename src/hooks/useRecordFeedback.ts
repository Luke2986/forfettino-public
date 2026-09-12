import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if points were actually awarded, false if skipped (cooldown/inactive).
 */
export function useRecordFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc(
        "record_feedback_contribution" as any,
      );
      if (error) throw error;
      return data === true;
    },
    onSuccess: (awarded) => {
      if (awarded) {
        queryClient.invalidateQueries({ queryKey: ["my-contributions"] });
      }
    },
    onError: (err) => {
      console.error("[useRecordFeedback] RPC failed:", err);
    },
  });
}
