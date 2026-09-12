/**
 * Story 42.1 — Pagina Allocazione Netto Spendibile.
 * Breakdown visivo del netto in 5 categorie con percentuali personalizzabili.
 * UX spec: ANS-1
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AllocationBar } from "@/components/budget/AllocationBar";
import { AllocationList } from "@/components/budget/AllocationList";
import { AllocationSheet } from "@/components/budget/AllocationSheet";
import { useBudgetAllocation } from "@/hooks/useBudgetAllocation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/money";
import { Info, ArrowRight } from "lucide-react";
import { BUDGET_CATEGORIES, DEFAULT_ALLOCATION } from "@/lib/budget-constants";
import { ProGateOverlay } from "@/components/subscription/ProGateOverlay";

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]";

export default function BudgetPage() {
  const { items, config, nettoSpendibile, isLoading, save, resetToDefault, isSaving } = useBudgetAllocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSave = async (newConfig: Parameters<typeof save>[0]) => {
    try {
      const isDefault = BUDGET_CATEGORIES.every((k) => newConfig[k] === DEFAULT_ALLOCATION[k]);
      if (isDefault) {
        await resetToDefault();
      } else {
        await save(newConfig);
      }
      toast({ title: "Salvato", description: "Allocazione aggiornata." });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        {isMobile && <MobileHeader title="Allocazione" />}
        <PageContainer className="space-y-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </PageContainer>
      </AppLayout>
    );
  }

  // AC7 — Stato vuoto (Netto ≤ 0)
  if (nettoSpendibile <= 0) {
    return (
      <AppLayout>
        {isMobile && <MobileHeader title="Allocazione" />}
        <PageContainer className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Allocazione Netto</h1>
            <p className="text-sm text-slate-600 mt-1">
              Come si distribuisce il tuo netto spendibile
            </p>
          </div>

          <div className="bg-stone-50 rounded-2xl border border-stone-200/40 p-6 sm:p-8" role="status">
            <div className="flex flex-col items-center text-center gap-3">
              <Info className="h-8 w-8 text-slate-500" aria-hidden="true" />
              <p className="text-base font-semibold text-slate-700">
                Nessuna allocazione disponibile
              </p>
              <p className="text-sm text-slate-600">
                Registra i tuoi incassi per vedere come si distribuisce il tuo netto spendibile.
              </p>
              <Link
                to="/incassi"
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800 mt-1"
              >
                Registra un incasso
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    {isMobile && <MobileHeader title="Allocazione" />}
    <ProGateOverlay
      featureName="Allocazione Netto"
      featureDescription="Suddividi il tuo netto spendibile in categorie per gestire le spese con consapevolezza."
    >
    <PageContainer className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Allocazione Netto</h1>
        <p className="text-sm text-slate-600 mt-1">
          Come si distribuisce il tuo netto spendibile
        </p>
      </div>

      {/* Card spiegazione */}
      <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5`}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Cos'è l'allocazione</p>
            <p className="text-sm text-slate-600 mt-1">
              Il tuo netto spendibile viene suddiviso in 5 categorie per aiutarti a gestire le
              spese con consapevolezza. Non è un vincolo — è una bussola.
            </p>
          </div>
        </div>
      </div>

      {/* Card netto spendibile reference */}
      <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5`}>
        <p className="text-sm font-semibold text-teal-700 uppercase tracking-wider">
          Netto Spendibile
        </p>
        <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
          {formatCurrency(nettoSpendibile)}
        </p>
      </div>

      {/* Card barra + lista */}
      <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5 space-y-5`}>
        <AllocationBar items={items} />
        <AllocationList items={items} />
      </div>

      {/* CTA Personalizza */}
      <div className="text-center">
        <Button variant="outline" onClick={() => setSheetOpen(true)}>
          Personalizza le percentuali
        </Button>
      </div>

      {/* Sheet personalizzazione */}
      <AllocationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currentConfig={config}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </PageContainer>
    </ProGateOverlay>
    </AppLayout>
  );
}
