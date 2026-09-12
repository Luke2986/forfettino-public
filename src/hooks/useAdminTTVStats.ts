import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TTVStats {
  medianMinutes: number;
  p90Minutes: number;
  p95Minutes: number;
  totalActivated: number;
  totalSignups: number;
  activationRate: number;
  byGestione: {
    gestione: string;
    medianMinutes: number;
    p90Minutes: number;
    userCount: number;
  }[];
  dailyTrend: {
    day: string;
    medianMinutes: number | null;
    activatedCount: number;
  }[];
}

type Range = "7d" | "30d" | "90d" | "all";

function rangeToParams(range: Range): {
  fromDate: string | null;
  toDate: string | null;
  trendDays: number;
} {
  if (range === "all") {
    return { fromDate: null, toDate: null, trendDays: 90 };
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    fromDate: fmt(fromDate),
    toDate: fmt(toDate),
    trendDays: days,
  };
}

function mapResponseToTTVStats(json: any): TTVStats {
  const s = json?.stats ?? {};
  return {
    medianMinutes: Number(s.median_minutes ?? 0),
    p90Minutes: Number(s.p90_minutes ?? 0),
    p95Minutes: Number(s.p95_minutes ?? 0),
    totalActivated: Number(s.total_activated ?? 0),
    totalSignups: Number(s.total_signups ?? 0),
    activationRate: Number(s.activation_rate ?? 0),
    byGestione: ((json?.by_gestione as any[]) ?? []).map((g: any) => ({
      gestione: String(g.gestione ?? ""),
      medianMinutes: Number(g.median_minutes ?? 0),
      p90Minutes: Number(g.p90_minutes ?? 0),
      userCount: Number(g.user_count ?? 0),
    })),
    dailyTrend: ((json?.daily_trend as any[]) ?? []).map((d: any) => ({
      day: String(d.day ?? ""),
      medianMinutes: d.median_minutes != null ? Number(d.median_minutes) : null,
      activatedCount: Number(d.activated_count ?? 0),
    })),
  };
}

export function useAdminTTVStats(range: Range, variantFilter: string | null = null) {
  return useQuery<TTVStats>({
    queryKey: ["admin-ttv-stats", range, variantFilter],
    queryFn: async () => {
      const { fromDate, toDate, trendDays } = rangeToParams(range);
      const { data, error } = await supabase.rpc(
        "get_ttv_dashboard" as any,
        {
          p_from_date: fromDate,
          p_to_date: toDate,
          p_trend_days: trendDays,
          p_wizard_variant: variantFilter,
        },
      );
      if (error) throw error;
      return mapResponseToTTVStats(data);
    },
    staleTime: 300_000,
  });
}
