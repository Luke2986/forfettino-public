import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeBarSegments,
  type ContributionBreakdown,
  type ActionConfig,
} from "@/lib/contribution-helpers";

interface ContributionProgressBarProps {
  breakdown: ContributionBreakdown;
  configs: ActionConfig[];
  /** When provided, the bar fills proportionally to this goal (e.g., max milestone pts) */
  maxPts?: number;
}

export function ContributionProgressBar({ breakdown, configs, maxPts }: ContributionProgressBarProps) {
  const segments = computeBarSegments(breakdown, configs, maxPts);

  if (segments.length === 0) {
    return (
      <div className="w-full">
        <div className="flex h-4 w-full rounded-full overflow-hidden bg-slate-100" />
        <p className="text-xs text-slate-500 mt-1">Nessun punto ancora</p>
      </div>
    );
  }

  // Build label lookup from configs
  const labelMap = new Map(configs.map((c) => [c.actionType, c.label]));

  const ariaLabel = segments
    .map((s) => `${labelMap.get(s.action) ?? s.action} ${s.percent}%`)
    .join(", ");

  return (
    <div className="w-full">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex h-4 w-full rounded-full overflow-hidden bg-slate-100"
              role="img"
              aria-label={`Ripartizione punti: ${ariaLabel}`}
            >
              {segments.map((seg) => (
                <div
                  key={seg.action}
                  className={`${seg.color} transition-all duration-500 ease-out`}
                  style={{ width: `${seg.percent}%` }}
                />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-sm">
              {segments.map((seg) => (
                <p key={seg.action}>
                  <span
                    className={`inline-block w-3 h-3 rounded-sm ${seg.color} mr-1 align-middle`}
                  />
                  {labelMap.get(seg.action) ?? seg.action}: {seg.points} pt ({seg.percent}%)
                </p>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
