import { useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminFeedbackStats, type FeedbackDistribution, type ReasonDistribution } from "@/hooks/useAdminFeedbackStats";

type TimeFilter = 30 | 90 | null;

const TIME_LABELS: Record<string, string> = {
  "30": "30 giorni",
  "90": "90 giorni",
  null: "Tutto",
};

const REASON_LABELS: Record<keyof ReasonDistribution, string> = {
  no_money: "Non avevo i soldi",
  forgot: "Dimenticato",
  unclear_amount: "Importo non chiaro",
  other: "Altro",
};

function ProgressBar({ value, max, color, label }: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">{value} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DistributionSection({ data }: { data: FeedbackDistribution }) {
  return (
    <div className="space-y-3">
      <ProgressBar value={data.yes} max={data.total} color="bg-green-500" label="Sì, tutto ok" />
      <ProgressBar value={data.no} max={data.total} color="bg-red-400" label="No, difficoltà" />
      <ProgressBar value={data.dismissed} max={data.total} color="bg-slate-300" label="Chiuso senza risposta" />
    </div>
  );
}

function ReasonsSection({ data }: { data: ReasonDistribution }) {
  const total = data.no_money + data.forgot + data.unclear_amount + data.other;
  if (total === 0) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-slate-100">
      <p className="text-sm font-medium text-slate-700">Motivi "No" ({total})</p>
      {(Object.entries(REASON_LABELS) as [keyof ReasonDistribution, string][]).map(
        ([key, label]) => (
          <ProgressBar key={key} value={data[key]} max={total} color="bg-amber-400" label={label} />
        ),
      )}
    </div>
  );
}

/**
 * Sezione admin per le statistiche feedback post-scadenza (Story 25.5).
 *
 * Mostra distribuzione Sì/No/Dismissed e breakdown motivi "No".
 * Filtro temporale: 30gg, 90gg, Tutto.
 */
export function AdminFeedbackStats() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(30);
  const { data, isLoading, error } = useAdminFeedbackStats(timeFilter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareHeart className="h-5 w-5 text-teal-500" />
            Feedback Post-Scadenza
          </CardTitle>
          <div className="flex gap-1">
            {([30, 90, null] as TimeFilter[]).map((tf) => (
              <Button
                key={String(tf)}
                variant={timeFilter === tf ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setTimeFilter(tf)}
              >
                {TIME_LABELS[String(tf)]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Errore nel caricamento: {(error as Error).message}
          </p>
        )}

        {data && data.distribution.total === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            Nessun feedback ricevuto nel periodo selezionato.
          </p>
        )}

        {data && data.distribution.total > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {data.distribution.total} risposte totali
            </p>
            <DistributionSection data={data.distribution} />
            <ReasonsSection data={data.reasons} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
