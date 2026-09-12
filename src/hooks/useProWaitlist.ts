import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/** Testo di consenso mostrato all'utente — salvato immutabile nel DB */
export const PRO_WAITLIST_CONSENT_TEXT =
  "Acconsento a ricevere una notifica via email quando la versione Pro di Forfettino sarà disponibile. " +
  "Posso revocare il consenso in qualsiasi momento dalle Impostazioni > Privacy e dati.";

export function useProWaitlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pro-waitlist", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("pro_waitlist")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: async (referredByToken?: string) => {
      if (!user?.email) throw new Error("Email non disponibile");
      const { error } = await supabase.from("pro_waitlist").insert({
        user_id: user.id,
        email: user.email,
        consent_text: PRO_WAITLIST_CONSENT_TEXT,
        ...(referredByToken ? { referred_by_token: referredByToken } : {}),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pro-waitlist"] }),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { error } = await supabase
        .from("pro_waitlist")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pro-waitlist"] }),
  });

  const rejoinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Email non disponibile");
      const { error } = await supabase
        .from("pro_waitlist")
        .update({
          revoked_at: null,
          email: user.email,
          consent_text: PRO_WAITLIST_CONSENT_TEXT,
          consent_given_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pro-waitlist"] }),
  });

  const isJoined = !!query.data && !query.data.revoked_at;
  const wasRevoked = !!query.data?.revoked_at;

  return {
    data: query.data,
    isLoading: query.isLoading,
    isJoined,
    wasRevoked,
    join: joinMutation,
    revoke: revokeMutation,
    rejoin: rejoinMutation,
  };
}
