/**
 * Story 55.4 — Insight automatici per analisi incrociata.
 * Max 3 insight deterministici derivati da funzioni pure.
 */

import { useMemo } from "react";
import { TrendingUp, Lightbulb, Users } from "lucide-react";
import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";
import {
  getTopServiceInsight,
  getCrossSellInsight,
  getMostDiversifiedInsight,
  type Insight,
} from "@/lib/cross-analytics";

const ICON_MAP = {
  TrendingUp,
  Lightbulb,
  Users,
} as const;

interface Props {
  data: CrossAnalysisData;
}

export function CrossInsights({ data }: Props) {
  const { clients, categories, matrix, totals } = data;

  const insights = useMemo(() => {
    const results: Insight[] = [];

    const top = getTopServiceInsight(categories, totals.grand);
    if (top) results.push(top);

    const cross = getCrossSellInsight(clients, categories, matrix, totals.grand);
    if (cross) results.push(cross);

    const diversified = getMostDiversifiedInsight(clients, matrix);
    if (diversified) results.push(diversified);

    return results;
  }, [clients, categories, matrix, totals]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => {
        const Icon = ICON_MAP[insight.icon];
        return (
          <div
            key={i}
            className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3"
          >
            <Icon className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="text-sm text-slate-700">{insight.text}</span>
          </div>
        );
      })}
    </div>
  );
}
