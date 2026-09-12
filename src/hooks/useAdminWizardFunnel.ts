import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---

export interface FunnelStep {
  stepId: string;
  stepOrder: number;
  entered: number;
  completed: number;
  completionRate: number;
  dropOffRate: number;
}

export interface StepTime {
  stepId: string;
  avgSeconds: number;
  medianSeconds: number;
  p90Seconds: number;
}

export interface AbandonmentStep {
  lastStepId: string;
  count: number;
  pct: number;
}

export interface FunnelSummary {
  totalStarted: number;
  totalCompleted: number;
  overallCompletionRate: number;
  topDropOffStep: string | null;
}

export interface WizardFunnelData {
  funnel: FunnelStep[];
  timePerStep: StepTime[];
  abandonment: AbandonmentStep[];
  summary: FunnelSummary;
}

// --- Range helpers (same pattern as useAdminTTVStats) ---

export type Range = "7d" | "30d" | "90d" | "all";

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

// --- Response mapping ---

function mapResponse(json: any): WizardFunnelData {
  return {
    funnel: ((json?.funnel as any[]) ?? []).map((f: any) => ({
      stepId: String(f.step_id ?? ""),
      stepOrder: Number(f.step_order ?? 0),
      entered: Number(f.entered ?? 0),
      completed: Number(f.completed ?? 0),
      completionRate: Number(f.completion_rate ?? 0),
      dropOffRate: Number(f.drop_off_rate ?? 0),
    })),
    timePerStep: ((json?.time_per_step as any[]) ?? []).map((t: any) => ({
      stepId: String(t.step_id ?? ""),
      avgSeconds: Number(t.avg_seconds ?? 0),
      medianSeconds: Number(t.median_seconds ?? 0),
      p90Seconds: Number(t.p90_seconds ?? 0),
    })),
    abandonment: ((json?.abandonment as any[]) ?? []).map((a: any) => ({
      lastStepId: String(a.last_step_id ?? ""),
      count: Number(a.count ?? 0),
      pct: Number(a.pct ?? 0),
    })),
    summary: {
      totalStarted: Number(json?.summary?.total_started ?? 0),
      totalCompleted: Number(json?.summary?.total_completed ?? 0),
      overallCompletionRate: Number(json?.summary?.overall_completion_rate ?? 0),
      topDropOffStep: json?.summary?.top_drop_off_step ?? null,
    },
  };
}

// --- Hook ---

export function useAdminWizardFunnel(range: Range, gestioneFilter: string | null, variantFilter: string | null = null) {
  return useQuery<WizardFunnelData>({
    queryKey: ["admin-wizard-funnel", range, gestioneFilter, variantFilter],
    queryFn: async () => {
      const { fromDate, toDate } = rangeToParams(range);
      const { data, error } = await supabase.rpc(
        "get_wizard_funnel" as any,
        {
          p_from_date: fromDate,
          p_to_date: toDate,
          p_gestione_filter: gestioneFilter,
          p_wizard_variant: variantFilter,
        },
      );
      if (error) throw error;
      return mapResponse(data);
    },
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  });
}
