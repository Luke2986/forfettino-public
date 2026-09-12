import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ContributionProgressBar } from "./ContributionProgressBar";
import { ContributionBreakdownList } from "./ContributionBreakdownList";
import type { ContributionBreakdown, ActionConfig } from "@/lib/contribution-helpers";

interface ContributionPersonalCardProps {
  breakdown: ContributionBreakdown;
  configs: ActionConfig[];
  isLoading?: boolean;
  /** Max milestone points — bar fills proportionally to this goal */
  maxPts?: number;
}

export function ContributionPersonalCard({
  breakdown,
  configs,
  isLoading,
  maxPts,
}: ContributionPersonalCardProps) {
  const [displayCount, setDisplayCount] = useState(0);

  // Count-up animation (pattern from UserCountBadge)
  useEffect(() => {
    if (!breakdown.totalPts) {
      setDisplayCount(0);
      return;
    }

    // Reset immediately so animation always restarts from 0 on rapid changes
    setDisplayCount(0);

    const duration = 1000;
    const steps = 30;
    const increment = breakdown.totalPts / steps;
    const stepTime = duration / steps;
    let current = 0;
    let cancelled = false;

    const timer = setInterval(() => {
      if (cancelled) return;
      current += increment;
      if (current >= breakdown.totalPts) {
        setDisplayCount(breakdown.totalPts);
        clearInterval(timer);
      } else {
        setDisplayCount(Math.floor(current));
      }
    }, stepTime);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [breakdown.totalPts]);

  if (isLoading) {
    return (
      <Card className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <CardContent className="p-0">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-24 bg-slate-100 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded-full" />
            <div className="h-4 w-32 bg-slate-100 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-xl border border-slate-100 shadow-sm border-t-[3px] border-teal-500 p-4">
      <CardContent className="p-0">
        {/* Header: points */}
        <div>
          <p className="text-3xl font-bold text-slate-800 tabular-nums leading-tight">
            {displayCount}
            <span className="text-base font-medium text-slate-500 ml-1">pt</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Punti accumulati</p>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <ContributionProgressBar breakdown={breakdown} configs={configs} maxPts={maxPts} />
        </div>

        {/* Breakdown list */}
        <ContributionBreakdownList breakdown={breakdown} configs={configs} />
      </CardContent>
    </Card>
  );
}
