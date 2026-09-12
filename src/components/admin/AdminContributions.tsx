import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trophy, Plus, Eye, Download, Loader2 } from "lucide-react";
import { useAdminLeaderboard } from "@/hooks/useAdminLeaderboard";
import { useActionConfig } from "@/hooks/useActionConfig";
import { AdminLeaderboardTable } from "./AdminLeaderboardTable";
import { AdminAwardPointsDialog } from "./AdminAwardPointsDialog";
import { toast } from "sonner";
import { csvSafe, downloadCsv } from "@/lib/csv-export";
import { supabase } from "@/integrations/supabase/client";
import type { AdminLeaderboardEntry } from "@/hooks/useAdminLeaderboard";
import type { ActionConfig } from "@/lib/contribution-helpers";

async function fetchBreakdownForUser(userId: string) {
  const { data, error } = await supabase.rpc(
    "get_admin_user_contribution_breakdown" as any,
    { p_user_id: userId },
  );
  if (error) {
    console.warn(`[breakdown] RPC failed for user ${userId}:`, error.message);
    return [];
  }
  return (data as any[]) ?? [];
}

async function exportLeaderboardCsvWithBreakdown(
  entries: AdminLeaderboardEntry[],
  configs: ActionConfig[],
) {
  // Fetch breakdown for all users in parallel
  const breakdowns = await Promise.all(
    entries.map(async (e) => {
      const rows = await fetchBreakdownForUser(e.userId);
      const map = new Map<string, number>();
      for (const r of rows) {
        map.set(r.action_type, Number(r.total_points));
      }
      return map;
    }),
  );

  // Build header: base columns + one column per action type
  const actionColumns = configs.map((c) => csvSafe(c.label));
  const header = ["posizione", "codice", "nome", "punti", ...actionColumns].join(",");

  const rows = entries.map((e, i) => {
    const name = csvSafe(e.firstName ?? "\u2014");
    const breakdown = breakdowns[i];
    const actionValues = configs.map((c) => breakdown.get(c.actionType) ?? 0);
    return [e.rank, csvSafe(e.userCode), name, e.totalPts, ...actionValues].join(",");
  });

  const filename = `classifica_contributi_${new Date().toISOString().split("T")[0]}.csv`;
  downloadCsv(header, rows, filename);
}

export function AdminContributions() {
  const [showInternal, setShowInternal] = useState(false);
  const { data: entries, isLoading } = useAdminLeaderboard(50, showInternal);
  const { data: configs } = useActionConfig();
  const [awardOpen, setAwardOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!entries || entries.length === 0 || !configs) return;
    setExporting(true);
    try {
      await exportLeaderboardCsvWithBreakdown(entries, configs);
    } catch (err) {
      console.error("[export] CSV export failed:", err);
      toast.error("Errore durante l'esportazione CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-amber-500" />
          Classifica Contributi
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="show-internal-leaderboard"
              checked={showInternal}
              onCheckedChange={setShowInternal}
            />
            <label
              htmlFor="show-internal-leaderboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              Interni
            </label>
          </div>
          {entries && entries.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || !configs}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Esporta CSV
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAwardOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Assegna Punti
          </Button>
        </div>
      </CardHeader>

      <AdminAwardPointsDialog open={awardOpen} onOpenChange={setAwardOpen} />
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded" />
            ))}
          </div>
        ) : !entries || entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun contributo ancora registrato.
          </p>
        ) : (
          <AdminLeaderboardTable entries={entries} />
        )}
      </CardContent>
    </Card>
  );
}
