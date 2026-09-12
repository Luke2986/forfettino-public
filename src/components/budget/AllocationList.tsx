/**
 * Story 42.1 — Lista categorie allocazione budget.
 * dl/dt/dd semantico con dot colorato, nome, percentuale e importo.
 * UX spec: ANS-1
 */

import { CATEGORY_DESCRIPTIONS, CATEGORY_DISPLAY_LABELS, CATEGORY_DOT_COLORS } from "@/lib/budget-constants";
import { formatCurrency } from "@/lib/money";
import type { AllocationItem } from "@/hooks/useBudgetAllocation";

interface AllocationListProps {
  items: AllocationItem[];
}

export function AllocationList({ items }: AllocationListProps) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <dt className="flex items-start gap-2.5 min-w-0">
            <span
              className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${CATEGORY_DOT_COLORS[item.key]}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <span className="text-sm font-medium text-slate-900">
                {CATEGORY_DISPLAY_LABELS[item.key]}
              </span>
              <p className="text-sm text-slate-600 mt-0.5">
                {item.percentage}% — {CATEGORY_DESCRIPTIONS[item.key]}
              </p>
            </div>
          </dt>
          <dd className="text-sm font-bold text-slate-800 tabular-nums shrink-0">
            {formatCurrency(item.amount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
