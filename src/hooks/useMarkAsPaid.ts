import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeMoney, toCents } from "@/lib/money";
import { track, trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";
import { isInpsFixedBucket } from "@/lib/schedule-helpers";
import { classifyDelta } from "@/lib/tolerance";
import { type PaymentWindowCode } from "@/lib/fiscal-engine";
import {
  reasonToCategory,
  FISCAL_ENGINE_VERSION,
  type DiscrepancyReasonCode,
} from "@/lib/discrepancy";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

/**
 * Derive payment_type from bucket.
 * INPS fixed quarterly rates (inps_q1..inps_q4) → "inps"
 * June/November (mixed INPS variable + TAX) → "mixed"
 */
export function derivePaymentType(bucket: string): string {
  if (isInpsFixedBucket(bucket)) {
    return "inps";
  }
  // june and november have mixed components (tax + inps variable)
  return "mixed";
}

interface UseMarkAsPaidOptions {
  onSuccess?: () => void;
}

// Metadata comportamentale che il chiamante puo' propagare per arricchire
// gli eventi PostHog. Se omesso, viene usato un default minimale —
// backward compat per test e consumer legacy.
export interface MarkAsPaidTrackingContext {
  source?: string;
  timeInDialogMs?: number | null;
  daysToDue?: number | null;
}

export interface MarkAsPaidVariables {
  schedule: TaxScheduleRow;
  paymentDate: string;
  /**
   * Importo REALE pagato dall'utente in centesimi. Se omesso (consumer/test
   * legacy) si usa la stima (total_expected) → delta 0, banda verde.
   */
  amountPaidCents?: number;
  /** Motivo dello scostamento (solo se fuori banda verde). */
  reasonCode?: DiscrepancyReasonCode | null;
  /** Nota libera opzionale. */
  note?: string | null;
  /** Snapshot input engine costruito lato pagina (buildEngineSnapshot). */
  engineSnapshot?: Record<string, unknown> | null;
  /**
   * Finestra di versamento scelta (solo rata `june` in anni con proroga). Null
   * per le altre rate / anni senza proroga (flusso classico invariato).
   */
  paymentWindow?: PaymentWindowCode | null;
  /**
   * Maggiorazione legale della finestra in centesimi (es. +0,80% del differimento).
   * 0 per ordinary/proroga/late. Isolata dalla stima base: l'accuratezza engine
   * NON viene falsata dalla maggiorazione legale.
   */
  surchargeCents?: number;
  trackingContext?: MarkAsPaidTrackingContext;
}

export function useMarkAsPaid(options: UseMarkAsPaidOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      schedule,
      paymentDate,
      amountPaidCents,
      reasonCode,
      note,
      engineSnapshot,
      paymentWindow,
      surchargeCents,
    }: MarkAsPaidVariables) => {
      if (!user) throw new Error("Utente non autenticato");

      const estimatedEuros = sanitizeMoney(schedule.total_expected);
      if (estimatedEuros <= 0) {
        throw new Error("L'importo della rata deve essere positivo");
      }
      const estimatedCents = toCents(estimatedEuros);

      // Importo reale fornito: deve essere positivo (0 = errore, non fallback).
      if (amountPaidCents != null && amountPaidCents <= 0) {
        throw new Error("L'importo pagato deve essere maggiore di zero");
      }
      // Backward-compat: senza importo reale (consumer/test legacy) si usa la stima.
      const paidCents =
        amountPaidCents != null ? Math.round(amountPaidCents) : estimatedCents;

      // Validate payment date — `+ "T00:00:00"` evita lo shift UTC (regola progetto)
      const parsedDate = new Date(paymentDate + "T00:00:00");
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Data di pagamento non valida");
      }
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      if (parsedDate > oneYearFromNow) {
        throw new Error("La data non può essere più di un anno nel futuro");
      }

      // Maggiorazione legale della finestra (es. +0,80% differimento). La banda
      // e il delta si misurano vs l'atteso DELLA FINESTRA (stima + maggiorazione):
      // un differimento pagato correttamente deve risultare VERDE, non giallo.
      const surcharge =
        surchargeCents != null && surchargeCents > 0 ? Math.round(surchargeCents) : 0;
      const expectedForBandCents = estimatedCents + surcharge;

      // Classificazione delta (single source of truth: tolerance.ts).
      // deltaCents qui serve solo al tracking; la RPC ricalcola delta_cents/pct
      // server-side da paid-(estimated+surcharge) (integrita' del dataset analitico).
      const { band, deltaCents } = classifyDelta(expectedForBandCents, paidCents);
      const category = reasonToCategory(reasonCode);

      // RPC atomica: payment reale + status='paid' + riga discrepancy.
      // Cast: la funzione potrebbe non essere ancora nei tipi generati (Lovable).
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)("mark_tax_schedule_paid", {
        p_schedule_id: schedule.id,
        p_amount_paid_cents: paidCents,
        p_payment_date: paymentDate,
        p_payment_type: derivePaymentType(schedule.bucket),
        p_amount_estimated_cents: estimatedCents,
        p_tolerance_band: band,
        p_reason_code: reasonCode ?? null,
        p_discrepancy_category: category,
        p_note: note ?? null,
        p_engine_snapshot: engineSnapshot ?? null,
        p_engine_version: FISCAL_ENGINE_VERSION,
        p_payment_window: paymentWindow ?? null,
        p_surcharge_cents: surcharge,
      });

      if (error) throw error;

      return { discrepancyId: data, band, deltaCents, paidCents, paymentWindow: paymentWindow ?? null, surcharge };
    },
    onSuccess: (result, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["tax_schedule"] });
      queryClient.invalidateQueries({ queryKey: ["open_tax_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
      queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["expired_rates_count"] });
      // Story 5.4: Align calendar query invalidation with mark-as-paid flow
      queryClient.invalidateQueries({ queryKey: ["calendar_tax_deadlines"] });
      // FIX: sorgente di spendibile / paidCurrentYearTotal — mancava qui
      // (presente solo in useUnmarkAsPaid). Senza, il netto in dashboard
      // restava stantio dopo "segna come pagata".
      queryClient.invalidateQueries({ queryKey: ["current_year_schedules"] });

      // Arricchito 2026-04-18: props aggiuntivi per il funnel PostHog
      // "intent → confirmed" (UX friction) e "page_view → intent" (discovery).
      // Arricchito 2026-06-09: importo reale + banda + delta per la NSM e
      // l'analisi accuratezza engine.
      const ctx = variables.trackingContext ?? {};
      track("mark_as_paid_confirmed", {
        schedule_id: variables.schedule.id,
        amount: variables.schedule.total_expected,
        amount_paid_cents: result.paidCents,
        tolerance_band: result.band,
        delta_cents: result.deltaCents,
        payment_window: result.paymentWindow,
        surcharge_cents: result.surcharge,
        reason_code: variables.reasonCode ?? null,
        bucket: variables.schedule.bucket,
        due_date: variables.schedule.due_date,
        source: ctx.source ?? "scadenziario",
        days_to_due: ctx.daysToDue ?? null,
        time_in_dialog_ms: ctx.timeInDialogMs ?? null,
      });
      trackAnonymous(ANALYTICS_EVENTS.SCADENZA_PAGATA);

      toast({ title: "Pagamento registrato" });
      options.onSuccess?.();
    },
    onError: (error: unknown, variables) => {
      // Isola la friction tecnica (RLS/validation/network) da quella UX.
      // Se questo evento spicca nei dati → problema server/DB, non UX.
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === "string" ? error : "unknown";
      const ctx = variables.trackingContext ?? {};
      track("mark_as_paid_failed", {
        schedule_id: variables.schedule.id,
        bucket: variables.schedule.bucket,
        error_message: errorMessage,
        source: ctx.source ?? "scadenziario",
      });

      toast({
        title: "Errore",
        description: "Impossibile registrare il pagamento. Riprova.",
        variant: "destructive",
      });
    },
  });

  return mutation;
}
