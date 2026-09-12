import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { BarChart3, Users, Eye, TrendingUp, AlertTriangle } from "lucide-react";
import { useAdminBenchmarkStats } from "@/hooks/useAdminBenchmarkStats";
import { formatJobTitle } from "@/lib/benchmark-engine";

export function BenchmarkUsageStats() {
  const { data, isLoading, error } = useAdminBenchmarkStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base">Comparatore Tariffe</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Errore nel caricamento delle statistiche.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalViews === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base">Comparatore Tariffe</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun utente ha ancora utilizzato il comparatore.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <CardTitle className="text-base">Comparatore Tariffe</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminStatCard
            icon={<Eye className="h-5 w-5 text-indigo-500" />}
            label="Visualizzazioni"
            value={data.totalViews}
            subLabel={`${data.uniqueUsers} utenti unici`}
            iconClassName="bg-indigo-500/10"
          />
          <AdminStatCard
            icon={<Users className="h-5 w-5 text-blue-500" />}
            label="Utenti Unici"
            value={data.uniqueUsers}
            iconClassName="bg-blue-500/10"
          />
          {data.avgPersonalRate !== null && (
            <AdminStatCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
              label="Tariffa Media Implicita"
              value={`€${data.avgPersonalRate.toFixed(0)}/ora`}
              subLabel={
                data.medianPersonalRate !== null
                  ? `Mediana: €${data.medianPersonalRate.toFixed(0)}/ora`
                  : undefined
              }
              iconClassName="bg-emerald-500/10"
            />
          )}
        </div>

        {/* Top 10 roles table */}
        {data.topRoles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top 10 Ruoli Cercati</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ruolo</TableHead>
                    <TableHead className="text-right">Ricerche</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topRoles.map((role) => (
                    <TableRow key={role.jobTitle}>
                      <TableCell className="font-medium">
                        {formatJobTitle(role.jobTitle)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {role.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
