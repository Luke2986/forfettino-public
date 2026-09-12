/**
 * Admin mini widget per la North Star Metric "APU" (Active Paymark Users).
 *
 * Storia Epic 75:
 *  - 75-2a/b/c: NSM WCAF "Chiarezza Fiscale" (% utenti con accantonamento
 *    sufficiente). Deprecato il 18/04/2026 dopo discovery che mostrava 2.8% APU —
 *    il WCAF era inflazionato da tourist + paternalistico, non coerente con
 *    la value proposition di Forfettino come saver tool.
 *  - Hot-fix 2026-04-18: sostituisce il WCAF con APU + funnel di adozione.
 *    APU misura il VERO momento di valore realizzato: utente torna, marca
 *    scadenza pagata. Filtra tourist automaticamente.
 *  - 2026-04-19: aggiunto split by gestione (separata vs art/comm) perche'
 *    il calendario fiscale dei due gruppi e' radicalmente diverso e
 *    nascondere lo split falsa la lettura.
 *
 * @see supabase/migrations/20260419100000_nsm_adoption_funnel_by_gestione.sql
 */
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateIT } from "@/lib/schedule-helpers";
import { cn } from "@/lib/utils";

// Cache: 5 min coerente con gli altri widget admin metrici.
const NSM_STALE_TIME_MS = 5 * 60 * 1000;

interface FunnelStep {
  key: string;
  label: string;
  count: number;
  percent_of_top: number | null;
}

interface GestioneBlock {
  funnel: FunnelStep[];
  apu_percent: number | null;
  apu_numerator: number;
  apu_denominator: number;
}

interface NSMAdoptionResponse {
  fiscal_year: number;
  reference_date: string;
  funnel: FunnelStep[];
  apu_percent: number | null;
  apu_numerator: number;
  apu_denominator: number;
  // Campo opzionale (retro-compatibile: se il DB non ha ancora applicato la
  // migration 20260419100000, il widget mostra solo l'aggregate).
  by_gestione?: {
    separata: GestioneBlock;
    art_comm: GestioneBlock;
  };
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

// Color thresholds per APU (headline): aggressivi perche' il prodotto PLG
// sano dovrebbe avere APU >> 50% tra gli attivi. Sotto il 25% e' red flag.
function apuColorClass(percent: number | null | undefined): string {
  if (percent == null) return "text-slate-500";
  if (percent >= 50) return "text-emerald-700";
  if (percent >= 25) return "text-amber-700";
  return "text-red-600";
}

// Color per barra funnel: teal per gli step propedeutici (1-4), colore
// semantico sull'ultimo step (paymarked). Segnala visivamente dove converge
// il valore.
function barColorClass(stepKey: string, percent: number | null | undefined): string {
  if (stepKey === "paymarked_ytd") {
    if (percent == null || percent < 10) return "bg-red-500";
    if (percent < 25) return "bg-amber-500";
    return "bg-emerald-500";
  }
  return "bg-teal-500";
}

// Identifica il drop-off piu' grande tra step consecutivi. Ritorna il label
// dello step DI DESTINAZIONE (quello dove cade il volume) + la percentuale
// di utenti persi rispetto allo step precedente.
function findBiggestDropoff(funnel: FunnelStep[]): { label: string; lostPercent: number } | null {
  if (funnel.length < 2) return null;
  let biggest: { label: string; lostPercent: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].count;
    const curr = funnel[i].count;
    if (prev === 0) continue;
    const lostPercent = ((prev - curr) / prev) * 100;
    if (!biggest || lostPercent > biggest.lostPercent) {
      biggest = { label: funnel[i].label, lostPercent };
    }
  }
  return biggest;
}

