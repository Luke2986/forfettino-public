import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeMoney, multiplyByPercent, subtractMoney } from "@/lib/money";
import { breakdownFromTotale } from "@/lib/rivalsa-inps";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type InstallmentPlanRow = Database["public"]["Tables"]["installment_plans"]["Row"];
type InstallmentDeadlineRow = Database["public"]["Tables"]["installment_deadlines"]["Row"];

export type { InstallmentPlanRow, InstallmentDeadlineRow };

/**
 * Plan with computed progress data.
 * NOTE: totalPaid is the sum of expected_amount of paid deadlines (euro).
 * This assumes each deadline is paid in full (1 rata = 1 pagamento).
 */
export interface InstallmentPlanWithProgress extends InstallmentPlanRow {
  deadlines: InstallmentDeadlineRow[];
  totalPaid: number; // euro (somma expected_amount delle rate pagate)
  residuo: number; // euro (total_amount - totalPaid)
  paidCount: number;
  totalCount: number;
  nextDeadline: InstallmentDeadlineRow | null;
}

/** Params for creating a plan from NuovoIncasso */
export interface CreatePlanParams {
  totalAmount: number; // euro (totale fattura, include rivalsa se applicata)
  clientName: string | null;
  description: string | null;
  startDate: Date;
  fiscalYear: number;
  /** Deadlines to create upfront. If empty, user will add payments manually. */
  deadlines: Array<{
    label: string;
    expectedAmount: number; // euro
    dueDate: Date;
  }>;
  /** If provided, registers the first deadline payment immediately */
  firstPayment?: {
    amount: number; // euro
    date: Date;
    profitCoefficient: number;
    taxRate: number;
    inpsRate: number;
  };
  invoiceNumber?: string;
  /** Rivalsa INPS 4% applicata sull'intero piano (Gestione Separata). */
  rivalsaApplied?: boolean;
}

/** Params for registering a payment against a deadline */
export interface RegisterPaymentParams {
  planId: string;
  deadlineId: string;
  importo: number; // euro
  dataIncasso: Date;
  note?: string;
  profitCoefficient: number;
  taxRate: number;
  inpsRate: number;
}

/** Params for adding a new deadline to an existing plan */
export interface AddDeadlineParams {
  planId: string;
  label: string;
  expectedAmount: number; // euro
  dueDate: Date;
}

// ---------- Invalidation helper ----------
function invalidateAllQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["installment_plans"] });
  queryClient.invalidateQueries({ queryKey: ["installment_deadlines"] });
  queryClient.invalidateQueries({ queryKey: ["installment_deadlines_scadenziario"] });
  queryClient.invalidateQueries({ queryKey: ["installment_plans_for_scadenziario"] });
  queryClient.invalidateQueries({ queryKey: ["receipts"] });
  queryClient.invalidateQueries({ queryKey: ["receipts_ytd"] });
  queryClient.invalidateQueries({ queryKey: ["receipts_ytd_prev"] });
  queryClient.invalidateQueries({ queryKey: ["fiscal_year_settings_prev"] });
  queryClient.invalidateQueries({ queryKey: ["receipt_count_limit"] });
  queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
  queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
  queryClient.invalidateQueries({ queryKey: ["income_stats"] });
  queryClient.invalidateQueries({ queryKey: ["current_year_schedules"] });
}

