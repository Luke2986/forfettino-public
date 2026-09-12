import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import type { DeadlineInfo } from "@/hooks/useFiscalCalculations";
import { ArrowRight } from "lucide-react";
import { sumMoney } from "@/lib/money";
import { bucketToLabel, daysUntil } from "@/lib/schedule-helpers";

// Re-export per backward compat (usato da test e altri componenti)
export { bucketToLabel } from "@/lib/schedule-helpers";

/** Label leggibile per i giorni rimanenti, gestisce anche scadenze passate */
export function daysLabel(days: number): string {
  if (days < 0) return `scaduta da ${Math.abs(days)} giorni`;
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  return `tra ${days} giorni`;
}

export function daysColorClass(days: number): string {
  if (days <= 7) return "text-destructive";
  if (days <= 30) return "text-warning";
  return "text-muted-foreground";
}

// ── Nomi mesi italiani ──

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function formatMonthYear(dueDate: string): string {
  const d = new Date(dueDate + "T00:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function monthKey(dueDate: string): string {
  const d = new Date(dueDate + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Raggruppamento per mese ──

interface MonthGroup {
  key: string;
  label: string;
  deadlines: DeadlineInfo[];
  totalRemaining: number;
}

function groupByMonth(deadlines: DeadlineInfo[]): MonthGroup[] {
  const groupMap = new Map<string, DeadlineInfo[]>();

  for (const d of deadlines) {
    const mk = monthKey(d.dueDate);
    const group = groupMap.get(mk);
    if (group) {
      group.push(d);
    } else {
      groupMap.set(mk, [d]);
    }
  }

  const groups: MonthGroup[] = [];
  for (const [key, items] of groupMap) {
    groups.push({
      key,
      label: formatMonthYear(items[0].dueDate),
      deadlines: items,
      totalRemaining: items.reduce((sum, d) => sumMoney(sum, d.remaining), 0),
    });
  }

  return groups;
}

// ── Componente singola scadenza ──

function DeadlineRow({ deadline }: { deadline: DeadlineInfo }) {
  const days = daysUntil(deadline.dueDate);
  const dateFormatted = new Date(deadline.dueDate + "T00:00:00").toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div data-testid="deadline-item" className="flex items-start justify-between gap-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{bucketToLabel(deadline.bucket, deadline.dueDate)}</p>
        <p className="text-xs text-muted-foreground">
          {dateFormatted}
          {" — "}
          <span
            data-testid={`deadline-days-${deadline.id}`}
            className={daysColorClass(days)}
          >
            {daysLabel(days)}
          </span>
        </p>
      </div>
      <span className="text-sm font-medium whitespace-nowrap tabular-nums">
        {formatCurrency(deadline.remaining)}
      </span>
    </div>
  );
}

// ── Componente principale ──

interface UpcomingDeadlinesProps {
  deadlines: DeadlineInfo[];
  className?: string;
}

export function UpcomingDeadlines({ deadlines, className }: UpcomingDeadlinesProps) {
  const navigate = useNavigate();

  if (deadlines.length === 0) return null;

  const groups = groupByMonth(deadlines);

  return (
    <div className={`space-y-3 pt-2 ${className ?? ""}`}>
      {groups.map((group) => (
        <div key={group.key}>
          {/* Header raggruppamento solo se >1 scadenza nello stesso mese */}
          {group.deadlines.length > 1 && (
            <div
              data-testid="month-group-header"
              className="flex justify-between items-center text-sm font-semibold pb-1 mb-1 border-b border-border/50"
            >
              <span>{group.label}</span>
              <span className="tabular-nums">Totale: {formatCurrency(group.totalRemaining)}</span>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {group.deadlines.map((deadline) => (
              <DeadlineRow key={deadline.id} deadline={deadline} />
            ))}
          </div>
        </div>
      ))}

      {/* Link scadenziario */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer font-medium"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/scadenziario");
          }}
        >
          Vai allo scadenziario <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
