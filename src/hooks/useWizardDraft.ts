import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WizardDraft {
  currentStepIndex: number;
  visibleSteps: string[];
  data: Record<string, unknown>;
  updatedAt: string;
}

const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

export function useWizardDraft() {
  const queryClient = useQueryClient();

  const query = useQuery<WizardDraft | null>({
    queryKey: ["wizard-draft"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("wizard_drafts" as any)
        .select("current_step_index, visible_steps, data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Check scadenza 30gg — updated_at è TIMESTAMPTZ, new Date() lo parsa correttamente
      const updatedAt = new Date((data as any).updated_at);
      if (Date.now() - updatedAt.getTime() > DRAFT_MAX_AGE_MS) {
        // Draft scaduto — delete in background
        supabase
          .from("wizard_drafts" as any)
          .delete()
          .eq("user_id", user.id)
          .then(() => {});
        return null;
      }

      return {
        currentStepIndex: (data as any).current_step_index as number,
        visibleSteps: (data as any).visible_steps as string[],
        data: (data as any).data as Record<string, unknown>,
        updatedAt: (data as any).updated_at as string,
      };
    },
    staleTime: Infinity,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      wizardData,
      stepIndex,
      visibleSteps,
    }: {
      wizardData: Record<string, unknown>;
      stepIndex: number;
      visibleSteps: string[];
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("wizard_drafts" as any).upsert(
        {
          user_id: user.id,
          current_step_index: stepIndex,
          visible_steps: visibleSteps,
          data: wizardData,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("wizard_drafts" as any)
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wizard-draft"] });
    },
  });

  return {
    draft: query.data ?? null,
    isLoading: query.isLoading,
    saveDraft: saveMutation.mutate,
    clearDraft: () => clearMutation.mutateAsync(),
  };
}
