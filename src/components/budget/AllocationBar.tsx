/**
 * Story 42.1 — Barra segmentata orizzontale allocazione budget.
 * 5 segmenti colorati proporzionali alle percentuali.
 * UX spec: ANS-2
 */

import { BUDGET_CATEGORIES, CATEGORY_BAR_COLORS, CATEGORY_LABELS } from "@/lib/budget-constants";
import type { AllocationItem } from "@/hooks/useBudgetAllocation";

interface AllocationBarProps {
  items: AllocationItem[];
}

export function AllocationBar({ items }: AllocationBarProps) {
  const ariaLabel = items
    .map((item) => `${CATEGORY_LABELS[item.key]} ${item.percentage}%`)
    .join(", ");

  return (
    <div
      role="img"
      aria-label={`Distribuzione netto spendibile: ${ariaLabel}`}
      className="flex overflow-hidden rounded-full bg-slate-100 h-3"
    >
      {items.map((item) =>
        item.percentage > 0 ? (
          <div
            key={item.key}
            className={`${CATEGORY_BAR_COLORS[item.key]} transition-all duration-300`}
            style={{ width: `${item.percentage}%` }}
            aria-hidden="true"
          />
        ) : null
      )}
    </div>
  );
}
