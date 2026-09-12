import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResponse {
  success: boolean;
  results: Array<{
    email: string;
    status: "sent" | "skipped" | "error";
    id?: string;
    error?: string;
  }>;
  summary: {
    sent: number;
    skipped: number;
    errors: number;
  };
}

export function useSendEmail() {
  return useMutation({
    mutationFn: async (payload: SendEmailPayload) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: payload,
      });
      if (error) throw error;
      return data as SendEmailResponse;
    },
    onSuccess: (data) => {
      const { sent, skipped, errors } = data.summary;
      if (sent === 0 && errors === 0) {
        toast.error("Nessun destinatario con consenso email trovato");
      } else {
        const parts: string[] = [];
        if (skipped > 0) parts.push(`${skipped} saltate (senza consenso)`);
        if (errors > 0) parts.push(`${errors} errori`);
        toast.success(
          `Email inviata a ${sent} utenti${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`,
        );
      }
    },
    onError: (error: Error) => {
      toast.error("Errore nell'invio email", {
        description: error.message,
      });
    },
  });
}