// Mini-funnel compatto per le sezioni by_gestione. Layout piu' denso del
// funnel aggregato, senza header (il label e' nel genitore).
function FunnelRows({ funnel }: { funnel: FunnelStep[] }) {
  return (
    <div className="space-y-1.5">
      {funnel.map((step) => (
        <div key={step.key} className="space-y-0.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 truncate">
              {step.label}
            </span>
            <span className="tabular-nums shrink-0 text-slate-600">
              <span className="font-semibold text-slate-900">{step.count}</span>
              {step.percent_of_top != null && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {formatPercent(step.percent_of_top)}
                </span>
              )}
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={step.percent_of_top ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${step.label}: ${step.percent_of_top ?? 0} percento`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                barColorClass(step.key, step.percent_of_top),
              )}
              style={{ width: `${step.percent_of_top ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Mini-card per una singola gestione (separata o art_comm).
function GestioneMiniCard({
  title,
  subtitle,
  block,
}: {
  title: string;
  subtitle: string;
  block: GestioneBlock;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            apuColorClass(block.apu_percent),
          )}
          aria-label={
            block.apu_percent == null
              ? `APU ${title} non calcolabile`
              : `APU ${title}: ${block.apu_percent.toFixed(1)} percento`
          }
        >
          {formatPercent(block.apu_percent)}
        </p>
        <p className="text-xs text-muted-foreground">
          {block.apu_numerator} paymarked / {block.apu_denominator} attivi 90gg
        </p>
      </div>
      <FunnelRows funnel={block.funnel} />
    </div>
  );
}

export function AdminNSMMiniCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-nsm-adoption-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_nsm_adoption_funnel");
      if (error) throw error;
      // La RPC tipa `Returns: Json` — cast safe via unknown perche' la shape
      // e' garantita dalla migration SQL.
      return data as unknown as NSMAdoptionResponse;
    },
    staleTime: NSM_STALE_TIME_MS,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent
          className="p-6 space-y-4"
          role="status"
          aria-busy="true"
          aria-label="Caricamento NSM Adozione"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold">NSM: Adozione Forfettino</h2>
          </div>
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-56" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
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
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-teal-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold">NSM: Adozione Forfettino</h2>
          </div>
          <p className="text-sm text-destructive">
            Impossibile caricare la NSM. Riprova fra qualche minuto.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    funnel,
    apu_percent,
    apu_numerator,
    apu_denominator,
    fiscal_year,
    reference_date,
    by_gestione,
  } = data;

  const safeReferenceDate =
    typeof reference_date === "string" && reference_date.length > 0
      ? formatDateIT(reference_date)
      : "—";

  const dropoff = findBiggestDropoff(funnel);

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {/* Header: titolo + meta anno */}
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">NSM: Adozione Forfettino</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Anno {fiscal_year} · Aggiornato al {safeReferenceDate}
            </p>
          </div>
        </div>

        {/* APU headline aggregate */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            APU · Active Paymark Users
          </p>
          <p
            className={cn(
              "text-4xl font-bold tabular-nums mt-1",
              apuColorClass(apu_percent),
            )}
            aria-label={
              apu_percent == null
                ? "APU non calcolabile"
                : `APU: ${apu_percent.toFixed(1)} percento`
            }
          >
            {formatPercent(apu_percent)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {apu_numerator} paymarked / {apu_denominator} attivi ultimi 90gg
          </p>
        </div>

        {/* Funnel aggregate */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
            Funnel di adozione
          </p>
          {funnel.map((step) => (
            <div key={step.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700 truncate">
                  {step.label}
                </span>
                <span className="tabular-nums shrink-0 text-slate-600">
                  <span className="font-semibold text-slate-900">{step.count}</span>
                  {step.percent_of_top != null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatPercent(step.percent_of_top)}
                    </span>
                  )}
                </span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={step.percent_of_top ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${step.label}: ${step.percent_of_top ?? 0} percento`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    barColorClass(step.key, step.percent_of_top),
                  )}
                  style={{ width: `${step.percent_of_top ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Drop-off insight aggregate */}
        {dropoff && dropoff.lostPercent > 10 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-600">
              <span className="font-semibold">Drop-off piu' grande:</span>{" "}
              <span
                className={cn(
                  "font-semibold",
                  dropoff.lostPercent >= 50
                    ? "text-red-600"
                    : dropoff.lostPercent >= 25
                    ? "text-amber-700"
                    : "text-slate-700",
                )}
              >
                {dropoff.lostPercent.toFixed(1)}%
              </span>{" "}
              degli utenti perso prima di "{dropoff.label}"
            </p>
          </div>
        )}

        {/* Split by gestione — il server potrebbe non tornarlo se la migration
            20260419100000 non e' ancora applicata: gracefully hidden. */}
        {by_gestione && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Per gestione INPS
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Calendari fiscali diversi — legga il valore solo post-scadenza
                (art/comm: 16/05 · separata: 20/07 nel 2026).
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <GestioneMiniCard
                title="Gestione Separata"
                subtitle="IRPEF + INPS separata (2026: scade 20/07)"
                block={by_gestione.separata}
              />
              <GestioneMiniCard
                title="Artigiani / Commercianti"
                subtitle="INPS fissi Q1-Q4 (prossima 16/05)"
                block={by_gestione.art_comm}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
