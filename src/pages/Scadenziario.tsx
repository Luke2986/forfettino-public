import { useState, useEffect } from "react";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { usePrefetchAdjacentYears } from "@/hooks/usePrefetchAdjacentYears";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalCalculations } from "@/hooks/useFiscalCalculations";
import { useRegenerateSchedule } from "@/hooks/useRegenerateSchedule";
import { useScadenziarioUnified } from "@/hooks/useScadenziarioUnified";
import { useInstallmentPlans } from "@/hooks/useInstallmentPlans";
import type { InstallmentDeadlineRow, InstallmentPlanRow } from "@/hooks/useInstallmentPlans";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, RefreshCw, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { SectionErrorBoundary } from "@/components/shared/SectionErrorBoundary";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { RataScadenzaCard } from "@/components/scadenziario/RataScadenzaCard";
import { ScadenziarioInstallmentCard } from "@/components/scadenziario/ScadenziarioInstallmentCard";
import { InpsFixedRatesProgress } from "@/components/scadenziario/InpsFixedRatesProgress";
import { MarkAsPaidButton } from "@/components/scadenziario/MarkAsPaidButton";
import { useMarkAsPaid } from "@/hooks/useMarkAsPaid";
import { useUnmarkAsPaid } from "@/hooks/useUnmarkAsPaid";
import { RegisterPaymentDialog } from "@/components/incassi/RegisterPaymentDialog";
import { trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";
import { sanitizeMoney } from "@/lib/money";
import { buildEngineSnapshot } from "@/lib/discrepancy";
import { getDifferimentoForfettario } from "@/lib/fiscal-engine";
import { formatDateIT } from "@/lib/schedule-helpers";
import type { Database } from "@/integrations/supabase/types";

export default function ScadenziarioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();
  const [paymentYear, setPaymentYear] = useState(currentYear.toString());
  const { availableYears } = useAvailableYears();
  usePrefetchAdjacentYears(parseInt(paymentYear), availableYears);
  const { regenerateForPaymentYear } = useRegenerateSchedule();
  const { metrics } = useFiscalCalculations();
  const inpsManagement = metrics.inpsManagement;

  // Differimento agevolato forfettari/ISA per l'anno selezionato (null se nessuna proroga nota).
  const differimento = getDifferimentoForfettario(parseInt(paymentYear));

  // Unified scadenziario: tax_schedule + installment_deadlines
  const { items, schedules, isLoading, refetch } = useScadenziarioUnified(parseInt(paymentYear));

  // Installment plans hook for registerPaymentMutation
  const { registerPaymentMutation } = useInstallmentPlans(parseInt(paymentYear));

  // Fiscal settings for payment registration
  const { data: settings } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, parseInt(paymentYear)],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", parseInt(paymentYear))
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // State for installment payment dialog
  const [paymentDialogPlan, setPaymentDialogPlan] = useState<{
    deadline: InstallmentDeadlineRow & { plan: InstallmentPlanRow };
  } | null>(null);

  useEffect(() => {
    trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_SCADENZIARIO);
  }, []);

  const markAsPaidMutation = useMarkAsPaid({ onSuccess: () => refetch() });
  const unmarkAsPaidMutation = useUnmarkAsPaid({ onSuccess: () => refetch() });

  const handleRegisterInstallmentPayment = (deadline: InstallmentDeadlineRow & { plan: InstallmentPlanRow }) => {
    setPaymentDialogPlan({ deadline });
  };

  const handleConfirmInstallmentPayment = (planId: string, deadlineId: string, importo: number, dataIncasso: Date, note?: string) => {
    const profitCoeff = sanitizeMoney(settings?.profit_coefficient) || 78;
    const taxRate = sanitizeMoney(settings?.tax_rate) || 15;
    const inpsRate = sanitizeMoney(settings?.inps_rate) || 26.07;

    registerPaymentMutation.mutate(
      {
        planId,
        deadlineId,
        importo,
        dataIncasso,
        note,
        profitCoefficient: profitCoeff,
        taxRate,
        inpsRate,
      },
      {
        onSuccess: () => {
          toast({ title: "Pagamento registrato!" });
          setPaymentDialogPlan(null);
          refetch();
        },
        onError: (error: Error) => {
          toast({ title: "Errore", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  // Regenerate mutation - usa hook condiviso useRegenerateSchedule
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const result = await regenerateForPaymentYear(parseInt(paymentYear));
      if (!result.success) throw new Error(result.reason || "Dati mancanti per la rigenerazione");
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Scadenze rigenerate!" });
    },
    onError: (error: Error) => {
      console.error("Regenerate error:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Scadenziario" />}
      <PageErrorBoundary>
      <PageContainer>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold">Scadenziario</h1>
            <p className="text-muted-foreground">
              Tasse, contributi e rate da incassare
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={paymentYear} onValueChange={setPaymentYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="gap-2"
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Rigenera
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6" data-testid="skeleton-loading">
            {/* Progress bar skeleton */}
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            {/* Card grid skeleton */}
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-6">
            {/* Progress bar rate INPS fisse (solo Art/Comm) */}
            {inpsManagement !== "separata" && schedules && (
              <InpsFixedRatesProgress schedules={schedules} />
            )}

            {/* Lista scadenze ordinate cronologicamente (tax + installment) */}
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => (
                <SectionErrorBoundary key={item.type === "tax" ? item.data.id : `inst-${item.data.id}`}>
                  {item.type === "tax" ? (
                    <div className="flex flex-col gap-2">
                      <RataScadenzaCard schedule={item.data} />
                      <MarkAsPaidButton
                        schedule={item.data}
                        isPending={markAsPaidMutation.isPending}
                        onConfirm={(paymentDate, payload) =>
                          markAsPaidMutation.mutate({
                            schedule: item.data,
                            paymentDate,
                            amountPaidCents: payload.amountPaidCents,
                            reasonCode: payload.reasonCode,
                            note: payload.note,
                            paymentWindow: payload.paymentWindow,
                            surchargeCents: payload.surchargeCents,
                            engineSnapshot: buildEngineSnapshot(item.data, settings),
                            trackingContext: payload.context,
                          })
                        }
                        isUndoing={unmarkAsPaidMutation.isPending}
                        onUndo={() =>
                          unmarkAsPaidMutation.mutate({ schedule: item.data })
                        }
                      />
                    </div>
                  ) : (
                    <ScadenziarioInstallmentCard
                      deadline={item.data}
                      onRegisterPayment={handleRegisterInstallmentPayment}
                    />
                  )}
                </SectionErrorBoundary>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50" />
              <h2 className="mt-4 text-lg font-medium">
                Nessuna scadenza per il {paymentYear}
              </h2>
              <p className="text-muted-foreground">
                Clicca "Rigenera" per calcolare le scadenze in base ai tuoi incassi.
              </p>
              <Button
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className="mt-4 gap-2"
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Genera Scadenze
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dialog registra pagamento rata */}
        {paymentDialogPlan && (
          <RegisterPaymentDialog
            open={!!paymentDialogPlan}
            onOpenChange={(open) => { if (!open) setPaymentDialogPlan(null); }}
            plan={paymentDialogPlan ? {
              id: paymentDialogPlan.deadline.plan.id,
              user_id: paymentDialogPlan.deadline.plan.user_id,
              total_amount: paymentDialogPlan.deadline.plan.total_amount,
              client_name: paymentDialogPlan.deadline.plan.client_name,
              description: paymentDialogPlan.deadline.plan.description,
              start_date: paymentDialogPlan.deadline.plan.start_date,
              fiscal_year: paymentDialogPlan.deadline.plan.fiscal_year,
              status: paymentDialogPlan.deadline.plan.status,
              created_at: paymentDialogPlan.deadline.plan.created_at,
              updated_at: paymentDialogPlan.deadline.plan.updated_at,
              rivalsa_inps_applied: Boolean(
                (paymentDialogPlan.deadline.plan as { rivalsa_inps_applied?: boolean }).rivalsa_inps_applied
              ),
              deadlines: [],
              totalPaid: 0,
              residuo: sanitizeMoney(paymentDialogPlan.deadline.expected_amount),
              paidCount: 0,
              totalCount: 1,
              nextDeadline: paymentDialogPlan.deadline,
            } : null}
            onConfirm={handleConfirmInstallmentPayment}
            isPending={registerPaymentMutation.isPending}
          />
        )}

        {/* Disclaimer calcoli */}
        <DisclaimerBanner />

        {/* Info Card */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Come funziona lo Scadenziario</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Giugno:</strong> Saldo imposta e INPS anno precedente + eventuale 1° acconto anno corrente
            </p>
            {differimento && (
              <p>
                <strong>Proroga forfettari/ISA {paymentYear}:</strong> il termine di giugno slitta al{" "}
                {formatDateIT(differimento.termine)} senza maggiorazione. È possibile differire fino al{" "}
                {formatDateIT(differimento.termineDifferito)} applicando una maggiorazione dello{" "}
                {(differimento.maggiorazione * 100).toLocaleString("it-IT", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %.
              </p>
            )}
            <p>
              <strong>Novembre:</strong> Eventuale 2° acconto imposta e INPS anno corrente
            </p>
            {inpsManagement !== "separata" && (
              <p>
                <strong>Rate trimestrali:</strong> 4 rate fisse INPS (febbraio, maggio, agosto, novembre)
              </p>
            )}
            <p>
              Gli importi vengono calcolati automaticamente in base ai tuoi incassi e alle impostazioni fiscali.
              Clicca "Rigenera" dopo aver registrato nuovi incassi.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
      </PageErrorBoundary>
    </AppLayout>
  );
}
