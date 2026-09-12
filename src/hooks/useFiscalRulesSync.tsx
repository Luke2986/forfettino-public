import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook per sincronizzare le query fiscalRules via Supabase Realtime Broadcast.
 *
 * Quando l'admin aggiorna i parametri INPS (Story 7-1), il salvataggio
 * invia un broadcast "fiscal_rules_updated" a tutte le sessioni attive.
 * Questo hook sottoscrive al canale e invalida le query React Query
 * corrispondenti, triggerando il ricalcolo automatico in useFiscalCalculations.
 *
 * Catena: broadcast → invalidateQueries → useFiscalRules refetch → useFiscalCalculations ricalcolo
 *
 * @see FR38, NFR6
 */
export function useFiscalRulesSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Ref per evitare che toast (identità instabile da useToast) causi re-subscription
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const channel = supabase
      .channel("fiscal-rules-updates")
      .on(
        "broadcast",
        { event: "fiscal_rules_updated" },
        (payload: { payload?: { fiscal_year?: number } }) => {
          try {
            const fiscalYear = payload?.payload?.fiscal_year;

            if (!fiscalYear || !Number.isFinite(fiscalYear)) {
              console.error("[useFiscalRulesSync] Broadcast con payload invalido:", payload);
              return;
            }

            // Invalida le query per l'anno aggiornato
            queryClient.invalidateQueries({ queryKey: ["fiscalRules", fiscalYear] });
            queryClient.invalidateQueries({ queryKey: ["fiscalRulesYears"] });

            // Notifica l'utente
            toastRef.current({
              title: "Parametri INPS aggiornati",
              description: `I parametri per l'anno ${fiscalYear} sono stati aggiornati. Ricalcolo in corso...`,
            });
          } catch (err) {
            console.error("[useFiscalRulesSync] Errore nel gestire broadcast:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
