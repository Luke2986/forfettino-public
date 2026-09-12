import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ABVariantData {
  variantName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  medianCompletionSeconds: number;
  medianTtvMinutes: number;
  sampleSize: number;
}

export interface ABComparisonData {
  variants: ABVariantData[];
  zScore: number;
  isSignificant: boolean;
  totalSample: number;
}

type Range = "7d" | "30d" | "90d" | "all";

function rangeToParams(range: Range): {
  fromDate: string | null;
  toDate: string | null;
} {
  if (range === "all") {
    return { fromDate: null, toDate: null };
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { fromDate: fmt(fromDate), toDate: fmt(toDate) };
}

function mapResponse(json: any): ABComparisonData {
  return {
    variants: ((json?.variants as any[]) ?? []).map((v: any) => ({
      variantName: String(v.variant_name ?? ""),
      totalStarted: Number(v.total_started ?? 0),
      totalCompleted: Number(v.total_completed ?? 0),
      completionRate: Number(v.completion_rate ?? 0),
      medianCompletionSeconds: Number(v.median_completion_seconds ?? 0),
      medianTtvMinutes: Number(v.median_ttv_minutes ?? 0),
      sampleSize: Number(v.sample_size ?? 0),
    })),
    zScore: Number(json?.z_score ?? 0),
    isSignificant: Boolean(json?.is_significant),
    totalSample: Number(json?.total_sample ?? 0),
  };
}

export function useAdminABComparison(range: Range) {
  return useQuery<ABComparisonData>({
    queryKey: ["admin-ab-comparison", range],
    queryFn: async () => {
      const { fromDate, toDate } = rangeToParams(range);
      const { data, error } = await supabase.rpc(
        "get_ab_test_comparison" as any,
        {
          p_from_date: fromDate,
          p_to_date: toDate,
        },
      );
      if (error) throw error;
      return mapResponse(data);
    },
    staleTime: 300_000,
  });
}
