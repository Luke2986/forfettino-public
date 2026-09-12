import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { Skeleton } from "@/components/ui/skeleton";

interface CostCoverageCardProps {
  monthlyTotal: number;
  yearlyTotal: number;
  coveredAmount: number;
  spendable: number;
  yearlyToolCost: number;
  isMetricsLoading: boolean;
}

export function CostCoverageCard({
  monthlyTotal,
  yearlyTotal,
  coveredAmount,
  spendable,
  yearlyToolCost,
  isMetricsLoading,
}: CostCoverageCardProps) {
  if (yearlyTotal === 0) return null;

  if (isMetricsLoading) {
    return (
      <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]">
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-2 w-full mb-3" />
        <Skeleton className="h-4 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  const coveragePercent = (coveredAmount / yearlyTotal) * 100;
  const coveredMonths = Math.min(Math.floor((coveragePercent / 100) * 12), 12);
  const toolCostRatio = spendable > 0 ? (yearlyToolCost / (spendable + yearlyToolCost)) * 100 : 0;

  const isFullyCovered = coveragePercent >= 100;
  const isZeroIncassi = spendable === 0 && yearlyToolCost === 0;

  const barColor = isFullyCovered
    ? "bg-teal-500"
    : coveragePercent >= 50
      ? "bg-amber-500"
      : "bg-red-400";

  const barWidth = Math.min(coveragePercent, 100);

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]">
      <p className="text-sm font-semibold text-slate-900 mb-3">Copertura Costi Fissi</p>

      {/* Progress bar + amounts */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-sm text-slate-600 tabular-nums whitespace-nowrap">
          {formatCurrency(coveredAmount)} / {formatCurrency(yearlyTotal)}
        </span>
      </div>

      {/* Contextual phrase */}
      {isZeroIncassi ? (
        <p className="text-sm text-slate-500 mb-2">
          Registra il primo incasso per vedere la copertura
        </p>
      ) : isFullyCovered ? (
        <p className="text-sm text-teal-700 mb-2">
          I tuoi incassi coprono tutti i costi fissi annui
        </p>
      ) : (
        <p className="text-sm text-slate-700 mb-2">
          Con i tuoi incassi attuali hai coperto {formatCurrency(coveredAmount)} dei{" "}
          {formatCurrency(yearlyTotal)} annui di costi fissi — equivale a {coveredMonths}{" "}
          {coveredMonths === 1 ? "mese" : "mesi"} su 12
        </p>
      )}

      {/* Stat row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
        <span>{formatCurrency(monthlyTotal)}/mese</span>
        <span>·</span>
        <span>{Math.round(coveragePercent)}% coperto</span>
        {spendable > 0 && (
          <>
            <span>·</span>
            <span>{Math.round(toolCostRatio)}% dello spendibile</span>
          </>
        )}
      </div>
    </div>
  );
}
