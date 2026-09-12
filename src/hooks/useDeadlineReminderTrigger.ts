import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Story 84-4 — Hook d'invocazione della Edge Function `send-deadline-reminder-email`
 * (già deployata e completa in 84-3). Questo hook NON ricostruisce la logica d'invio:
 * la orchestra con due varianti `dryRun: true` (preview) / `dryRun: false` (invio reale),
 * con stati di loading separati e gestione errore demandata al chiamante.
 *
 * Il JWT admin è auto-allegato da `supabase.functions.invoke` (client persistSession),
 * quindi l'auth duale della EF colpisce il ramo admin-JWT (`has_role('admin')`): nessun
 * secret da gestire lato UI.
 */

/** Body della richiesta verso la EF. Passare `thresholds` ESPLICITO = daysUntil(due_date). */
export interface DeadlineReminderRequest {
  thresholds: number[];
  userIds?: string[];
  todayISO?: string;
  /**
   * 84-10: bypassa il filtro per-utente delle soglie (`reminder_thresholds`). Gli invii
   * admin espliciti (one-shot 84-4, self-test 84-11) lo settano `true` così la rata scelta
   * non viene scartata da una soglia utente diversa. Il cron resta filtrato per-utente.
   */
  ignoreUserThresholds?: boolean;
}

export interface DeadlineRecipientPreview {
  to: string; // email mascherata
  bucket: string;
  threshold: number;
  amountEuro: number;
}

export interface DeadlineEmailSample {
  to: string;
  subject: string;
  htmlLength: number;
  textPreview: string;
}

/** Risposta dry-run (preview, nessun invio). `recipients`/`eligible` assenti quando candidates=0. */
export interface DeadlineDryRunResult {
  dryRun: true;
  today: string;
  thresholds: number[];
  candidates: number;
  eligible?: number;
  skipped_prefs?: number;
  recipients?: number;
  recipientsPreview?: DeadlineRecipientPreview[];
  sample?: DeadlineEmailSample | null;
  /** Presente nello stato neutro "Nessuna rata non pagata in soglia". */
  message?: string;
}

/** Risposta invio reale. `batchId`/`sent`/`failed` presenti solo quando ci sono stati invii. */
export interface DeadlineRealRunResult {
  dryRun: false;
  today: string;
  thresholds: number[];
  batchId?: string;
  candidates: number;
  eligible?: number;
  skipped_prefs?: number;
  sent: number;
  failed?: number;
  /** Presente nello stato neutro "Nessuna rata non pagata in soglia". */
  message?: string;
}

const FUNCTION_NAME = "send-deadline-reminder-email";

export function useDeadlineReminderTrigger() {
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  const runDryRun = useCallback(
    async (req: DeadlineReminderRequest): Promise<DeadlineDryRunResult> => {
      setDryRunLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
          body: { dryRun: true, ...req },
        });
        if (error) throw error;
        return data as DeadlineDryRunResult;
      } finally {
        setDryRunLoading(false);
      }
    },
    [],
  );

  const runReal = useCallback(
    async (req: DeadlineReminderRequest): Promise<DeadlineRealRunResult> => {
      setSendLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
          body: { dryRun: false, ...req },
        });
        if (error) throw error;
        return data as DeadlineRealRunResult;
      } finally {
        setSendLoading(false);
      }
    },
    [],
  );

  return { runDryRun, runReal, dryRunLoading, sendLoading };
}
