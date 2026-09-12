import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BenchmarkUsageData {
  totalViews: number;
  uniqueUsers: number;
  topRoles: { jobTitle: string; count: number }[];
  avgPersonalRate: number | null;
  medianPersonalRate: number | null;
}

export interface EventLogRow {
  user_id: string;
  props: Record<string, unknown> | null;
}

export function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregate(rows: EventLogRow[]): BenchmarkUsageData {
  if (rows.length === 0) {
    return {
      totalViews: 0,
      uniqueUsers: 0,
      topRoles: [],
      avgPersonalRate: null,
      medianPersonalRate: null,
    };
  }

  const totalViews = rows.length;
  const uniqueUsers = new Set(rows.map((r) => r.user_id)).size;

  // Top 10 roles
  const roleCounts = new Map<string, number>();
  rows.forEach((row) => {
    const jt = row.props?.jobTitle as string | undefined;
    if (jt) roleCounts.set(jt, (roleCounts.get(jt) || 0) + 1);
  });
  const topRoles = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([jobTitle, count]) => ({ jobTitle, count }));

  // Personal rates
  const rates: number[] = [];
  rows.forEach((row) => {
    const rate = row.props?.personalHourlyRate;
    if (typeof rate === "number" && rate > 0) rates.push(rate);
  });

  const avgPersonalRate =
    rates.length > 0
      ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
      : null;
  const medianPersonalRate =
    rates.length > 0 ? Math.round(computeMedian(rates) * 100) / 100 : null;

  return { totalViews, uniqueUsers, topRoles, avgPersonalRate, medianPersonalRate };
}

export function useAdminBenchmarkStats() {
  return useQuery({
    queryKey: ["admin-benchmark-stats"],
    queryFn: async (): Promise<BenchmarkUsageData> => {
      const { data, error } = await (supabase as any)
        .from("event_logs")
        .select("user_id, props")
        .eq("event_name", "benchmark_viewed");

      if (error) {
        throw new Error(`Errore caricamento statistiche benchmark: ${error.message}`);
      }

      return aggregate((data ?? []) as EventLogRow[]);
    },
    staleTime: 2 * 60_000,
  });
}
