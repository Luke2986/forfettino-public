import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NpsCampaign } from "@/hooks/useNpsEligibility";

/**
 * Admin hook: fetch and update the active NPS campaign configuration.
 * Uses direct Supabase queries — RLS grants ALL to admin on nps_campaigns.
 */
export function useNpsCampaignConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<NpsCampaign | null>({
    queryKey: ["nps-campaign-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("nps_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as NpsCampaign;
    },
    staleTime: 30_000, // 30s — admin may reload to verify
  });

  const mutation = useMutation({
    mutationFn: async (payload: Partial<NpsCampaign> & { id: string }) => {
      const { id, ...fields } = payload;
      const { error } = await (supabase as any)
        .from("nps_campaigns")
        .update(fields)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-campaign-config"] });
      // Also invalidate user-facing campaign cache so changes propagate
      queryClient.invalidateQueries({ queryKey: ["nps-active-campaign"] });
    },
  });

  return {
    campaign: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    updateCampaign: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
