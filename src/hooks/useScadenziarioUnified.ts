import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];
type InstallmentDeadlineRow = Database["public"]["Tables"]["installment_deadlines"]["Row"];
type InstallmentPlanRow = Database["public"]["Tables"]["installment_plans"]["Row"];

export type ScadenziarioItem =
  | { type: "tax"; data: TaxScheduleRow }
  | { type: "installment"; data: InstallmentDeadlineRow & { plan: InstallmentPlanRow } };

export function useScadenziarioUnified(paymentYear: number) {
  const { user } = useAuth();

  // Fetch tax_schedule (existing query)
  const taxQuery = useQuery({
    queryKey: ["tax_schedule", user?.id, paymentYear.toString()],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .eq("payment_year", paymentYear)
        .order("due_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch unpaid installment_deadlines for the year
  const deadlinesQuery = useQuery({
    queryKey: ["installment_deadlines_scadenziario", user?.id, paymentYear],
    queryFn: async () => {
      if (!user) return [];
      const startDate = `${paymentYear}-01-01`;
      const endDate = `${paymentYear}-12-31`;
      const { data, error } = await supabase
        .from("installment_deadlines" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("is_paid", false)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date");
      if (error) throw error;
      return (data || []) as unknown as InstallmentDeadlineRow[];
    },
    enabled: !!user,
  });

  // Fetch associated plans for the deadlines
  const planIds = useMemo(() => {
    const ids = new Set<string>();
    (deadlinesQuery.data || []).forEach((d) => ids.add(d.installment_plan_id));
    return Array.from(ids);
  }, [deadlinesQuery.data]);

  const plansQuery = useQuery({
    queryKey: ["installment_plans_for_scadenziario", user?.id, planIds],
    queryFn: async () => {
      if (!user || planIds.length === 0) return [];
      const { data, error } = await supabase
        .from("installment_plans" as any)
        .select("*")
        .in("id", planIds);
      if (error) throw error;
      return (data || []) as unknown as InstallmentPlanRow[];
    },
    enabled: !!user && planIds.length > 0,
  });

  const plansMap = useMemo(() => {
    const map = new Map<string, InstallmentPlanRow>();
    (plansQuery.data || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [plansQuery.data]);

  // Merge and sort all items
  const items: ScadenziarioItem[] = useMemo(() => {
    const taxItems: ScadenziarioItem[] = (taxQuery.data || []).map((t) => ({
      type: "tax" as const,
      data: t,
    }));

    const installmentItems: ScadenziarioItem[] = (deadlinesQuery.data || [])
      .filter((d) => plansMap.has(d.installment_plan_id))
      .map((d) => ({
        type: "installment" as const,
        data: { ...d, plan: plansMap.get(d.installment_plan_id)! },
      }));

    const all = [...taxItems, ...installmentItems];

    // Sort by due_date
    all.sort((a, b) => {
      const dateA = a.type === "tax" ? a.data.due_date : a.data.due_date;
      const dateB = b.type === "tax" ? b.data.due_date : b.data.due_date;
      if (!dateA || !dateB) return 0;
      return dateA.localeCompare(dateB);
    });

    return all;
  }, [taxQuery.data, deadlinesQuery.data, plansMap]);

  const taxItems = items.filter((i): i is Extract<ScadenziarioItem, { type: "tax" }> => i.type === "tax");
  const installmentItems = items.filter((i): i is Extract<ScadenziarioItem, { type: "installment" }> => i.type === "installment");

  return {
    items,
    taxItems: taxItems.map((i) => i.data),
    installmentItems: installmentItems.map((i) => i.data),
    schedules: taxQuery.data || [],
    isLoading: taxQuery.isLoading || deadlinesQuery.isLoading,
    refetch: () => {
      taxQuery.refetch();
      deadlinesQuery.refetch();
      plansQuery.refetch();
    },
  };
}
