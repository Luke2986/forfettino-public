import { BarChart3, UserCheck, Users, UsersRound } from "lucide-react";
import { AdminStatCard } from "./AdminStatCard";
import { AdminActivityChart } from "./AdminActivityChart";
import { calcChange } from "./adminActivityUtils";
import type { ActivityKpi, TrendData } from "@/hooks/useAdminStats";

interface AdminUserActivityReportProps {
  activityKpi?: ActivityKpi;
  signupTrend?: TrendData;
  activityTrend?: TrendData;
}

function formatChange(change: number, label: string): string {
  if (change === 0) return `= vs ${label}`;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change}% vs ${label}`;
}

export function AdminUserActivityReport({
  activityKpi,
  signupTrend,
  activityTrend,
}: AdminUserActivityReportProps) {
  const dauChange = activityKpi ? calcChange(activityKpi.dau, activityKpi.dauPrev) : 0;
  const wauChange = activityKpi ? calcChange(activityKpi.wau, activityKpi.wauPrev) : 0;
  const mauChange = activityKpi ? calcChange(activityKpi.mau, activityKpi.mauPrev) : 0;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-teal-600" />
        <h2 className="text-lg font-semibold">Report Attività Utenti</h2>
      </div>

      {/* KPI Row: DAU / WAU / MAU */}
      {activityKpi && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <AdminStatCard
            icon={<UserCheck className="h-5 w-5 text-teal-500" />}
            label="Utenti Oggi (DAU)"
            value={activityKpi.dau}
            subLabel={formatChange(dauChange, "ieri")}
            iconClassName="bg-teal-500/10"
          />
          <AdminStatCard
            icon={<Users className="h-5 w-5 text-teal-500" />}
            label="Ultimi 7gg (WAU)"
            value={activityKpi.wau}
            subLabel={formatChange(wauChange, "sett. scorsa")}
            iconClassName="bg-teal-500/10"
          />
          <AdminStatCard
            icon={<UsersRound className="h-5 w-5 text-teal-500" />}
            label="Ultimi 30gg (MAU)"
            value={activityKpi.mau}
            subLabel={formatChange(mauChange, "mese scorso")}
            iconClassName="bg-teal-500/10"
          />
        </div>
      )}

      {/* Chart: Registrazioni (nuovi utenti) */}
      {signupTrend && (
        <AdminActivityChart
          title="Nuove Registrazioni"
          description="Nuovi utenti registrati"
          data={signupTrend}
          chartType="bar"
          color="hsl(var(--chart-1))"
          dataLabel="Registrazioni"
          defaultGranularity="monthly"
        />
      )}

      {/* Chart: Attività (utenti attivi) */}
      {activityTrend && (
        <AdminActivityChart
          title="Utenti Attivi"
          description="Utenti unici con sessione"
          data={activityTrend}
          chartType="area"
          color="hsl(173 65% 30%)"
          dataLabel="Utenti attivi"
          defaultGranularity="daily"
        />
      )}
    </div>
  );
}
