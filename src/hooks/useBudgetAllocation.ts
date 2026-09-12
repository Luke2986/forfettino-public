/**
 * Story 42.1 — Hook allocazione budget netto spendibile.
 *
 * Legge la configurazione da profile.budget_allocation (JSONB),
 * calcola gli importi via splitWithRemainder, espone save().
 */

import { useMemo, useCallback } from "react";
import { useProfile, useUpdateProfile } from "./useProfile";
import { useFiscalCalculations } from "./useFiscalCalculations";
import { splitWithRemainder } from "@/lib/money";
import {
  BUDGET_CATEGORIES,
  DEFAULT_ALLOCATION,
  isValidBudgetAllocation,
  type BudgetAllocation,
  type BudgetCategoryKey,
} from "@/lib/budget-constants";

export interface AllocationItem {
  key: BudgetCategoryKey;
  percentage: number;
  amount: number;
}

export interface UseBudgetAllocationReturn {
  /** Le 5 allocazioni con chiave, percentuale e importo */
  items: AllocationItem[];
  /** Configurazione percentuali attuale (default se nulla in DB) */
  config: BudgetAllocation;
  /** Netto spendibile corrente */
  nettoSpendibile: number;
  /** true se la config è quella default (nessuna personalizzazione salvata) */
  isDefault: boolean;
  /** Loading combinato (profile + fiscal) */
  isLoading: boolean;
  /** Salva una nuova configurazione in DB */
  save: (newConfig: BudgetAllocation) => Promise<void>;
  /** Salva i default in DB (ripristina) */
  resetToDefault: () => Promise<void>;
  /** Mutation in corso */
  isSaving: boolean;
}

export function useBudgetAllocation(): UseBudgetAllocationReturn {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { metrics, isLoading: fiscalLoading } = useFiscalCalculations();
  const updateProfile = useUpdateProfile();

  const isLoading = profileLoading || fiscalLoading;
  const nettoSpendibile = metrics?.spendable ?? 0;

  // Legge config da DB oppure usa default
  const rawConfig = profile?.budget_allocation;
  const isDefault = !rawConfig || !isValidBudgetAllocation(rawConfig);
  const config: BudgetAllocation = isDefault ? DEFAULT_ALLOCATION : (rawConfig as BudgetAllocation);

  // Calcola importi centesimi-safe — splitWithRemainder garantisce somma = totale
  const items = useMemo<AllocationItem[]>(() => {
    const percentages = BUDGET_CATEGORIES.map((key) => config[key]);
    const amounts = splitWithRemainder(nettoSpendibile, percentages);

    return BUDGET_CATEGORIES.map((key, i) => ({
      key,
      percentage: config[key],
      amount: amounts[i],
    }));
  }, [config, nettoSpendibile]);

  const save = useCallback(
    async (newConfig: BudgetAllocation) => {
      await updateProfile.mutateAsync({ budget_allocation: newConfig });
    },
    [updateProfile]
  );

  const resetToDefault = useCallback(async () => {
    await updateProfile.mutateAsync({ budget_allocation: null });
  }, [updateProfile]);

  return {
    items,
    config,
    nettoSpendibile,
    isDefault,
    isLoading,
    save,
    resetToDefault,
    isSaving: updateProfile.isPending,
  };
}
