import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type FiscalRulesRow = Database['public']['Tables']['fiscal_rules']['Row'];
type FiscalRulesInsert = Database['public']['Tables']['fiscal_rules']['Insert'];
type FiscalRulesUpdate = Database['public']['Tables']['fiscal_rules']['Update'];

/**
 * Hook per caricare i parametri normativi INPS per anno fiscale.
 * Fonte dati: tabella `fiscal_rules` (Supabase).
 *
 * Strategia cache: staleTime 1 min (ADR-2 aggiornato, Story 7-2).
 * Ridotto da 5 min per garantire che utenti inattivi (che perdono il
 * broadcast Realtime) ricalcolino entro 1 min — safety net per NFR6.
 * Il broadcast Realtime (useFiscalRulesSync) provvede all'invalidazione
 * istantanea per le sessioni attive.
 *
 * @param fiscalYear - Anno fiscale per cui caricare i parametri (es. 2026)
 */
export function useFiscalRules(fiscalYear: number) {
  return useQuery({
    queryKey: ['fiscalRules', fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_rules')
        .select('*')
        .eq('fiscal_year', fiscalYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minuto — ADR-2 aggiornato (Story 7-2, safety net per NFR6)
    retry: 1, // Evita retry rumorosi su anni senza regole fiscali
    enabled: fiscalYear > 0 && Number.isFinite(fiscalYear),
  });
}

/**
 * Hook per caricare la lista degli anni disponibili in fiscal_rules.
 * Usato dalla pagina admin per il selettore anno.
 */
export function useFiscalRulesYears() {
  return useQuery({
    queryKey: ['fiscalRulesYears'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_rules')
        .select('fiscal_year')
        .order('fiscal_year', { ascending: false });
      if (error) throw error;
      return data.map((r) => r.fiscal_year);
    },
    staleTime: 1 * 60 * 1000, // 1 minuto — ADR-2 aggiornato (Story 7-2)
  });
}

/**
 * Invia un broadcast Supabase Realtime per notificare tutte le sessioni
 * attive che i parametri fiscali sono stati aggiornati (FR38, NFR6).
 * Il canale è creato, usato e immediatamente rimosso (fire-and-forget).
 */
function broadcastFiscalRulesUpdate(fiscalYear: number): void {
  const channel = supabase.channel('fiscal-rules-updates');
  channel.send({
    type: 'broadcast',
    event: 'fiscal_rules_updated',
    payload: { fiscal_year: fiscalYear },
  }).then(() => {
    supabase.removeChannel(channel);
  }).catch(() => {
    supabase.removeChannel(channel);
  });
}

/**
 * Mutation hook per aggiornare i parametri fiscali di un anno esistente.
 * Invalida le query correlate dopo il successo e invia un broadcast
 * Supabase Realtime a tutte le sessioni attive per triggerare il ricalcolo
 * a cascata (FR38, NFR6).
 */
export function useUpdateFiscalRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fiscalYear, updates }: { fiscalYear: number; updates: FiscalRulesUpdate }) => {
      const { data, error } = await supabase
        .from('fiscal_rules')
        .update(updates)
        .eq('fiscal_year', fiscalYear)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidazione locale (per la sessione admin)
      queryClient.invalidateQueries({ queryKey: ['fiscalRules', variables.fiscalYear] });
      queryClient.invalidateQueries({ queryKey: ['fiscalRulesYears'] });

      // Broadcast a tutte le sessioni attive — fire-and-forget con cleanup
      broadcastFiscalRulesUpdate(variables.fiscalYear);
    },
  });
}

/**
 * Mutation hook per inserire un nuovo anno di parametri fiscali.
 * Invalida le query correlate dopo il successo e invia un broadcast
 * Supabase Realtime (FR38, NFR6).
 */
export function useInsertFiscalRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: FiscalRulesInsert) => {
      const { data, error } = await supabase
        .from('fiscal_rules')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fiscalRules', data.fiscal_year] });
      queryClient.invalidateQueries({ queryKey: ['fiscalRulesYears'] });

      // Broadcast a tutte le sessioni attive — fire-and-forget con cleanup
      broadcastFiscalRulesUpdate(data.fiscal_year);
    },
  });
}
