/**
 * useDeadlineEmailMetrics — dati per la dashboard admin "Email Scadenze · Metriche" (Story 84.9).
 *
 * TRE SORGENTI complementari (NON confonderle — §Onestà delle sorgenti, AC#6):
 *  1. RECAPITO (delivered/bounced/complained) + KPI base → RPC get_email_event_stats (84-5,
 *     esistente/tipizzata) — segnali SMTP, completi, NON consent-gated.
 *  2. TREND giornaliero recapito → RPC get_email_event_trend (84-9). DRILL-DOWN per-utente →
 *     RPC get_email_event_recipients (84-9). PII filtrata server-side.
 *  3. CLICK REALE → EF admin-deadline-email-clicks (PostHog HogQL) — reale ma CONSENT-GATED.
 *     Query SEPARATA: può fallire senza abbattere le KPI recapito.
 *
 * ⚠️ opened/clicked da email_events sono ~0 al lancio (toggle Resend OFF, 84-1): il tasso click
 * VERO è quello PostHog (sorgente 3), NON email_events.clicked.
 *
 * Pattern: useQuery + supabase.rpc, staleTime ~5min (come AdminMarkPaidNsmCard).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME_MS = 5 * 60 * 1000;
const DEADLINE_CATEGORY = "deadline_reminder";

export type EmailMetricsWindow = "7d" | "30d" | "90d" | "all";

/** Conteggi di recapito per una singola soglia (da by_threshold di get_email_event_stats). */
export interface ThresholdRecapito {
  total: number;
  delivered: number;
  bounced: number;
  complained: number;
}

/** Shape di get_email_event_stats (84-5). `Returns: Json` → cast garantito dalla migration. */
export interface DeadlineEmailStats {
  total: number;
  sent: number;
  delivered: number;
  delivery_delayed: number;
  bounced: number;
  complained: number;
  failed: number;
  opened: number;
  clicked: number;
  by_threshold: Record<string, ThresholdRecapito>;
}

/** Punto della serie giornaliera di recapito (get_email_event_trend). */
export interface EmailTrendPoint {
  day: string;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  clicked: number;
}

/** Riga drill-down per-utente (get_email_event_recipients). */
export interface EmailRecipientRow {
  recipient_email: string | null;
  user_id: string | null;
  event_type: string;
  threshold: string | null;
  clicked_url: string | null;
  occurred_at: string;
}

/** Metriche click da PostHog (EF admin-deadline-email-clicks). */
export interface ClickThreshold {
  threshold: string;
  clicks: number;
  sends: number;
  click_rate: number | null;
}
export interface ClickTrendPoint {
  day: string;
  clicks: number;
  sends: number;
}
export interface ClickMetrics {
  clicks: number;
  sends: number;
  click_rate: number | null;
  by_threshold: ClickThreshold[];
  trend: ClickTrendPoint[];
}

/**
 * Converte la finestra UI in un cutoff ISO (istante assoluto N giorni fa) o null per "tutto".
 * NB: è un ISTANTE (non una data locale) → toISOString() è corretto qui (memory timezone:
 * il divieto riguarda le DATE locali, non i cutoff temporali assoluti).
 */
export function windowToSince(window: EmailMetricsWindow, nowMs: number = Date.now()): string | null {
  const days: Record<Exclude<EmailMetricsWindow, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  if (window === "all") return null;
  return new Date(nowMs - days[window] * 24 * 60 * 60 * 1000).toISOString();
}

export interface UseDeadlineEmailMetricsArgs {
  window: EmailMetricsWindow;
  /** Filtro tipo evento per il drill-down (es. "email.bounced"); null = tutti. */
  eventType?: string | null;
  /** Cap righe drill-down (server cap a 1000). */
  recipientLimit?: number;
}

export function useDeadlineEmailMetrics({
  window,
  eventType = null,
  recipientLimit = 500,
}: UseDeadlineEmailMetricsArgs) {
  const since = windowToSince(window);

  // 1. KPI recapito + by_threshold (RPC esistente 84-5)
  const statsQuery = useQuery({
    queryKey: ["deadline-email-stats", since],
    queryFn: async (): Promise<DeadlineEmailStats> => {
      const { data, error } = await supabase.rpc("get_email_event_stats", {
        p_category: DEADLINE_CATEGORY,
        p_since: since ?? undefined,
      });
      if (error) throw error;
      return data as unknown as DeadlineEmailStats;
    },
    staleTime: STALE_TIME_MS,
  });

  // 2a. Trend giornaliero recapito (RPC nuova 84-9)
  const trendQuery = useQuery({
    queryKey: ["deadline-email-trend", since],
    queryFn: async (): Promise<EmailTrendPoint[]> => {
      const { data, error } = await supabase.rpc("get_email_event_trend", {
        p_category: DEADLINE_CATEGORY,
        p_since: since ?? undefined,
      });
      if (error) throw error;
      return (data as unknown as EmailTrendPoint[]) ?? [];
    },
    staleTime: STALE_TIME_MS,
  });

  // 2b. Drill-down per-utente (RPC nuova 84-9)
  const recipientsQuery = useQuery({
    queryKey: ["deadline-email-recipients", since, eventType, recipientLimit],
    queryFn: async (): Promise<EmailRecipientRow[]> => {
      const { data, error } = await supabase.rpc("get_email_event_recipients", {
        p_category: DEADLINE_CATEGORY,
        p_since: since ?? undefined,
        p_event_type: eventType ?? undefined,
        p_limit: recipientLimit,
      });
      if (error) throw error;
      return (data as unknown as EmailRecipientRow[]) ?? [];
    },
    staleTime: STALE_TIME_MS,
  });

  // 3. Click reale da PostHog (EF) — query SEPARATA: fallimento isolato dal recapito.
  const clicksQuery = useQuery({
    queryKey: ["deadline-email-clicks", since],
    queryFn: async (): Promise<ClickMetrics> => {
      const { data, error } = await supabase.functions.invoke("admin-deadline-email-clicks", {
        body: { since },
      });
      if (error) throw error;
      return data as ClickMetrics;
    },
    staleTime: STALE_TIME_MS,
    retry: false, // un 502 PostHog non va ritentato a raffica
  });

  return {
    since,
    stats: statsQuery.data,
    statsLoading: statsQuery.isLoading,
    statsError: statsQuery.isError,
    trend: trendQuery.data ?? [],
    trendLoading: trendQuery.isLoading,
    trendError: trendQuery.isError,
    recipients: recipientsQuery.data ?? [],
    recipientsLoading: recipientsQuery.isLoading,
    recipientsError: recipientsQuery.isError,
    clicks: clicksQuery.data,
    clicksLoading: clicksQuery.isLoading,
    clicksError: clicksQuery.isError,
  };
}
