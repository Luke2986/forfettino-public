import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

interface UseUnmarkAsPaidOptions {
  onSuccess?: () => void;
}

/**
 * Annulla l'azione "segna come pagata" di una scadenza fiscale.
 *
 * Passa dalla RPC `unmark_tax_schedule_paid` (SECURITY DEFINER) e NON da una
 * DELETE diretta: il trigger `update_tax_schedule_on_payment` esiste solo su
 * AFTER INSERT/UPDATE di `payments` (nessun AFTER DELETE), quindi una DELETE
 * lato client lascerebbe `tax_schedule.total_paid`/`status` non ricalcolati.
 * La RPC cancella i payment e ricalcola la schedule in modo atomico.
 *
 * Invalida le stesse query di `useMarkAsPaid` + `current_year_schedules`
 * (sorgente di `paidCurrentYearTotal`/spendibile) per riconciliare subito
 * Dashboard e Scadenziario.
 */
export function useUnmarkAsPaid(options: UseUnmarkAsPaidOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ schedule }: { schedule: TaxScheduleRow }) => {
      if (!user) throw new Error("Utente non autenticato");

      const { error } = await supabase.rpc(
        "unmark_tax_schedule_paid" as never,
        { p_schedule_id: schedule.id } as never,
      );

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["tax_schedule"] });
      queryClient.invalidateQueries({ queryKey: ["open_tax_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
      queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["expired_rates_count"] });
      queryClient.invalidateQueries({ queryKey: ["calendar_tax_deadlines"] });
      // Sorgente di spendibile / paidCurrentYearTotal — assente in useMarkAsPaid
      queryClient.invalidateQueries({ queryKey: ["current_year_schedules"] });

      track("mark_as_paid_undone", {
        schedule_id: variables.schedule.id,
        amount: variables.schedule.total_expected,
        bucket: variables.schedule.bucket,
        due_date: variables.schedule.due_date,
        source: "scadenziario",
      });

      toast({ title: "Pagamento annullato" });
      options.onSuccess?.();
    },
    onError: (error: unknown, variables) => {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "unknown";
      track("mark_as_paid_undo_failed", {
        schedule_id: variables.schedule.id,
        bucket: variables.schedule.bucket,
        error_message: errorMessage,
        source: "scadenziario",
      });

      toast({
        title: "Errore",
        description: "Impossibile annullare il pagamento. Riprova.",
        variant: "destructive",
      });
    },
  });

  return mutation;
}
