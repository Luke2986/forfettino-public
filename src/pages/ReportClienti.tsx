/**
 * Story 54.2 + 55.3 — Pagina Report Fatturato
 * Tab "Per Cliente" (Epic 54/58) + Tab "Per Servizio" (Epic 55).
 * Free: top 3 visibili. Pro/admin: accesso completo.
 */

import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sumMoney } from "@/lib/money";
import { ConcentrationAlert } from "@/components/report-clienti/ConcentrationAlert";
import { ClientRankedBars } from "@/components/report-clienti/ClientRankedBars";
import { MissingClientsNudge } from "@/components/report-clienti/MissingClientsNudge";
import { useClientRevenueReport } from "@/hooks/useClientRevenueReport";
import { useServiceRevenueReport } from "@/hooks/useServiceRevenueReport";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useReceiptYears } from "@/hooks/useReceiptYears";
import { useIsMobile } from "@/hooks/use-mobile";
import { identifyDormantClients } from "@/lib/client-analytics";
import { formatCurrency } from "@/lib/money";
import { capitalizeFirst } from "@/lib/string-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, PieChart, Tags, Lock, Table2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { exportClientReport } from "@/lib/client-report-export";
import { exportServiceReport } from "@/lib/service-report-export";
import { useCrossAnalysis } from "@/hooks/useCrossAnalysis";
import { CrossAnalysisHeatmap } from "@/components/report-incrociata/CrossAnalysisHeatmap";
import { CrossStackedBarChart } from "@/components/report-incrociata/CrossStackedBarChart";
import { CrossInsights } from "@/components/report-incrociata/CrossInsights";
import { exportCrossAnalysis } from "@/lib/cross-analysis-export";
import { ServiceRankedBars } from "@/components/report-servizi/ServiceRankedBars";
import { MissingServicesNudge } from "@/components/report-servizi/MissingServicesNudge";
import { ProWaitlistConsentDialog } from "@/components/subscription/ProWaitlistConsentDialog";
import { ProGateOverlay } from "@/components/subscription/ProGateOverlay";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { toast } from "sonner";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]";

const TAB_STORAGE_KEY = "report-active-tab";

type ReportTab = "clienti" | "servizi" | "incrociata";

function getInitialTab(categoriesCount: number, hasFullAccess: boolean, hasClients: boolean): ReportTab {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY) as ReportTab | null;
    if (stored === "incrociata") {
      return hasFullAccess && categoriesCount > 0 && hasClients ? "incrociata" : "clienti";
    }
    if (stored === "servizi") {
      return categoriesCount > 0 ? "servizi" : "clienti";
    }
  } catch { /* ignore */ }
  return "clienti";
}

