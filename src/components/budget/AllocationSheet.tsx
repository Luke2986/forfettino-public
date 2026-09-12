/**
 * Story 42.1 — Sheet personalizzazione percentuali allocazione.
 * 5 input numerici con validazione live del totale.
 * UX spec: ANS-3
 */

import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  BUDGET_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DOT_COLORS,
  DEFAULT_ALLOCATION,
  allocationTotal,
  type BudgetAllocation,
} from "@/lib/budget-constants";

interface AllocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig: BudgetAllocation;
  onSave: (config: BudgetAllocation) => Promise<void>;
  isSaving: boolean;
}

export function AllocationSheet({
  open,
  onOpenChange,
  currentConfig,
  onSave,
  isSaving,
}: AllocationSheetProps) {
  const [draft, setDraft] = useState<BudgetAllocation>({ ...currentConfig });
  const total = allocationTotal(draft);
  const isValid = total === 100;

  // Sincronizza draft quando si apre il sheet
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setDraft({ ...currentConfig });
      onOpenChange(next);
    },
    [currentConfig, onOpenChange]
  );

  const handleChange = useCallback((key: keyof BudgetAllocation, value: string) => {
    const num = value === "" ? 0 : Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    setDraft((prev) => ({ ...prev, [key]: num }));
  }, []);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULT_ALLOCATION });
  }, []);

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    await onSave(draft);
    onOpenChange(false);
  }, [draft, isValid, onSave, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Personalizza allocazione</SheetTitle>
          <SheetDescription>Le percentuali devono sommare a 100%</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {BUDGET_CATEGORIES.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${CATEGORY_DOT_COLORS[key]}`}
                aria-hidden="true"
              />
              <label htmlFor={`alloc-${key}`} className="text-sm font-medium text-slate-900 flex-1">
                {CATEGORY_LABELS[key]}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id={`alloc-${key}`}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={draft[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  aria-invalid={!isValid}
                  aria-describedby="alloc-total"
                  className="w-16 text-right text-sm font-medium border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent tabular-nums"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totale live */}
        <div
          id="alloc-total"
          role="status"
          aria-live="polite"
          className={`mt-5 flex items-center gap-2 text-sm font-bold ${
            isValid ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {isValid ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>Totale: {total}%</span>
          {!isValid && <span className="font-normal">— Deve essere 100%</span>}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-sm">
            Ripristina default
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            aria-disabled={!isValid || isSaving}
            aria-describedby={!isValid ? "alloc-total" : undefined}
            size="sm"
          >
            {isSaving ? "Salvo..." : "Salva"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
