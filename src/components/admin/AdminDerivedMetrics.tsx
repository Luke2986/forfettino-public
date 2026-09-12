import { Repeat, FileBarChart, Download } from "lucide-react";
import { AdminStatCard } from "./AdminStatCard";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv-export";
import type { DerivedMetrics, ReceiptDistributionBucket } from "@/hooks/useAdminStats";

interface AdminDerivedMetricsProps {
  data: DerivedMetrics;
}

function exportDistributionCsv(distribution: ReceiptDistributionBucket[]) {
  const header = "bucket,utenti,percentuale";
  const rows = distribution.map((b) => `${b.bucket},${b.count},${b.percent}`);
  const filename = `distribuzione_incassi_${new Date().toISOString().split("T")[0]}.csv`;
  downloadCsv(header, rows, filename);
}

export function AdminDerivedMetrics({ data }: AdminDerivedMetricsProps) {
  const distribution = data.freeReceiptDistribution ?? [];
  const maxCount = Math.max(...distribution.map((b) => b.count), 1);
  // The last bucket is always the "at limit" bucket (e.g. "5+")
  const lastBucket = distribution.length > 0 ? distribution[distribution.length - 1] : null;
  const atLimitCount = lastBucket?.count ?? 0;
  const atLimitPercent = lastBucket?.percent ?? 0;
  const atLimitLabel = lastBucket?.bucket ?? "";
  const isAtLimitBucket = (bucket: string) => bucket === atLimitLabel;
  const totalFreeUsers = distribution.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Metriche Derivate</h3>
        <p className="text-sm text-muted-foreground">
          Retention e frequenza — calcolate su dati aggregati
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <AdminStatCard
          icon={<Repeat className="h-5 w-5 text-primary" />}
          label="Retention Rate"
          value={`${data.retentionRate}%`}
          subLabel="Utenti attivi in 2+ mesi"
        />
        <AdminStatCard
          icon={<FileBarChart className="h-5 w-5 text-primary" />}
          label="Media Incassi / Utente"
          value={data.avgReceiptsPerUser}
          subLabel="Per utente attivo"
        />
      </div>

      {distribution.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Distribuzione Incassi — Utenti Free</h4>
              <p className="text-xs text-muted-foreground">Anno corrente · {totalFreeUsers} utenti free</p>
            </div>
            <div className="flex items-center gap-2">
              {atLimitCount > 0 && (
                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded-md">
                  {atLimitCount} al limite ({atLimitPercent}%)
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportDistributionCsv(distribution)}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {distribution.map((b) => (
              <div key={b.bucket} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-right text-muted-foreground tabular-nums">{b.bucket}</span>
                <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all ${
                      isAtLimitBucket(b.bucket) ? "bg-amber-500" : "bg-primary/70"
                    }`}
                    style={{ width: `${(b.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right text-muted-foreground tabular-nums text-xs">
                  {b.count} ({b.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
