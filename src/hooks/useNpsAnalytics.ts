import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NpsResponseRow {
  id: string;
  score: number;
  comment: string | null;
  trigger_source: string;
  campaign_id: string | null;
  created_at: string;
  user_code: string;
}

export interface NpsBreakdown {
  promoters: { count: number; pct: number };
  passives: { count: number; pct: number };
  detractors: { count: number; pct: number };
  total: number;
}

export interface NpsMonthlyTrend {
  month: string;
  npsScore: number;
  count: number;
}

function calcNpsScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

function calcBreakdown(scores: number[]): NpsBreakdown {
  const total = scores.length;
  if (total === 0) {
    return {
      promoters: { count: 0, pct: 0 },
      passives: { count: 0, pct: 0 },
      detractors: { count: 0, pct: 0 },
      total: 0,
    };
  }
  const pCount = scores.filter((s) => s >= 9).length;
  const paCount = scores.filter((s) => s >= 7 && s <= 8).length;
  const dCount = scores.filter((s) => s <= 6).length;
  return {
    promoters: { count: pCount, pct: Math.round((pCount / total) * 100) },
    passives: { count: paCount, pct: Math.round((paCount / total) * 100) },
    detractors: { count: dCount, pct: Math.round((dCount / total) * 100) },
    total,
  };
}

function calcMonthlyTrend(responses: NpsResponseRow[]): NpsMonthlyTrend[] {
  const byMonth = new Map<string, number[]>();
  for (const r of responses) {
    const month = r.created_at.slice(0, 7); // "2026-03"
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(r.score);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      month,
      npsScore: calcNpsScore(scores),
      count: scores.length,
    }));
}

export function useNpsAnalytics() {
  const { data: rawData, isLoading, error } = useQuery<NpsResponseRow[]>({
    queryKey: ["admin-nps-analytics"],
    queryFn: async () => {
      // Fetch NPS responses with user_code join
      // TODO: remove `as any` once Supabase generated types include survey_responses
      const { data, error: fetchError } = await (supabase as any)
        .from("survey_responses")
        .select("id, score, comment, trigger_source, campaign_id, created_at, user_id")
        .eq("survey_key", "nps_v1")
        .not("score", "is", null)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      if (!data || data.length === 0) return [];

      // Get user codes separately (same pattern as PricingSurveyResults)
      const userIds = [...new Set(data.map((r: any) => r.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, user_code")
        .in("user_id", userIds);

      const codeMap = new Map<string, string>();
      profiles?.forEach((p: any) => codeMap.set(p.user_id, p.user_code));

      return data.map((r: any) => ({
        id: r.id,
        score: r.score as number,
        comment: r.comment,
        trigger_source: r.trigger_source || "",
        campaign_id: r.campaign_id,
        created_at: r.created_at,
        user_code: codeMap.get(r.user_id) || "???",
      })) as NpsResponseRow[];
    },
    staleTime: 60_000, // 1min — analytics data
  });

  const responses = rawData ?? [];

  const npsScore = useMemo(
    () => calcNpsScore(responses.map((r) => r.score)),
    [responses],
  );

  const breakdown = useMemo(
    () => calcBreakdown(responses.map((r) => r.score)),
    [responses],
  );

  const monthlyTrend = useMemo(() => calcMonthlyTrend(responses), [responses]);

  const meanScore = useMemo(() => {
    if (responses.length === 0) return 0;
    return responses.reduce((sum, r) => sum + r.score, 0) / responses.length;
  }, [responses]);

  return {
    responses,
    npsScore,
    breakdown,
    monthlyTrend,
    meanScore,
    isLoading,
    error,
  };
}
