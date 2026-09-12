import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import {
  getScheduleStatus,
  bucketToLabel,
  deriveRataType,
  rataTypeLabel,
  formatDateIT,
  daysUntil,
  getRataBreakdown,
} from "@/lib/schedule-helpers";
import type { ScheduleDisplayStatus } from "@/lib/schedule-helpers";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

export interface RataScadenzaCardProps {
  schedule: TaxScheduleRow;
}

const STATUS_CONFIG: Record<
  ScheduleDisplayStatus,
  {
    label: string | ((days: number) => string);
    className: string;
    Icon: typeof CheckCircle;
  }
> = {
  pagata: {
    label: "Pagata",
    className: "bg-success-muted text-success",
    Icon: CheckCircle,
  },
  da_pagare: {
    label: "Da pagare",
    className: "bg-secondary text-secondary-foreground",
    Icon: Circle,
  },
  imminente: {
    label: (days: number) => (days === 0 ? "Oggi" : `Tra ${days} giorni`),
    className: "bg-warning-muted text-warning",
    Icon: Clock,
  },
  scaduta: {
    label: "Scaduta",
    className: "bg-destructive-muted text-destructive",
    Icon: AlertCircle,
  },
};

export function RataScadenzaCard({ schedule }: RataScadenzaCardProps) {
  const displayStatus = getScheduleStatus(schedule);
  const days = daysUntil(schedule.due_date);
  const config = STATUS_CONFIG[displayStatus];
  const rataType = deriveRataType(schedule.bucket);
  const breakdown = getRataBreakdown(schedule);

  const badgeLabel =
    typeof config.label === "function" ? config.label(days) : config.label;

  const ariaLabel = `Rata ${rataTypeLabel(rataType)} di ${formatCurrency(Number(schedule.total_expected))}, scadenza ${formatDateIT(schedule.due_date)}, stato ${badgeLabel}`;

  return (
    <Card role="article" aria-label={ariaLabel} data-testid="rata-scadenza-card">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{bucketToLabel(schedule.bucket, schedule.due_date)}</p>
          <p className="text-xs text-muted-foreground">
            {rataTypeLabel(rataType)} — {formatDateIT(schedule.due_date)}
          </p>
        </div>
        <Badge className={config.className} data-testid="status-badge">
          <config.Icon className="mr-1 h-3 w-3" />
          {badgeLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Importo principale */}
        <div className="flex justify-between items-baseline">
          <span className="text-lg font-bold tabular-nums">
            {formatCurrency(Number(schedule.total_expected))}
          </span>
          {Number(schedule.total_paid) > 0 && displayStatus !== "pagata" && (
            <span className="text-xs text-muted-foreground">
              Pagato: {formatCurrency(Number(schedule.total_paid))}
            </span>
          )}
        </div>

        {/* Breakdown importo */}
        {breakdown.length > 1 && (
          <div className="space-y-1 text-sm border-t pt-2" data-testid="breakdown-section">
            {breakdown.map((item) => (
              <div key={item.label} className="flex justify-between">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="tabular-nums">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
