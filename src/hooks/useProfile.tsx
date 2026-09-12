import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  onboarding_completed: boolean;
  user_code: string;
  created_at: string;
  updated_at: string;
  // GDPR consent fields (Story 35-2, 35-4)
  privacy_policy_accepted_at: string | null;
  privacy_policy_version: string | null;
  tos_accepted_at: string | null;
  tos_version: string | null;
  analytics_consent: boolean;
  analytics_consent_at: string | null;
  marketing_email_consent: boolean;
  marketing_email_consent_at: string | null;
  // Story 14.4: Feedback email consent (GDPR Art. 6.1.a — surveys/service improvement)
  feedback_email_consent: boolean;
  feedback_email_consent_at: string | null;
  // Story 36.2: Partita IVA (campo anagrafico, non usato nei calcoli)
  partita_iva: string | null;
  // Story 42.1: Allocazione budget netto spendibile (JSONB con percentuali per categoria)
  budget_allocation: Record<string, number> | null;
  // Story 56.1: Admin override tier (PRO/beta_tester senza Stripe)
  admin_override_tier: 'pro' | 'beta_tester' | null;
  // Story 67.1: Ultima verifica OTP smart (null = mai verificato → richiedi OTP)
  last_otp_verified_at: string | null;
  // Epic 24: utente interno (staff/test) — escluso da metriche e sincronizzato
  // come person property PostHog per il filtro test-account (audit 2026-06-21)
  is_internal: boolean;
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Guard rail: profilo mancante per utente con dati storici (stato zombie
      // da delete-account parziale). Auto-bootstrap profilo minimo per evitare
      // redirect al wizard per utenti già attivi.
      if (!data) {
        const hasLegacyData = await checkLegacyData(user.id);
        if (hasLegacyData) {
          const { data: restored, error: restoreError } = await supabase
            .from("profiles")
            .upsert(
              [{ user_id: user.id, first_name: "Utente", onboarding_completed: true, user_code: "AUTO" }],
              { onConflict: "user_id" }
            )
            .select()
            .single();
          if (!restoreError && restored) {
            console.warn("[useProfile] Auto-bootstrapped orphan profile for user", user.id);
            return restored as Profile;
          }
        }
      }

      return data as Profile | null;
    },
    enabled: !!user,
    retry: 1, // Limita i retry per evitare loading infinito su profili mancanti
  });
}

/** Verifica se l'utente ha dati storici in almeno una tabella (indica utente attivo) */
async function checkLegacyData(userId: string): Promise<boolean> {
  const tables = ["fiscal_year_settings", "receipts", "clients", "tax_schedule"] as const;
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (count && count > 0) return true;
  }
  return false;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