export default function ReportClienti() {
  const { user } = useAuth();
  const { selectedYear } = useFiscalYear();
  const { data: receiptYears } = useReceiptYears();
  const { isPro, isLoading: subLoading } = useSubscription();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const isAdmin = userRole === "admin";
  const hasFullAccess = isPro || isAdmin;
  const isMobile = useIsMobile();
  const { isJoined } = useProWaitlist();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [crossDialogOpen, setCrossDialogOpen] = useState(false);
  const [crossViewMode, setCrossViewMode] = useState<"table" | "chart">("table");

  // Service categories (per empty state e tab guard)
  const { categories, isLoading: categoriesLoading } = useServiceCategories();

  // Anni con incassi reali — mai anni futuri, mai anni fantasma
  const currentYear = new Date().getFullYear();
  const reportYears = useMemo(() => {
    const years = receiptYears ?? [];
    const result = years.length > 0 ? years.filter((y) => y <= currentYear) : [currentYear];
    return result;
  }, [receiptYears, currentYear]);

  // Stato locale per il periodo selezionato (null = "Totale") — condiviso tra tab
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(selectedYear);

  // Sync selectedPeriod quando l'utente cambia anno dal PageYearSelector globale
  useEffect(() => {
    setSelectedPeriod(selectedYear);
  }, [selectedYear]);

  // Tab state con localStorage persistence
  const [activeTab, setActiveTab] = useState<ReportTab>(() => getInitialTab(categories.length, false, false));

  // Quando le categorie/subscription finiscono di caricare, ri-valuta il tab da localStorage
  useEffect(() => {
    if (categoriesLoading || subLoading || roleLoading) return;
    try {
      const stored = localStorage.getItem(TAB_STORAGE_KEY) as ReportTab | null;
      if (stored === "incrociata") {
        if (hasFullAccess && categories.length > 0) {
          setActiveTab("incrociata");
        } else {
          setActiveTab("clienti");
        }
        return;
      }
      if (stored === "servizi" && categories.length > 0) {
        setActiveTab("servizi");
        return;
      }
    } catch { /* ignore */ }
    if (activeTab === "servizi" && categories.length === 0) {
      setActiveTab("clienti");
    }
    if (activeTab === "incrociata" && (!hasFullAccess || categories.length === 0)) {
      setActiveTab("clienti");
    }
  }, [categoriesLoading, categories.length, subLoading, roleLoading, hasFullAccess]);

  const handleTabChange = (tab: string) => {
    const newTab = tab as ReportTab;
    if (newTab === "incrociata" && !hasFullAccess) {
      toast.info("Analisi Incrociata è disponibile con il piano Pro");
      setCrossDialogOpen(true);
      return;
    }
    setActiveTab(newTab);
    try { localStorage.setItem(TAB_STORAGE_KEY, newTab); } catch { /* ignore */ }
  };

  // ── Client report data ──
  const { data: clientData, metrics: clientMetrics, isLoading: clientLoading, error: clientError } = useClientRevenueReport(selectedPeriod);

  // ── Rivalsa INPS 4% totale (somma dei rivalsa_inps_amount nell'anno selezionato) ──
  const { data: rivalsaTotal } = useQuery({
    queryKey: ["rivalsa_total", user?.id, selectedPeriod],
    queryFn: async () => {
      if (!user) return 0;
      let query = supabase
        .from("receipts")
        .select("rivalsa_inps_amount")
        .eq("user_id", user.id)
        .eq("rivalsa_inps_applied", true);
      if (selectedPeriod !== null) {
        query = query.eq("fiscal_year", selectedPeriod);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).reduce<number>(
        (sum, r) => sumMoney(sum, Number(r.rivalsa_inps_amount ?? 0)),
        0,
      );
    },
    enabled: !!user,
  });

  // ── Marca da bollo totale (somma dei marca_bollo_amount nell'anno selezionato) ──
  const { data: bolloTotal } = useQuery({
    queryKey: ["bollo_total", user?.id, selectedPeriod],
    queryFn: async () => {
      if (!user) return 0;
      let query = supabase
        .from("receipts")
        .select("marca_bollo_amount")
        .eq("user_id", user.id)
        .eq("marca_bollo_applied", true);
      if (selectedPeriod !== null) {
        query = query.eq("fiscal_year", selectedPeriod);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).reduce<number>(
        (sum, r) => sumMoney(sum, Number(r.marca_bollo_amount ?? 0)),
        0,
      );
    },
    enabled: !!user,
  });
  const nullClientEntry = clientData?.find((c) => c.clientId === null);
  const nullClientPct = nullClientEntry ? nullClientEntry.percentage : 0;
  const dormantClientIds = useMemo(() => {
    if (!clientData?.length) return new Set<string | null>();
    return new Set(identifyDormantClients(clientData, 3).map((c) => c.clientId));
  }, [clientData]);

  // ── Service report data ──
  const { data: serviceData, metrics: serviceMetrics, isLoading: serviceLoading, error: serviceError } = useServiceRevenueReport(selectedPeriod);

  // ── Cross analysis data ──
  const { data: crossData, isLoading: crossLoading, error: crossError } = useCrossAnalysis(selectedPeriod);

  // Export handler
  const handleExport = () => {
    if (!hasFullAccess) {
      if (isJoined) {
        toast.info("Sei già in lista per PRO — ti avviseremo al lancio");
      } else {
        setExportDialogOpen(true);
      }
      return;
    }
    if (activeTab === "clienti") {
      if (clientData) exportClientReport(clientData, selectedPeriod);
    } else if (activeTab === "servizi") {
      if (serviceData) exportServiceReport(serviceData, selectedPeriod);
    } else {
      if (crossData) exportCrossAnalysis(crossData, selectedPeriod);
    }
  };

  const exportDisabled = hasFullAccess && (
    activeTab === "clienti" ? !clientData?.length :
    activeTab === "servizi" ? !serviceData?.length :
    !crossData?.entries.length
  );

  // Loading gate — evita flash UpgradeCTA per utenti Pro
  if (subLoading || roleLoading) {
    return (
      <AppLayout>
        <PageContainer>
          <div />
        </PageContainer>
      </AppLayout>
    );
  }

  // Active tab data
  const isLoading = activeTab === "clienti" ? clientLoading : activeTab === "servizi" ? serviceLoading : crossLoading;
  const error = activeTab === "clienti" ? clientError : activeTab === "servizi" ? serviceError : crossError;

  // ── Servizio: empty state checks ──
  const allUncategorized = serviceData && serviceData.length > 0 && serviceData.every(s => s.serviceId === null);

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Report Fatturato" />}
      <ProGateOverlay
        featureName="Report Fatturato"
        featureDescription="Analizza il fatturato per cliente e servizio, concentrazione rischio e trend. Esporta i dati in CSV."
      >
      <PageContainer className="space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Report Fatturato</h1>
          <div className="flex items-center gap-3">
          <Tabs
            value={String(selectedPeriod ?? "totale")}
            onValueChange={(v) => {
              setSelectedPeriod(v === "totale" ? null : Number(v));
            }}
          >
            <TabsList className="gap-1 squircle-md bg-slate-100 p-1 max-w-full overflow-x-auto scrollbar-hide">
              {reportYears.map((y) => (
                <TabsTrigger
                  key={y}
                  value={String(y)}
                  className="relative squircle-md px-3 py-1.5 text-sm whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                >
                  {y}
                  {y === currentYear && (
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
                  )}
                </TabsTrigger>
              ))}
              {hasFullAccess && (
                <TabsTrigger
                  value="totale"
                  className="squircle-md px-3 py-1.5 text-sm whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                >
                  Totale
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportDisabled}
            className={!hasFullAccess ? "opacity-50 cursor-not-allowed" : undefined}
            aria-disabled={!hasFullAccess || undefined}
            title={!hasFullAccess ? "Disponibile con Pro" : undefined}
          >
            <Download className="h-4 w-4 mr-2" />
            Esporta CSV
          </Button>
          </div>
        </div>

        {/* Tab Per Cliente / Per Servizio */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="gap-1 squircle-md bg-slate-100 p-1">
            <TabsTrigger
              value="clienti"
              className="squircle-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Per Cliente
            </TabsTrigger>
            <TabsTrigger
              value="servizi"
              className="squircle-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Per Servizio
            </TabsTrigger>
            <TabsTrigger
              value="incrociata"
              className="squircle-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Analisi Incrociata
              {!hasFullAccess && <Lock className="h-3 w-3 ml-1 text-slate-500" />}
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB: Per Cliente ═══ */}
          <TabsContent value="clienti" className="mt-5 space-y-0">
            {/* Loading */}
            {clientLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              </div>
            )}

            {/* Error */}
            {clientError && !clientLoading && (
              <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200/60 text-sm text-red-800">
                Errore nel caricamento dei dati. Riprova più tardi.
              </div>
            )}

            {/* Empty state */}
            {!clientLoading && !clientError && (!clientData || clientData.length === 0) && (
              <div
                className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <PieChart className="h-4 w-4 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Nessun incasso registrato{selectedPeriod !== null ? ` nel ${selectedPeriod}` : ""}
                  </p>
                  <p className="text-sm text-slate-600">
                    Registra il tuo primo incasso per vedere i report per cliente
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/incassi/nuovo">Aggiungi incasso</Link>
                </Button>
              </div>
            )}

            {/* Contenuto principale */}
            {!clientLoading && !clientError && clientData && clientData.length > 0 && clientMetrics && (
              <div>
                {/* Hero card */}
                <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5`}>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-sm text-slate-600">Fatturato lordo</span>
                    <span className="text-xl font-bold text-slate-900">
                      {formatCurrency(clientMetrics.totalGross)}
                    </span>
                    <span className="text-sm text-slate-600">
                      {clientMetrics.clientCount} client{clientMetrics.clientCount !== 1 ? "i" : "e"}
                    </span>
                  </div>
                  {rivalsaTotal !== undefined && rivalsaTotal > 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      di cui rivalsa INPS 4%:{" "}
                      <span className="font-medium text-teal-700">
                        {formatCurrency(rivalsaTotal)}
                      </span>
                    </p>
                  )}
                  {bolloTotal !== undefined && bolloTotal > 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      di cui marca da bollo:{" "}
                      <span className="font-medium text-amber-700">
                        {formatCurrency(bolloTotal)}
                      </span>
                    </p>
                  )}
                </div>

                {/* Alert concentrazione */}
                <div className="mt-5">
                  <ConcentrationAlert
                    concentration={clientMetrics.concentration}
                    topClientPct={clientMetrics.topClientPct}
                    topClientName={capitalizeFirst(clientData[0].clientName)}
                  />
                </div>

                {/* Section header barre */}
                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-900">Ranking clienti</p>
                  {hasFullAccess && selectedPeriod !== null && (
                    <p className="text-sm text-slate-500">Clicca su un cliente per il trend mensile</p>
                  )}
                </div>

                {/* Ranked bar chart */}
                <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5 mt-2`}>
                  <ClientRankedBars
                    data={clientData}
                    hasFullAccess={hasFullAccess}
                    dormantClientIds={dormantClientIds}
                    selectedPeriod={selectedPeriod}
                  />
                </div>

                {/* Nudge clienti mancanti */}
                <div className="mt-5">
                  <MissingClientsNudge nullClientPercentage={nullClientPct} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB: Per Servizio ═══ */}
          <TabsContent value="servizi" className="mt-5 space-y-0">
            {/* Loading categorie */}
            {categoriesLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              </div>
            )}

            {/* Empty State Variante A: zero categorie (solo dopo il loading) */}
            {!categoriesLoading && categories.length === 0 && (
              <div
                className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Tags className="h-4 w-4 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Crea le tue categorie servizio
                  </p>
                  <p className="text-sm text-slate-600">
                    Scopri qual è il servizio che ti rende di più. Organizza i tuoi incassi per tipo di lavoro per sbloccare questo report.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/impostazioni?tab=categorie">Vai a Impostazioni</Link>
                </Button>
              </div>
            )}

            {/* Categorie create — mostra report */}
            {categories.length > 0 && (
              <>
                {/* Loading */}
                {serviceLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  </div>
                )}

                {/* Error */}
                {serviceError && !serviceLoading && (
                  <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200/60 text-sm text-red-800">
                    Errore nel caricamento dei dati. Riprova più tardi.
                  </div>
                )}

                {/* Empty — nessun incasso */}
                {!serviceLoading && !serviceError && (!serviceData || serviceData.length === 0) && (
                  <div
                    className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <PieChart className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        Nessun incasso registrato{selectedPeriod !== null ? ` nel ${selectedPeriod}` : ""}
                      </p>
                      <p className="text-sm text-slate-600">
                        Registra il tuo primo incasso per vedere il report per servizio
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/incassi/nuovo">Aggiungi incasso</Link>
                    </Button>
                  </div>
                )}

                {/* Contenuto principale servizi */}
                {!serviceLoading && !serviceError && serviceData && serviceData.length > 0 && serviceMetrics && (
                  <div>
                    {/* Banner motivazionale — Variante B: tutti incassi non categorizzati */}
                    {allUncategorized && (
                      <div className="flex items-start gap-3 rounded-lg px-4 py-3 bg-blue-50 border border-blue-200/60 mb-5">
                        <Tags className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800">
                          Hai {categories.length} {categories.length === 1 ? "categoria" : "categorie"} ma nessun incasso categorizzato. Assegna una categoria ai tuoi incassi per vedere il report completo.{" "}
                          <Link
                            to="/incassi"
                            className="font-medium underline underline-offset-2 hover:text-blue-900"
                          >
                            Categorizza incassi
                          </Link>
                        </p>
                      </div>
                    )}

                    {/* Hero card — fatturato per servizio */}
                    <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5`}>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-sm text-slate-600">Fatturato per servizio</span>
                        <span className="text-xl font-bold text-slate-900">
                          {formatCurrency(serviceMetrics.totalGross)}
                        </span>
                        <span className="text-sm text-slate-600">
                          {serviceMetrics.serviceCount} {serviceMetrics.serviceCount !== 1 ? "servizi" : "servizio"}
                        </span>
                      </div>
                    </div>

                    {/* Alert concentrazione servizi */}
                    <div className="mt-5">
                      <ConcentrationAlert
                        concentration={serviceMetrics.concentration}
                        topClientPct={serviceMetrics.topServicePct}
                        topClientName={serviceData[0].serviceName}
                        entityLabel="servizio"
                      />
                    </div>

                    {/* Section header barre */}
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-slate-900">Ranking servizi</p>
                      {hasFullAccess && selectedPeriod !== null && (
                        <p className="text-sm text-slate-500">Clicca su un servizio per il trend mensile</p>
                      )}
                    </div>

                    {/* Ranked bar chart servizi */}
                    <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5 mt-2`}>
                      <ServiceRankedBars
                        data={serviceData}
                        hasFullAccess={hasFullAccess}
                        selectedPeriod={selectedPeriod}
                      />
                    </div>

                    {/* Nudge servizi mancanti */}
                    <div className="mt-5">
                      <MissingServicesNudge data={serviceData} />
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ═══ TAB: Analisi Incrociata ═══ */}
          <TabsContent value="incrociata" className="mt-5 space-y-0">
            {/* Loading */}
            {crossLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              </div>
            )}

            {/* Error */}
            {crossError && !crossLoading && (
              <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200/60 text-sm text-red-800">
                Errore nel caricamento dei dati. Riprova più tardi.
              </div>
            )}

            {/* Empty states */}
            {!crossLoading && !crossError && crossData && crossData.entries.length === 0 && (
              <>
                {/* Zero categorie E zero clienti */}
                {categories.length === 0 && (!clientData || clientData.length === 0) && (
                  <div className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        Crea clienti e categorie servizio per sbloccare l'analisi incrociata
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/clienti">Aggiungi cliente</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link to="/impostazioni?tab=categorie">Crea categorie</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Zero categorie MA clienti presenti */}
                {categories.length === 0 && clientData && clientData.length > 0 && (
                  <div className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        Crea le tue categorie servizio per incrociare i dati con i tuoi clienti
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/impostazioni?tab=categorie">Vai a Impostazioni</Link>
                    </Button>
                  </div>
                )}

                {/* Categorie presenti MA zero clienti */}
                {categories.length > 0 && (!clientData || clientData.length === 0) && (
                  <div className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        Associa i tuoi incassi a un cliente per l'analisi incrociata
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/clienti">Gestisci clienti</Link>
                    </Button>
                  </div>
                )}

                {/* Categorie E clienti presenti ma zero incassi con associazioni */}
                {categories.length > 0 && clientData && clientData.length > 0 && (
                  <div className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-dashed border-2 border-primary/30 ${CARD_SHADOW}`}>
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <PieChart className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        Nessun incasso registrato{selectedPeriod !== null ? ` nel ${selectedPeriod}` : ""}
                      </p>
                      <p className="text-sm text-slate-600">
                        Registra incassi con cliente e categoria per vedere l'analisi incrociata
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/incassi/nuovo">Aggiungi incasso</Link>
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Contenuto principale */}
            {!crossLoading && !crossError && crossData && crossData.entries.length > 0 && (
              <div className="space-y-5">
                {/* Toggle Tabella / Grafico */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={crossViewMode === "table" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCrossViewMode("table")}
                  >
                    <Table2 className="h-4 w-4 mr-1.5" />
                    Tabella
                  </Button>
                  <Button
                    variant={crossViewMode === "chart" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCrossViewMode("chart")}
                  >
                    <BarChart3 className="h-4 w-4 mr-1.5" />
                    Grafico
                  </Button>
                </div>

                {/* Heatmap o Chart */}
                {crossViewMode === "table" ? (
                  <CrossAnalysisHeatmap data={crossData} />
                ) : (
                  <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5`}>
                    <CrossStackedBarChart data={crossData} />
                  </div>
                )}

                {/* Insight */}
                <CrossInsights data={crossData} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
      </ProGateOverlay>
      <ProWaitlistConsentDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
      <ProWaitlistConsentDialog open={crossDialogOpen} onOpenChange={setCrossDialogOpen} />
    </AppLayout>
  );
}
