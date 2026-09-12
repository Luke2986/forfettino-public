/**
 * Admin widget per la NSM "tasse segnate pagate" + accuratezza delle stime
 * (Epic 82). Va SOTTO AdminNSMMiniCard nella dashboard admin.
 *
 * DUE LAYER (il tracking del reale NON e' retroattivo):
 *  - NSM (nsm_users): utenti che hanno segnato >=1 tassa pagata, contati dal
 *    ledger payments → RETROATTIVO (include i mark storici, art/comm inclusi).
 *  - Accuratezza/banda/causa: da payment_discrepancies → SOLO FORWARD (da
 *    quando catturiamo il reale). Etichettato con tracking_since per onesta'.
 *
 * Sorgente: RPC get_payment_discrepancy_stats.
 * @see supabase/migrations/20260609140000_get_payment_discrepancy_stats_rpc.sql
 */
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateIT } from "@/lib/schedule-helpers";
import { cn } from "@/lib/utils";

const STALE_TIME_MS = 5 * 60 * 1000;

interface DiscrepancyStats {
  nsm_users: number;
  tracked_marks: number;
  tracking_since: string | null;
  green: number;
  yellow: number;
  red: number;
  green_percent: number | null;
  reason_given: number;
  category_reality: number;
  category_engine: number;
  category_unknown: number;
  // Breakdown finestra di versamento (rata giugno in anni con proroga)
  window_tracked: number;
  window_ordinary: number;
  window_proroga: number;
  window_differimento: number;
  window_late: number;
  surcharge_total_cents: number;
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

// Accuratezza engine: un motore sano dovrebbe avere la grande maggioranza dei
// mark entro tolleranza. Sotto il 60% e' un red flag sul calcolo.
function accuracyColorClass(percent: number | null | undefined): string {
  if (percent == null) return "text-slate-500";
  if (percent >= 80) return "text-emerald-700";
  if (percent >= 60) return "text-amber-700";
  return "text-red-600";
}

// Riga barra orizzontale: label + count + % del totale.
function StatBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700 truncate">{label}</span>
        <span className="tabular-nums shrink-0 text-slate-600">
          <span className="font-semibold text-slate-900">{count}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {formatPercent(percent)}
          </span>
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${Math.round(percent)} percento`}
      >
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function AdminMarkPaidNsmCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-mark-paid-nsm-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_payment_discrepancy_stats");
      if (error) throw error;
      // RPC tipata `Returns: Json`; shape garantita dalla migration SQL.
      return data as unknown as DiscrepancyStats;
    },
    staleTime: STALE_TIME_MS,
  });

  const Header = (
    <div className="flex items-center gap-2">
      <Target className="h-5 w-5 text-teal-600" aria-hidden="true" />
      <h2 className="text-lg font-semibold">Tasse segnate pagate · Accuratezza stime</h2>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent
          className="p-6 space-y-4"
          role="status"
          aria-busy="true"
          aria-label="Caricamento NSM pagamenti"
        >
          {Header}
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-56" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="mb-2">{Header}</div>
          <p className="text-sm text-destructive">
            Impossibile caricare le statistiche. Riprova fra qualche minuto.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tracked = data.tracked_marks;

  // Empty assoluto: nessun mark nel ledger E nessuno tracciato.
  if (data.nsm_users === 0 && tracked === 0) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Header}
          <p className="text-sm text-muted-foreground">
            Nessuna tassa ancora segnata come pagata. Il dato comparira' qui
            appena gli utenti iniziano a usare lo scadenziario.
          </p>
        </CardContent>
      </Card>
    );
  }

  const trackingSince =
    typeof data.tracking_since === "string" && data.tracking_since.length > 0
      ? formatDateIT(data.tracking_since)
      : null;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {Header}

        {/* Due headline: NSM (retroattivo) + accuratezza engine (forward) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              NSM · Utenti
            </p>
            <p className="text-4xl font-bold tabular-nums mt-1 text-slate-900">
              {data.nsm_users}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              segnano tasse pagate
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Accuratezza stime
            </p>
            <p
              className={cn(
                "text-4xl font-bold tabular-nums mt-1",
                accuracyColorClass(tracked > 0 ? data.green_percent : null),
              )}
              aria-label={
                tracked === 0
                  ? "Accuratezza non ancora disponibile"
                  : data.green_percent == null
                  ? "Accuratezza non calcolabile"
                  : `Accuratezza: ${data.green_percent.toFixed(1)} percento`
              }
            >
              {tracked > 0 ? formatPercent(data.green_percent) : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tracked > 0
                ? `${data.green} entro tolleranza`
                : "in attesa dei primi pagamenti tracciati"}
            </p>
          </div>
        </div>

        {/* Nota onesta': l'accuratezza e' forward-only */}
        <p className="text-xs text-muted-foreground">
          {tracked > 0 ? (
            <>
              Accuratezza su <span className="font-semibold">{tracked}</span> pagamenti
              tracciati{trackingSince ? ` da ${trackingSince}` : ""}. I mark precedenti
              contano nella NSM ma non nell'accuratezza (il reale non era catturato).
            </>
          ) : (
            <>Tracking accuratezza attivo: nessun pagamento ancora registrato dal nuovo flusso.</>
          )}
        </p>

        {/* Distribuzione banda tolleranza (solo se c'e' tracking forward) */}
        {tracked > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
              Distribuzione scostamento
            </p>
            <StatBar label="Entro tolleranza (verde)" count={data.green} total={tracked} colorClass="bg-emerald-500" />
            <StatBar label="Scostamento moderato (giallo)" count={data.yellow} total={tracked} colorClass="bg-amber-500" />
            <StatBar label="Scostamento rilevante (rosso)" count={data.red} total={tracked} colorClass="bg-red-500" />
          </div>
        )}

        {/* Breakdown causa → roadmap fix motore */}
        {data.reason_given > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
              Causa scostamento ({data.reason_given} con motivo)
            </p>
            <StatBar label="Realta' (compensazioni, ravvedimenti…)" count={data.category_reality} total={data.reason_given} colorClass="bg-teal-500" />
            <StatBar label="Engine (candidati bug del calcolo)" count={data.category_engine} total={data.reason_given} colorClass="bg-red-500" />
            <StatBar label="Da chiarire" count={data.category_unknown} total={data.reason_given} colorClass="bg-slate-400" />
            {data.category_engine > 0 && (
              <p className="text-xs text-slate-600 pt-1">
                <span className="font-semibold text-red-600">{data.category_engine}</span>{" "}
                scostamenti attribuiti al motore — incrociare con
                {" "}<code className="text-xs">engine_params_snapshot</code> per i fix.
              </p>
            )}
          </div>
        )}

        {/* Breakdown finestra di versamento (proroga forfettari/ISA) */}
        {data.window_tracked > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
              Finestra di versamento ({data.window_tracked} rate giugno)
            </p>
            <StatBar label="Entro 30 giugno" count={data.window_ordinary} total={data.window_tracked} colorClass="bg-emerald-500" />
            <StatBar label="1–20 luglio (proroga)" count={data.window_proroga} total={data.window_tracked} colorClass="bg-teal-500" />
            <StatBar label="21/7–20/8 (differimento +0,80%)" count={data.window_differimento} total={data.window_tracked} colorClass="bg-amber-500" />
            <StatBar label="Oltre 20 agosto (ravvedimento)" count={data.window_late} total={data.window_tracked} colorClass="bg-red-500" />
            {data.surcharge_total_cents > 0 && (
              <p className="text-xs text-slate-600 pt-1">
                Maggiorazione differimento incassata:{" "}
                <span className="font-semibold text-amber-700">
                  {(data.surcharge_total_cents / 100).toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