export function useInstallmentPlans(fiscalYear: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ---------- Fetch plans ----------
  const plansQuery = useQuery({
    queryKey: ["installment_plans", user?.id, fiscalYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("installment_plans" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", fiscalYear)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InstallmentPlanRow[];
    },
    enabled: !!user,
  });

  // ---------- Fetch all deadlines (avoid N+1) ----------
  const deadlinesQuery = useQuery({
    queryKey: ["installment_deadlines", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("installment_deadlines" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as InstallmentDeadlineRow[];
    },
    enabled: !!user,
  });

  // ---------- Deadlines map (grouped by plan_id) ----------
  const deadlinesMap = useMemo(() => {
    const map = new Map<string, InstallmentDeadlineRow[]>();
    (deadlinesQuery.data || []).forEach((d) => {
      const list = map.get(d.installment_plan_id) || [];
      list.push(d);
      map.set(d.installment_plan_id, list);
    });
    return map;
  }, [deadlinesQuery.data]);

  // ---------- Plans with computed progress ----------
  const plansWithProgress: InstallmentPlanWithProgress[] = useMemo(() => {
    if (!plansQuery.data) return [];
    return plansQuery.data.map((plan) => {
      const deadlines = deadlinesMap.get(plan.id) || [];
      const paidDeadlines = deadlines.filter((d) => d.is_paid);
      const totalPaid = paidDeadlines.reduce(
        (sum, d) => sum + sanitizeMoney(d.expected_amount),
        0
      );
      const residuo = sanitizeMoney(plan.total_amount) - totalPaid;
      const nextDeadline = deadlines.find((d) => !d.is_paid) || null;
      return {
        ...plan,
        deadlines,
        totalPaid,
        residuo,
        paidCount: paidDeadlines.length,
        totalCount: deadlines.length,
        nextDeadline,
      };
    });
  }, [plansQuery.data, deadlinesMap]);

  // ---------- Create plan ----------
  const createPlanMutation = useMutation({
    mutationFn: async (params: CreatePlanParams) => {
      if (!user) throw new Error("Not authenticated");
      const {
        totalAmount, clientName, description, startDate, fiscalYear: fy,
        deadlines: deadlinesInput, firstPayment, invoiceNumber,
        rivalsaApplied = false,
      } = params;

      // 1. Create installment_plan
      const { data: plan, error: planErr } = await supabase
        .from("installment_plans" as any)
        .insert({
          user_id: user.id,
          total_amount: totalAmount,
          client_name: clientName,
          description,
          start_date: format(startDate, "yyyy-MM-dd"),
          fiscal_year: fy,
          status: "in_corso",
          rivalsa_inps_applied: rivalsaApplied,
        })
        .select("*")
        .single();
      if (planErr) throw planErr;
      const newPlan = plan as unknown as InstallmentPlanRow;

      // 2. Create deadlines (if provided)
      if (deadlinesInput.length > 0) {
        const deadlineRows = deadlinesInput.map((d) => ({
          installment_plan_id: newPlan.id,
          user_id: user.id,
          label: d.label,
          expected_amount: d.expectedAmount,
          due_date: format(d.dueDate, "yyyy-MM-dd"),
          is_paid: false,
        }));
        const { error: dlErr } = await supabase
          .from("installment_deadlines" as any)
          .insert(deadlineRows);
        if (dlErr) throw dlErr;
      }

      // 3. If first payment, register it immediately
      if (firstPayment && deadlinesInput.length > 0) {
        // Find the first deadline just created
        const { data: firstDeadlines, error: fdErr } = await supabase
          .from("installment_deadlines" as any)
          .select("*")
          .eq("installment_plan_id", newPlan.id)
          .order("due_date", { ascending: true })
          .limit(1);
        if (fdErr) throw fdErr;

        const firstDl = (firstDeadlines as unknown as InstallmentDeadlineRow[])?.[0];
        if (firstDl) {
          // Create receipt for the first payment
          const gross = sanitizeMoney(firstPayment.amount);
          const taxable = multiplyByPercent(gross, firstPayment.profitCoefficient);
          const tax = multiplyByPercent(taxable, firstPayment.taxRate);
          const inps = multiplyByPercent(taxable, firstPayment.inpsRate);
          const netSpendable = subtractMoney(subtractMoney(gross, tax), inps);
          const dateStr = format(firstPayment.date, "yyyy-MM-dd");
          // Se il piano ha rivalsa, estraiamo la quota di rivalsa contenuta in
          // questa rata (gross × 4/104). La somma delle quote rivalsa sui
          // receipt del piano corrisponde alla rivalsa totale del piano.
          const rivalsaOnReceipt = rivalsaApplied ? breakdownFromTotale(gross).rivalsa : 0;

          const { data: receipt, error: recErr } = await supabase
            .from("receipts")
            .insert({
              user_id: user.id,
              receipt_date: dateStr,
              gross_amount: gross,
              client_name: clientName,
              taxable_amount: taxable,
              tax_amount: tax,
              inps_amount: inps,
              net_spendable: netSpendable,
              fiscal_year: fy,
              installment_plan_id: newPlan.id,
              installment_deadline_id: firstDl.id,
              invoice_number: invoiceNumber || null,
              source: "manual",
              rivalsa_inps_applied: rivalsaApplied,
              rivalsa_inps_amount: rivalsaOnReceipt,
            })
            .select("id")
            .single();
          if (recErr) throw recErr;

          // Mark deadline as paid
          const { error: dlUpErr } = await supabase
            .from("installment_deadlines" as any)
            .update({
              is_paid: true,
              receipt_id: (receipt as any).id,
            })
            .eq("id", firstDl.id);
          if (dlUpErr) throw dlUpErr;

          // Check if plan is now complete.
          // Condizioni cumulative:
          //  - tutte le deadline del piano sono pagate (qui solo la prima, quindi
          //    piano completo SSE numero totale deadlines === 1)
          //  - l'importo totale incassato copre il totale piano
          const planTotal = sanitizeMoney(totalAmount);
          const allDeadlinesPaid = deadlinesInput.length === 1;
          if (allDeadlinesPaid && gross >= planTotal) {
            await supabase
              .from("installment_plans" as any)
              .update({ status: "completato" })
              .eq("id", newPlan.id);
          }
        }
      }

      return newPlan;
    },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
    },
  });

  // ---------- Register payment against a deadline ----------
  const registerPaymentMutation = useMutation({
    mutationFn: async (params: RegisterPaymentParams) => {
      if (!user) throw new Error("Not authenticated");
      const { planId, deadlineId, importo, dataIncasso, note, profitCoefficient, taxRate, inpsRate } = params;

      // Fetch plan
      const plan = plansWithProgress.find((p) => p.id === planId);
      if (!plan) throw new Error("Piano rate non trovato");
      if (plan.status === "completato") throw new Error("Piano già completato");

      // Validate amount (both in euro)
      const gross = sanitizeMoney(importo);
      if (gross > plan.residuo) {
        throw new Error(
          `L'importo supera il residuo di €${plan.residuo.toFixed(2).replace(".", ",")}`
        );
      }
      const taxable = multiplyByPercent(gross, profitCoefficient);
      const tax = multiplyByPercent(taxable, taxRate);
      const inps = multiplyByPercent(taxable, inpsRate);
      const netSpendable = subtractMoney(subtractMoney(gross, tax), inps);
      const dateStr = format(dataIncasso, "yyyy-MM-dd");
      // Se il piano ha rivalsa attiva, la rata contiene una quota proporzionale
      // di rivalsa: gross × 4/104. Sommando le quote di tutti i receipt del
      // piano si ottiene la rivalsa totale del piano.
      const planRivalsa = Boolean(plan.rivalsa_inps_applied);
      const rivalsaOnReceipt = planRivalsa ? breakdownFromTotale(gross).rivalsa : 0;

      const { data: receipt, error: recErr } = await supabase
        .from("receipts")
        .insert({
          user_id: user.id,
          receipt_date: dateStr,
          gross_amount: gross,
          client_name: plan.client_name,
          notes: note || null,
          taxable_amount: taxable,
          tax_amount: tax,
          inps_amount: inps,
          net_spendable: netSpendable,
          fiscal_year: plan.fiscal_year,
          installment_plan_id: planId,
          installment_deadline_id: deadlineId,
          source: "manual",
          rivalsa_inps_applied: planRivalsa,
          rivalsa_inps_amount: rivalsaOnReceipt,
        })
        .select("id")
        .single();
      if (recErr) throw recErr;

      // Mark deadline as paid
      const { error: dlErr } = await supabase
        .from("installment_deadlines" as any)
        .update({
          is_paid: true,
          receipt_id: (receipt as any).id,
        })
        .eq("id", deadlineId);
      if (dlErr) throw dlErr;

      // Check if plan is now complete
      const newTotalPaid = plan.totalPaid + gross;
      const planTotal = sanitizeMoney(plan.total_amount);
      if (newTotalPaid >= planTotal) {
        await supabase
          .from("installment_plans" as any)
          .update({ status: "completato" })
          .eq("id", planId);
      }

      return { planId, gross };
    },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
    },
  });

  // ---------- Add deadline to existing plan ----------
  const addDeadlineMutation = useMutation({
    mutationFn: async (params: AddDeadlineParams) => {
      if (!user) throw new Error("Not authenticated");
      const { planId, label, expectedAmount, dueDate } = params;

      const plan = plansWithProgress.find((p) => p.id === planId);
      if (!plan) throw new Error("Piano rate non trovato");
      if (plan.status === "completato") throw new Error("Piano già completato");

      const { error } = await supabase
        .from("installment_deadlines" as any)
        .insert({
          installment_plan_id: planId,
          user_id: user.id,
          label,
          expected_amount: expectedAmount,
          due_date: format(dueDate, "yyyy-MM-dd"),
          is_paid: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
    },
  });

  // ---------- Edit plan (only if not completato) ----------
  const editPlanMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<Pick<InstallmentPlanRow, "total_amount" | "client_name" | "description">>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const plan = plansWithProgress.find((p) => p.id === params.id);
      if (!plan) throw new Error("Piano rate non trovato");
      if (plan.status === "completato") throw new Error("Piano completato, non modificabile");

      // If changing total_amount, must be >= totalPaid
      if (params.updates.total_amount !== undefined) {
        const newTotal = sanitizeMoney(params.updates.total_amount);
        if (newTotal < plan.totalPaid) {
          throw new Error("L'importo totale non può essere inferiore al totale già incassato");
        }
      }

      const { error } = await supabase
        .from("installment_plans" as any)
        .update(params.updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment_plans"] });
    },
  });

  // ---------- Delete plan (only if 0 payments) ----------
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const plan = plansWithProgress.find((p) => p.id === id);
      if (!plan) throw new Error("Piano rate non trovato");
      if (plan.paidCount > 0) {
        throw new Error("Impossibile eliminare un piano con pagamenti registrati");
      }

      // Delete deadlines first (CASCADE should handle, but explicit is safer)
      const { error: dlErr } = await supabase
        .from("installment_deadlines" as any)
        .delete()
        .eq("installment_plan_id", id);
      if (dlErr) throw dlErr;

      const { error } = await supabase
        .from("installment_plans" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
    },
  });

  // ---------- Derived data (AC#2: useMemo) ----------
  const activePlans = useMemo(
    () => plansWithProgress.filter((p) => p.status === "in_corso"),
    [plansWithProgress]
  );
  const completedPlans = useMemo(
    () => plansWithProgress.filter((p) => p.status === "completato"),
    [plansWithProgress]
  );

  return {
    plans: plansWithProgress,
    activePlans,
    completedPlans,
    isLoading: plansQuery.isLoading || deadlinesQuery.isLoading,
    deadlinesMap,
    createPlanMutation,
    registerPaymentMutation,
    addDeadlineMutation,
    editPlanMutation,
    deletePlanMutation,
  };
}
