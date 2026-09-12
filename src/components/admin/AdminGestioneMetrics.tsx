import { useState } from "react";
import { Users, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { GestioneMetrics, GestioneDistribution, ReceiptDistributionBucket } from "@/hooks/useAdminStats";
import { cn } from "@/lib/utils";

interface AdminGestioneMetricsProps {
  data: GestioneMetrics;
  distribution?: GestioneDistribution;
}

/** Single source of truth for gestione keys */
const GESTIONI = ["separata", "artigiani", "commercianti"] as const;

const GESTIONE_LABELS: Record<string, string> = {
  separata: "Separata",
  artigiani: "Artigiani",
  commercianti: "Commercianti",
};

function DistributionChart({ buckets }: { buckets: ReceiptDistributionBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const lastBucket = buckets[buckets.length - 1];
  const isAtLimit = (bucket: string) => bucket === lastBucket?.bucket;

  return (
    <div className="space-y-1.5 pt-3 border-t">
      <p className="text-xs font-medium text-muted-foreground mb-2">Distribuzione incassi (anno corrente)</p>
      {buckets.map((b) => (
        <div key={b.bucket} className="flex items-center gap-2 text-sm">
          <span className="w-6 text-right text-muted-foreground tabular-nums">{b.bucket}</span>
          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
            <div
              className={cn(
                "h-full rounded transition-all",
                isAtLimit(b.bucket) ? "bg-amber-500" : "bg-primary/70"
              )}
              style={{ width: `${(b.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-20 text-right text-muted-foreground tabular-nums text-xs">
            {b.count} ({b.percent}%)
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminGestioneMetrics({ data, distribution }: AdminGestioneMetricsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const totalUsers = data.separata.users + data.artigiani.users + data.commercianti.users;

  if (totalUsers === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Distribuzione per Gestione INPS</h3>
        <p className="text-sm text-muted-foreground">
          Clicca su una gestione per vedere la distribuzione incassi
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {GESTIONI.map((key) => {
          const m = data[key];
          const pct = totalUsers > 0 ? Math.round((m.users / totalUsers) * 100) : 0;
          const isOpen = expanded.has(key);
          const buckets = distribution?.[key];

          return (
            <Card
              key={key}
              className={cn(
                "cursor-pointer transition-shadow hover:shadow-md",
                isOpen && "ring-2 ring-primary/30"
              )}
              onClick={() => setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              })}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                    aria-hidden="true"
                  >
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-0.5 overflow-hidden flex-1">
                    <p className="text-2xl font-bold tracking-tight truncate">{m.users}</p>
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {GESTIONE_LABELS[key]}
                    </p>
                    <p className="text-xs text-muted-foreground/80 truncate">
                      {pct}% del totale · Onboarding {m.onboardingRate}% · Pro {m.conversionRate}%
                    </p>
                    <p className="text-xs text-muted-foreground/80 truncate">
                      {m.receiptCount ?? 0} incassi totali
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-1",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>

                {isOpen && buckets && buckets.length > 0 && (
                  <DistributionChart buckets={buckets} />
                )}

                {isOpen && !buckets && (
                  <p className="text-xs text-muted-foreground pt-3 border-t mt-3">
                    Distribuzione non disponibile — ri-deploya la Edge Function admin-stats
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
