import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapRpcToActionConfig, type ActionConfig } from "@/lib/contribution-helpers";

/**
 * Fetch active action configs from DB (public, cached 5min).
 */
export function useActionConfig() {
  return useQuery<ActionConfig[]>({
    queryKey: ["action-config"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_action_config" as any);
      if (error) throw error;
      return ((data as any[]) ?? []).map(mapRpcToActionConfig);
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Admin mutation: update an action's points and labels.
 */
export function useAdminUpdateActionConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionType,
      points,
      label,
      frequencyLabel,
    }: {
      actionType: string;
      points: number;
      label: string;
      frequencyLabel: string;
    }) => {
      const { error } = await supabase.rpc(
        "admin_update_action_config" as any,
        {
          p_action_type: actionType,
          p_points: points,
          p_label: label,
          p_frequency_label: frequencyLabel,
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-config"] });
    },
  });
}
