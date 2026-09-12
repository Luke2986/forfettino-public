import { CheckCircle2, Circle, Trophy, Gift, Crown, Star, Award } from "lucide-react";
import { Milestone, getMilestoneProgress } from "@/lib/contribution-helpers";

interface MilestoneProgressProps {
  milestones: Milestone[];
  totalPts: number;
  isLoading?: boolean;
}

const LEVEL_ICONS: Record<number, React.ElementType> = {
  1: Star,
  2: Award,
  3: Trophy,
  4: Crown,
  5: Gift,
};

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  2: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  3: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  4: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  5: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
};

export function MilestoneProgress({ milestones, totalPts, isLoading }: MilestoneProgressProps) {
  const { current, next, percent } = getMilestoneProgress(totalPts, milestones);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (milestones.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">Traguardi</p>
      <div className="space-y-1.5">
        {milestones.map((m) => {
          const reached = totalPts >= m.pointsRequired;
          const isNext = next?.id === m.id;
          const Icon = LEVEL_ICONS[m.level] ?? Star;
          const colors = LEVEL_COLORS[m.level] ?? LEVEL_COLORS[1];

          return (
            <div key={m.id}>
              <div
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  reached
                    ? `${colors.bg} border ${colors.border}`
                    : isNext
                      ? "bg-slate-50 border border-slate-200"
                      : "bg-white"
                }`}
                aria-label={`${m.name}: ${reached ? "Raggiunto" : "Non raggiunto"} — ${m.pointsRequired} punti richiesti`}
              >
                {/* Status icon */}
                {reached ? (
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${colors.text}`} aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                )}

                {/* Level icon */}
                <div className={`shrink-0 p-1.5 rounded-md ${reached ? colors.bg : "bg-slate-50"}`}>
                  <Icon className={`h-4 w-4 ${reached ? colors.text : "text-slate-500"}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm font-medium ${reached ? colors.text : "text-slate-600"}`}>
                      {m.name}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums shrink-0">
                      {m.pointsRequired} pt
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{m.rewardLabel}</p>
                </div>
              </div>

              {/* Progress bar toward next milestone */}
              {isNext && (
                <div className="mx-2.5 mt-1.5 mb-0.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>{totalPts} pt</span>
                    <span>{m.pointsRequired} pt</span>
                  </div>
                  <div
                    className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progresso verso ${m.name}: ${Math.round(percent)}%`}
                  >
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
