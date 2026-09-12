import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

// ── Types ──

export type Tone = "rassicurante" | "neutro" | "minimalista";

export interface NotificationSettings {
  master_enabled: boolean;
  tone: Tone;
  has_accountant: boolean;
  scadenze_enabled: boolean;
  /** Story 84-7: canale email dei promemoria scadenze (servizio, GDPR 6.1.b). Distinto da scadenze_enabled (tipo, governa anche l'in-app). */
  scadenze_email_enabled: boolean;
  /** Story 84-10: soglie (giorni-prima) del canale email scadenze. Sottoinsieme NON vuoto di [30,7,3,0] (Decisione B). */
  reminder_thresholds: number[];
  feedback_enabled: boolean;
  insights_enabled: boolean;
  admin_messages_enabled: boolean;
  aggiornamenti_enabled: boolean;
}

export const NOTIFICATION_SETTINGS_DEFAULTS: NotificationSettings = {
  master_enabled: true,
  tone: "neutro",
  has_accountant: false,
  scadenze_enabled: true,
  scadenze_email_enabled: true,
  reminder_thresholds: [30, 7, 3, 0],
  feedback_enabled: true,
  insights_enabled: true,
  admin_messages_enabled: true,
  aggiornamenti_enabled: true,
};

// ── Pure helper ──

/**
 * Derives default notification tone from P.IVA seniority.
 * 0-2 years → rassicurante, 3-5 → neutro, 6+ → minimalista, null → neutro.
 */
export function deriveToneFromSeniority(
  annoAperturaPiva: number | null,
  currentYear: number,
): Tone {
  if (annoAperturaPiva == null) return "neutro";
  const seniority = currentYear - annoAperturaPiva;
  if (seniority <= 2) return "rassicurante";
  if (seniority <= 5) return "neutro";
  return "minimalista";
}

// ── Internal helper ──

async function calculateDefaultTone(userId: string): Promise<Tone> {
  const currentYear = new Date().getFullYear();
  const { data } = await supabase
    .from("fiscal_year_settings")
    .select("anno_apertura_piva")
    .eq("user_id", userId)
    .eq("fiscal_year", currentYear)
    .maybeSingle();
  return deriveToneFromSeniority(
    (data as { anno_apertura_piva: number | null } | null)?.anno_apertura_piva ?? null,
    currentYear,
  );
}

// ── Hook ──

/**
 * Hook for expanded notification settings (Story 25.3).
 * Reads from `user_notification_settings` table (1 row per user).
 * If no row exists, returns defaults with tone derived from P.IVA seniority.
 *
 * QueryKey: ["user_notification_settings", userId]
 * staleTime: 5min (preferences change rarely)
 */
export function useNotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["user_notification_settings", user?.id];

  const { data: settings, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notification_settings" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as NotificationSettings;
      // No row yet — return defaults with calculated tone
      const tone = await calculateDefaultTone(user!.id);
      return { ...NOTIFICATION_SETTINGS_DEFAULTS, tone };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      // Send ALL current settings on upsert so that INSERT path gets correct
      // values instead of DB column defaults (which could silently opt users out).
      const current = queryClient.getQueryData<NotificationSettings>(queryKey);
      const base = current ?? NOTIFICATION_SETTINGS_DEFAULTS;
      const fullRow = {
        user_id: user!.id,
        master_enabled: base.master_enabled,
        tone: base.tone,
        has_accountant: base.has_accountant,
        scadenze_enabled: base.scadenze_enabled,
        scadenze_email_enabled: base.scadenze_email_enabled,
        reminder_thresholds: base.reminder_thresholds,
        feedback_enabled: base.feedback_enabled,
        insights_enabled: base.insights_enabled,
        admin_messages_enabled: base.admin_messages_enabled,
        aggiornamenti_enabled: base.aggiornamenti_enabled,
        [key]: value,
      };
      const { error } = await (supabase
        .from("user_notification_settings" as any) as any)
        .upsert(fullRow, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationSettings>(queryKey);
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(queryKey, {
          ...previous,
          [key]: value,
        } as NotificationSettings);
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    },
  });

  return {
    settings: settings ?? null,
    isLoading,
    updateSetting: (key: string, value: unknown) =>
      updateMutation.mutate({ key, value }),
    isUpdating: updateMutation.isPending,
  };
}
