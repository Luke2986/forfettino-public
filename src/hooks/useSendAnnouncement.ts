import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SendAnnouncementPayload {
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  target_audience: "all" | "pro" | "free";
  // Story 25.6: Individual message fields
  target_type?: "broadcast" | "individual";
  target_user_id?: string;
  delivery_type?: "sidebar" | "popup";
}

interface SendAnnouncementResponse {
  announcement_id: string;
  sent_count: number;
  message?: string;
  suppressed?: boolean;
}

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: SendAnnouncementPayload) => {
      const { data, error } = await supabase.functions.invoke(
        "send-admin-announcement",
        { body: payload },
      );
      if (error) throw error;
      return data as SendAnnouncementResponse;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });

      if (variables.target_type === "individual" && variables.target_user_id) {
        // Invalidate user message history for refresh
        queryClient.invalidateQueries({ queryKey: ["admin-user-messages", variables.target_user_id] });

        if (data.suppressed) {
          toast({
            title: "Messaggio tracciato (soppresso)",
            description: "L'utente ha disattivato i messaggi admin nelle preferenze",
          });
        } else {
          toast({ title: "Messaggio inviato" });
        }
      } else {
        // Broadcast toast (unchanged)
        if (data.sent_count === 0) {
          toast({
            title: "Nessun destinatario",
            description: data.message || "Nessun utente ha attivato le notifiche di aggiornamenti",
            variant: "destructive",
          });
        } else {
          toast({
            title: `Annuncio inviato a ${data.sent_count} utenti`,
          });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nell'invio dell'annuncio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
