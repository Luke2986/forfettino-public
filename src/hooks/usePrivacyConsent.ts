import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from "@/lib/legal-versions";
import { PRIVACY_SIGNUP_FLAG } from "@/pages/Auth";

/**
 * Hook per verificare e gestire il consenso Privacy/ToS (Story 35.2, GDPR Art. 7).
 *
 * - needsConsent: true se l'utente non ha mai accettato o la versione è cambiata
 * - isFirstTime: true se privacy_policy_accepted_at è null (mai accettato)
 * - acceptConsent(): salva timestamp + versione corrente su profiles
 */
export function usePrivacyConsent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: consentData, isLoading } = useQuery({
    queryKey: ["privacy-consent", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("privacy_policy_accepted_at, privacy_policy_version, tos_accepted_at, tos_version")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const isFirstTime = consentData?.privacy_policy_accepted_at == null;

  // Story 35.3: check localStorage flag from signup — suppress modal while auto-accepting
  const hasSignupFlag =
    typeof window !== "undefined" &&
    localStorage.getItem(PRIVACY_SIGNUP_FLAG) === "true";

  // Story 35.3: auto-accept ref prevents modal flash during mutation
  const autoAcceptedRef = useRef(false);

  const needsConsent =
    !hasSignupFlag &&
    !autoAcceptedRef.current &&
    (!consentData ||
      consentData.privacy_policy_accepted_at == null ||
      consentData.privacy_policy_version !== CURRENT_PRIVACY_VERSION ||
      consentData.tos_version !== CURRENT_TOS_VERSION);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .update({
          privacy_policy_accepted_at: now,
          privacy_policy_version: CURRENT_PRIVACY_VERSION,
          tos_accepted_at: now,
          tos_version: CURRENT_TOS_VERSION,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any) // Supabase auto-generated types non includono ancora i campi consent (migration 35-1)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy-consent", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => {
      toast.error("Errore nel salvataggio del consenso. Riprova.");
    },
  });

  // Story 35.3: auto-accept consent from signup flag (email-confirm returnees)
  // localStorage is removed only on success — if mutation fails, flag remains
  // so BlockingModal (35.2) can act as safety net on next session.
  useEffect(() => {
    if (autoAcceptedRef.current || !user || isLoading || mutation.isPending) return;
    if (hasSignupFlag && consentData?.privacy_policy_accepted_at == null) {
      autoAcceptedRef.current = true;
      mutation.mutate(undefined, {
        onSuccess: () => {
          localStorage.removeItem(PRIVACY_SIGNUP_FLAG);
        },
        onError: () => {
          // Reset ref so next render can retry (e.g., after network recovery)
          autoAcceptedRef.current = false;
        },
      });
    }
  }, [user, isLoading, hasSignupFlag, consentData, mutation]);

  return {
    needsConsent: isLoading ? false : needsConsent,
    isFirstTime,
    acceptConsent: () => mutation.mutate(),
    isLoading,
    isPending: mutation.isPending,
  };
}
