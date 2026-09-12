import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { sumMoney } from "@/lib/money";
import { bucketToLabel, daysUntil, formatDateIT } from "@/lib/schedule-helpers";
import type { DeadlineInfo } from "@/hooks/useFiscalCalculations";
import { Squircle } from "@/components/ui/squircle";
import { cn } from "@/lib/utils";

/**
 * ScadenzeInline — compact deadline list for the dashboard.
 *
 * Shows upcoming deadlines in a white card matching the KPI card style,
 * with two-line rows (date + description, countdown), separator borders,
 * and a footer link to the full scadenziario.
 *
 * Epic 13 — Dashboard Redesign / Figma alignment
 */

/** Color class for the deadline dot based on days remaining */
function dotColorClass(days: number): string {
  if (days <= 7) return "bg-red-500";
  if (days <= 30) return "bg-amber-500";
  return "bg-slate-300";
}

/** Human-readable label for days remaining */
function daysLabel(days: number): string {
  if (days < 0) return `scaduta da ${Math.abs(days)}g`;
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days <= 30) return `tra ${days}g`;
  // Far-future: show month count instead of raw day count
  return `tra ${Math.round(days / 30)} mesi`;
}

/** Text color for days label */
function daysTextColor(days: number): string {
  if (days <= 7) return "text-red-600";
  if (days <= 30) return "text-amber-600";
  return "text-slate-500";
}

interface ScadenzeInlineProps {
  deadlines: DeadlineInfo[];
  className?: string;
}

export function ScadenzeInline({ deadlines, className }: ScadenzeInlineProps) {
  const navigate = useNavigate();

  const total = deadlines.reduce(
    (sum, d) => sumMoney(sum, d.remaining),
    0,
  );

  return (
    /*
      Epic 81 — Squircle wrapper pattern:
      outer <div> retains rounded-2xl + border (CSS border survives because it
      lives on the outer rounded box, NOT clipped by the inner squircle).
      Inner <Squircle> renders the bg-stone-50 surface + padding inside the
      iOS-style superellipse shape.
    */
    <div
      className={cn(
        "rounded-2xl",
        "border border-stone-200/40",
        className,
      )}
      data-testid="scadenze-inline"
    >
      <Squircle radius={16} smoothing={0.6} className="bg-stone-50 p-6 sm:p-8 block">
      <div className="space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 flex-wrap gap-y-1">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Prossime scadenze
            </h3>
          </div>
          {deadlines.length > 0 && (
            <span className="text-sm text-slate-500 tabular-nums">
              Totale: <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
            </span>
          )}
        </div>

        {/* Deadline rows or empty state */}
        {deadlines.length === 0 ? (
          <div className="flex items-center gap-2 py-6" data-testid="scadenze-empty">
            <CheckCircle className="h-4 w-4 text-teal-500" />
            <span className="text-sm text-slate-500">
              Nessuna scadenza in programma
            </span>
          </div>
        ) : (
          <div>
            {deadlines.map((deadline, index) => {
              const days = daysUntil(deadline.dueDate);
              const isLast = index === deadlines.length - 1;
              return (
                <div
                  key={deadline.id}
                  data-testid="scadenza-row"
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between py-4",
                    !isLast && "border-b border-slate-100",
                  )}
                >
                  {/* Left: dot + stacked content */}
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0 mt-1.5",
                        dotColorClass(days),
                      )}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {days <= 7 ? "Urgente" : days <= 30 ? "In scadenza" : "Normale"}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatDateIT(deadline.dueDate)}
                        </span>
                        <span className="text-sm text-slate-600 truncate">
                          {bucketToLabel(deadline.bucket, deadline.dueDate)}
                        </span>
                      </div>
                      <span className={cn("text-sm", daysTextColor(days))}>
                        {daysLabel(days)}
                      </span>
                    </div>
                  </div>

                  {/* Right: amount */}
                  <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap self-end sm:self-auto mt-1 sm:mt-0 sm:ml-4">
                    {formatCurrency(deadline.remaining)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer link */}
        {deadlines.length > 0 && (
          <div className="pt-4 flex justify-end">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
              onClick={() => navigate("/scadenziario")}
              data-testid="scadenze-link"
            >
              Vai allo scadenziario
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      </Squircle>
    </div>
  );
}
