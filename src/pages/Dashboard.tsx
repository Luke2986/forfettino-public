import { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalCalculations, formatCurrency } from "@/hooks/useFiscalCalculations";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useRegenerateSchedule } from "@/hooks/useRegenerateSchedule";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AvatarDropdown } from "@/components/dashboard/AvatarDropdown";
import { KpiCard } from "@/components/dashboard/KpiCard";
// KpiCardRow no longer used — grid is inline in dashboard
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import { FirstIncomeBanner } from "@/components/dashboard/FirstIncomeBanner";
import { BannerStack } from "@/components/dashboard/BannerStack";
import { BreakdownSection } from "@/components/dashboard/BreakdownSection";
import type { BreakdownItem } from "@/components/dashboard/BreakdownSection";
import { BreakdownLevel2 } from "@/components/dashboard/BreakdownLevel2";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { PullToRefreshIndicator } from "@/components/dashboard/PullToRefreshIndicator";
// SogliaInline replaced by gauge integrated into SpendibileHero — Epic 13
import { SpendibileHero } from "@/components/dashboard/SpendibileHero";
import { ScadenzeInline } from "@/components/dashboard/ScadenzeInline";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { InactiveSurveyBanner } from "@/components/dashboard/InactiveSurveyBanner";
import { PricingSurveyNudge } from "@/components/dashboard/PricingSurveyNudge";
import { BenchmarkNudgeBanner } from "@/components/dashboard/BenchmarkNudgeBanner";
import { DemoDashboard } from "@/components/demo/DemoDashboard";
import { DEMO_DISMISSED_KEY } from "@/components/demo/demoData";
import { SectionErrorBoundary } from "@/components/shared/SectionErrorBoundary";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { PageYearSelector } from "@/components/shared/PageYearSelector";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { ExpiredRatesBanner } from "@/components/dashboard/ExpiredRatesBanner";
import { CommercialistaFallbackAlert } from "@/components/shared/CommercialistaFallbackAlert";
import { UnpaidSchedulesSummary } from "@/components/dashboard/UnpaidSchedulesSummary";
import { ImportFattureDialog } from "@/components/import/ImportFattureDialog";
import { ProBanner } from "@/components/subscription/ProBanner";
import { ProWaitlistSocialBanner } from "@/components/subscription/ProWaitlistSocialBanner";
import { ProWaitlistConsentDialog } from "@/components/subscription/ProWaitlistConsentDialog";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FeedbackEmailConsentModal } from "@/components/legal/FeedbackEmailConsentModal";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Squircle } from "@/components/ui/squircle";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { usePrefetchAdjacentYears } from "@/hooks/usePrefetchAdjacentYears";
import { Button } from "@/components/ui/button";
import { track, trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";
import {
  Wallet,
  Info,
  ArrowRight,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileUp,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserCountBadge } from "@/components/dashboard/UserCountBadge";
import { differenceInDays } from "date-fns";
import { sumMoney, subtractMoney } from "@/lib/money";
import { computeAccontiNextYearTotal } from "@/lib/fiscal-engine";
import { capitalize } from "@/lib/string-utils";

const FORFETTARIO_THRESHOLD = 85000;
const EMPTY_DEADLINES: import("@/hooks/useFiscalCalculations").DeadlineInfo[] = [];

const currentCalendarYear = new Date().getFullYear();

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState(currentCalendarYear);
  const { availableYears } = useAvailableYears();
  usePrefetchAdjacentYears(selectedYear, availableYears);
  const { data: profile, refetch: refetchProfile } = useProfile();
  const { metrics, isLoading, isError, currentYear, refetch: refetchFiscal } = useFiscalCalculations(selectedYear);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isPro, isLoading: subLoading, receiptsUsed, receiptsLimit, importsUsed, importsLimit, canImport, canSelectYear } = useSubscription();
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const { isJoined } = useProWaitlist();
  const {
    items: onboardingItems,
    isComplete: onboardingComplete,
    isDismissed: onboardingDismissed,
    isLoading: onboardingLoading,
  } = useOnboardingChecklist();
  const showOnboarding =
    !onboardingLoading &&
    !onboardingComplete &&
    !onboardingDismissed &&
    onboardingItems.length > 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [yearGateOpen, setYearGateOpen] = useState(false);
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);

  const handleYearChange = (year: number) => {
    if (!canSelectYear && !isAdmin && year !== currentCalendarYear) {
      setYearGateOpen(true);
      return;
    }
    setSelectedYear(year);
  };


  // Auto-rigenera scadenze: se utente ha incassi ma nessuna scadenza futura in tax_schedule
  const { regenerateForPaymentYear } = useRegenerateSchedule();
  const autoRegenTriggered = useRef(false);

  useEffect(() => {
    if (
      autoRegenTriggered.current ||
      isLoading ||
      !user?.id ||
      !metrics
    ) return;

    const hasIncome = (metrics.incassiYTD ?? 0) > 0;
    const noSchedule = !metrics.hasScheduleData;

    // Story 39-2: primo anno Art/Comm — fallback auto-regen per anno corrente
    // Se il Wizard fire-and-forget ha fallito, rigeneriamo le rate INPS Q1-Q4
    // Nota: noSchedule usa hasScheduleData che può essere true per righe N+1 del Wizard,
    // quindi usiamo unpaidCurrentYearTotal per verificare se le righe anno N mancano
    const hasCurrentYearScheduleRows = (metrics.currentYearSchedules?.length ?? 0) > 0;
    const isFirstYearArtCommNoSchedule =
      !hasIncome &&
      !hasCurrentYearScheduleRows &&
      metrics.currentYearObligations?.hasData &&
      metrics.currentYearObligations.rateInpsFisseAnnoN > 0;

    if (hasIncome && noSchedule) {
      autoRegenTriggered.current = true;
      const paymentYear = currentCalendarYear + 1;
      regenerateForPaymentYear(paymentYear).then((result) => {
        if (!result.success) {
          console.warn("[Dashboard] Auto-regen skipped:", result.reason);
        }
      }).catch((err) => {
        console.warn("[Dashboard] Auto-regen failed:", err);
      });
    } else if (isFirstYearArtCommNoSchedule) {
      autoRegenTriggered.current = true;
      regenerateForPaymentYear(currentCalendarYear).then((result) => {
        if (!result.success) {
          console.warn("[Dashboard] Auto-regen primo anno skipped:", result.reason);
        }
      }).catch((err) => {
        console.warn("[Dashboard] Auto-regen primo anno failed:", err);
      });
    }
  }, [isLoading, user?.id, metrics, regenerateForPaymentYear]);

  // Demo state (Story 38-1): show demo when hasZeroIncassi and not dismissed
  // Key is user-specific to avoid cross-account leakage (same browser, different accounts)
  const [demoDismissed, setDemoDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const isDismissed = localStorage.getItem(`${DEMO_DISMISSED_KEY}_${user.id}`) === "true";
    setDemoDismissed(isDismissed);
  }, [user?.id]);

  // Greeting for header
  const greeting = profile?.first_name
    ? `Ciao, ${capitalize(profile.first_name)}!`
    : "Ciao!";

  // Highlight state from URL param (post income creation)
  const highlightParam = searchParams.get("highlight");
  const [shouldHighlight, setShouldHighlight] = useState(false);

  // L2 breakdown state with localStorage persistence
  const [isL2Open, setIsL2Open] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("breakdown-l2-open") === "true";
    }
    return false;
  });

  // Optimistic dismiss per banner rate scadute (Story 4-1)
  const [localDismissed, setLocalDismissed] = useState(false);
  const dismissBannerMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .update({ banner_rate_scadute_dismissed: true })
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nessun record trovato per l'anno corrente");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal_year_settings", user?.id, currentYear] });
    },
    onError: () => {
      setLocalDismissed(false);
      toast({ title: "Errore", description: "Impossibile nascondere l'avviso. Riprova.", variant: "destructive" });
    },
  });

  const handleDismissExpiredBanner = () => {
    track("expired_rates_banner_dismissed", { expired_count: metrics?.expiredRatesCount ?? 0 });
    setLocalDismissed(true);
    dismissBannerMutation.mutate();
  };

  // Optimistic dismiss per fallback commercialista (Story 4-3)
  const [localFallbackDismissed, setLocalFallbackDismissed] = useState(false);
  const dismissFallbackMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .update({ banner_fallback_commercialista_dismissed: true })
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nessun record trovato per l'anno corrente");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal_year_settings", user?.id, currentYear] });
    },
    onError: () => {
      setLocalFallbackDismissed(false);
      toast({ title: "Errore", description: "Impossibile nascondere l'avviso. Riprova.", variant: "destructive" });
    },
  });

  const handleDismissFallbackBanner = () => {
    track("fallback_commercialista_dismissed", { trigger: "expired_rates_30d" });
    setLocalFallbackDismissed(true);
    dismissFallbackMutation.mutate();
  };

  // Reset optimistic dismiss quando cambia anno fiscale (dismiss è per-anno)
  useEffect(() => {
    setLocalDismissed(false);
    setLocalFallbackDismissed(false);
  }, [currentYear]);

  useEffect(() => {
    localStorage.setItem("breakdown-l2-open", String(isL2Open));
  }, [isL2Open]);

  // Aha banner state — first income ever (persistente, dismissible)
  const [showAhaBanner, setShowAhaBanner] = useState(false);
  const [pendingAha, setPendingAha] = useState(false);

  // Phase 1: consume URL params (no auth dependency)
  useEffect(() => {
    if (highlightParam === "spendibile") {
      setShouldHighlight(true);
      const isFirst = searchParams.get("first") === "true";
      if (isFirst) setPendingAha(true);
      // Clean URL params without navigation
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("highlight");
      newParams.delete("first");
      setSearchParams(newParams, { replace: true });
      // Auto-remove highlight ring after 2.5s (card removes at 2s, this is cleanup)
      const timer = setTimeout(() => setShouldHighlight(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightParam, searchParams, setSearchParams]);

  // Phase 2: show banner once user is loaded (auth-safe)
  useEffect(() => {
    if (pendingAha && user?.id) {
      if (!localStorage.getItem(`aha_banner_dismissed_${user.id}`)) {
        setShowAhaBanner(true);
      }
      setPendingAha(false);
    }
  }, [pendingAha, user?.id]);

  const handleDismissAha = () => {
    setShowAhaBanner(false);
    if (user?.id) {
      localStorage.setItem(`aha_banner_dismissed_${user.id}`, "true");
    }
  };

  // Track dashboard view — single canonical event for both PostHog + Supabase counter.
  // Previously also fired track("dashboard_view") → duplicate PostHog events.
  useEffect(() => {
    trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD);
  }, []);

  // Track fallback commercialista shown (Story 4-3)
  const showFallbackBanner =
    metrics?.inpsManagement !== "separata" &&
    metrics?.hasUnpaidOver30d &&
    !metrics?.bannerFallbackCommercialistaDismissed &&
    !localFallbackDismissed;

  useEffect(() => {
    if (showFallbackBanner) {
      track("fallback_commercialista_shown", {
        trigger: "expired_rates_30d",
        count: metrics?.unpaidSchedules30d?.length ?? 0,
      });
    }
  }, [showFallbackBanner]);

  // Query receipts anno corrente (per grafico mensile)
  const { data: currentYearReceipts = [] } = useQuery({
    queryKey: ["receipts_chart", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("receipt_date, gross_amount")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000, // 1 min — dati grafico cambiano raramente
  });

  // Query receipts anno precedente (per confronto nel grafico)
  const { data: previousYearReceipts = [] } = useQuery({
    queryKey: ["receipts_chart", user?.id, currentYear - 1],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("receipt_date, gross_amount")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear - 1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60_000, // 5 min — dati anno precedente raramente cambiano
  });

  // Pull to refresh for mobile
  const handleRefresh = async () => {
    await Promise.all([refetchProfile(), refetchFiscal()]);
  };

  const { pullDistance, pullProgress, isRefreshing, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Calcolo soglia forfettario
  const thresholdProgress = metrics ? Math.min(metrics.incassiYTD / FORFETTARIO_THRESHOLD, 1) : 0;
  const thresholdPercent = Math.round(thresholdProgress * 100);
  const thresholdRemaining = metrics ? Math.max(0, FORFETTARIO_THRESHOLD - metrics.incassiYTD) : FORFETTARIO_THRESHOLD;

  // Next year for labels
  const nextYear = currentYear + 1;

  // Prossime scadenze — da metrics (Story 3.4: fino a 3 scadenze)
  const upcomingDeadlines = metrics?.upcomingDeadlines ?? EMPTY_DEADLINES;
  // Totale rimanente di tutte le scadenze visibili
  const totalUpcomingRemaining = upcomingDeadlines.reduce((sum, d) => sumMoney(sum, d.remaining), 0);
  // Descrizione per la card: range date se >1 scadenza
  const upcomingDescription = useMemo(() => {
    if (upcomingDeadlines.length === 0) return "";
    if (upcomingDeadlines.length === 1) {
      const first = upcomingDeadlines[0];
      const days = differenceInDays(new Date(first.dueDate + "T00:00:00"), new Date());
      return `${new Date(first.dueDate + "T00:00:00").toLocaleDateString("it-IT")} — tra ${days} giorni`;
    }
    const firstDate = new Date(upcomingDeadlines[0].dueDate + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
    const lastDate = new Date(upcomingDeadlines[upcomingDeadlines.length - 1].dueDate + "T00:00:00").toLocaleDateString("it-IT");
    return `${firstDate} — ${lastDate}`;
  }, [upcomingDeadlines]);

  // Check if user has zero incassi AND no cross-year obligations (empty state)
  // CRITICAL: Do NOT show empty state if there are obligations from prior year income.
  // Example: Dashboard 2026, incassi 2025 = 10k, incassi 2026 = 0 → must show obligations.
  // EXCEPTION: Art/Comm first year with only INPS fixed rates (isFirstYearOnly) — show empty state + demo.
  const hasZeroIncassi = metrics?.incassiYTD === 0 &&
    (!metrics?.currentYearObligations?.hasData || metrics?.currentYearObligations?.isFirstYearOnly);

  // Story 38-1: blur sidebar + header when demo dashboard is visible
  const showDemo = hasZeroIncassi && !demoDismissed && !!metrics;

  // Debug log for demo visibility (development only)
  if (process.env.NODE_ENV === "development" && !isLoading) {
    console.log("[Dashboard Demo]", {
      incassiYTD: metrics?.incassiYTD,
      hasData: metrics?.currentYearObligations?.hasData,
      isFirstYearOnly: metrics?.currentYearObligations?.isFirstYearOnly,
      hasZeroIncassi,
      demoDismissed,
      showDemo,
    });
  }
  useEffect(() => {
    if (showDemo) {
      document.documentElement.dataset.demoActive = "true";
    } else {
      delete document.documentElement.dataset.demoActive;
    }
    return () => { delete document.documentElement.dataset.demoActive; };
  }, [showDemo]);

  if (isLoading) {
    return (
      <AppLayout>
        <Helmet>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        {isMobile && <MobileHeader title={greeting} rightAction={<AvatarDropdown />} />}
        <PageErrorBoundary>
        <PageContainer className="space-y-4">
          <Skeleton className="h-8 w-48" />
          {/* Hero skeleton */}
          <Skeleton className="h-48 w-full rounded-2xl" />
          {/* KPI grid skeleton — 2-col mobile, 3-col desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl col-span-2 sm:col-span-1" />
          </div>
          {/* Scadenze skeleton */}
          <Skeleton className="h-24 w-full rounded-2xl" />
          {/* Chart skeleton */}
          <Skeleton className="h-[200px] w-full rounded-2xl" />
        </PageContainer>
        </PageErrorBoundary>
      </AppLayout>
    );
  }

  // ── ERROR STATE: fetch dati fiscali fallito (Fix H2) ──
  // Deve precedere hasZeroIncassi: in errore le metriche sono azzerate e
  // mostrerebbero falsamente lo stato "nessun incasso" (zero fuorvianti su un
  // tool fiscale). Mostra invece un errore esplicito con retry.
  if (isError) {
    return (
      <AppLayout>
        <Helmet>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        {isMobile && <MobileHeader title={greeting} rightAction={<AvatarDropdown />} />}
        <PageErrorBoundary>
          <PageContainer className="space-y-4">
            <div className="max-w-md mx-auto mt-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-50 p-3">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                Impossibile caricare i dati fiscali
              </h1>
              <p className="text-sm text-slate-600">
                Si è verificato un errore nel recupero dei tuoi dati. Gli importi non
                sono mostrati per evitare cifre fuorvianti. Riprova tra qualche istante.
              </p>
              <Button onClick={() => refetchFiscal()} className="mt-2">
                Riprova
              </Button>
            </div>
          </PageContainer>
        </PageErrorBoundary>
      </AppLayout>
    );
  }

  // ── EMPTY STATE: 0 incassi ──
  if (hasZeroIncassi) {
    return (
      <AppLayout>
        <Helmet>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        {isMobile && (
          <div className={showDemo ? "demo-blur-zone" : ""}>
            <MobileHeader title={greeting} rightAction={<AvatarDropdown />} />
          </div>
        )}
        <PageErrorBoundary>
        <PageContainer
          className="space-y-4"
          {...(isMobile ? handlers : {})}
        >
          {isMobile && (
            <PullToRefreshIndicator
              pullDistance={pullDistance}
              pullProgress={pullProgress}
              isRefreshing={isRefreshing}
            />
          )}

          <div className={`${isMobile ? "hidden" : ""} ${showDemo ? "demo-blur-zone" : ""}`}>
            <div className="flex items-center justify-between gap-4">
              <PageYearSelector
                year={selectedYear}
                onYearChange={handleYearChange}
                availableYears={availableYears}
              />
              <div className="flex-1">
                <DashboardHeader />
              </div>
            </div>
          </div>

          {isMobile && (
            <div className={`flex justify-center ${showDemo ? "demo-blur-zone" : ""}`}>
              <PageYearSelector
                year={selectedYear}
                onYearChange={handleYearChange}
                availableYears={availableYears}
              />
            </div>
          )}

          {/* Story 38-1: Demo or classic empty state */}
          {!demoDismissed && metrics ? (
            <DemoDashboard
              gestioneINPS={metrics.inpsManagement}
              onDismiss={() => {
                if (user?.id) {
                  localStorage.setItem(`${DEMO_DISMISSED_KEY}_${user.id}`, "true");
                }
                setDemoDismissed(true);
              }}
            />
          ) : (
            <>
              {/* Classic empty state card */}
              <Card className="border-dashed border-2 border-primary/30">
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Inserisci il primo incasso</h2>
                    <p className="text-muted-foreground max-w-sm">
                      Così vedi subito spendibile e accantonamenti
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-2 w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:min-w-[180px] sm:w-auto"
                      onClick={() => {
                        track("add_income_click", { source: "dashboard_empty_state" });
                        navigate("/incassi/nuovo");
                      }}
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Aggiungi incasso
                    </Button>
                    {canImport ? (
                      <Button
                        size="lg"
                        onClick={() => {
                          track("import_xml_click", { source: "dashboard_empty_state" });
                          setImportDialogOpen(true);
                        }}
                        className="w-full sm:min-w-[180px] sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 border-0"
                      >
                        <FileUp className="mr-2 h-5 w-5" />
                        Importa XML
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full sm:min-w-[180px] sm:w-auto opacity-60"
                        disabled
                      >
                        <Lock className="mr-2 h-5 w-5" />
                        Importa XML (limite)
                      </Button>
                    )}
                  </div>
                  <button
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
                    onClick={() => {
                      navigate("/impostazioni");
                    }}
                  >
                    Come calcolo
                  </button>
                </CardContent>
              </Card>

              {/* Micro survey for inactive users */}
              <InactiveSurveyBanner />
            </>
          )}

          {/* Piano Free banner moved to sidebar footer — Epic 13 Story D-bis */}
        </PageContainer>
        </PageErrorBoundary>

        <ImportFattureDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />
      </AppLayout>
    );
  }

  // ── Breakdown content builders (riusati nei KpiCard Sheet) ──

  const isArtComm = metrics?.inpsManagement !== "separata";

  // Per Art/Comm: no aliquota piatta (il calcolo è minimale + variabile a doppia fascia)
  // Per Separata: mostra aliquota piatta come prima
  const inpsLabel = metrics
    ? metrics.inpsManagement === "artigiani"
      ? `INPS Artigiani`
      : metrics.inpsManagement === "commercianti"
        ? `INPS Commercianti`
        : `INPS Gestione Separata (${metrics.settings.inpsRate}%)`
    : "";

  const spendibileBreakdown = (() => {
    if (!metrics) return null;

    const heroItems: BreakdownItem[] = [
      { label: "Saldo Iniziale CC", value: formatCurrency(metrics.saldoInizialeCC), type: "entrata", show: metrics.saldoInizialeCC > 0 },
      { label: "Incassi Totali (da inizio anno)", value: formatCurrency(metrics.incassiYTD), type: "entrata" },
      { label: `× Coeff. redditività (${metrics.settings.profitCoeff}%)`, value: "", type: "formula", indent: true, show: metrics.incassiYTD > 0 },
      { label: "= Reddito imponibile", value: formatCurrency(metrics.taxableAmount), type: "formula", indent: true, show: metrics.incassiYTD > 0 },
      { label: `− Imposte e Contributi ${currentYear}`, value: formatCurrency(sumMoney(metrics.impostaConDeducibilita, metrics.inpsTotale)), type: "uscita", badge: "STIMA" },
      { label: `Imposta sostitutiva (con deducibilità)`, value: formatCurrency(metrics.impostaConDeducibilita), type: "sub", indent: true },
      { label: inpsLabel, value: formatCurrency(metrics.inpsTotale), type: "sub", indent: true },
      { label: "− Costi Strumenti (su base annua)", value: formatCurrency(metrics.yearlyToolCost), type: "uscita" },
      { label: metrics.currentYearObligations.isFirstYearOnly ? `− Obblighi ${currentYear} non pagati` : `− Obblighi ${currentYear} (reddito ${currentYear - 1})`, value: formatCurrency(metrics.unpaidCurrentYearTotal), type: "uscita", show: metrics.currentYearObligations.hasData && metrics.unpaidCurrentYearTotal > 0 },
      { label: `− Tasse ${currentYear} già pagate`, value: formatCurrency(metrics.paidCurrentYearTotal), type: "uscita", show: metrics.paidCurrentYearTotal > 0 },
      { label: "− Riserva Personale", value: formatCurrency(metrics.settings.reserveAmount), type: "riserva", show: metrics.settings.reserveAmount > 0 },
      { label: `− Buffer Sicurezza (${metrics.settings.safetyBuffer}%)`, value: formatCurrency(metrics.bufferAmount), type: "riserva", show: metrics.settings.safetyBuffer > 0 },
    ];

    return (
      <>
        <BreakdownSection
          items={heroItems}
          total={{
            label: "= Spendibile oggi",
            value: formatCurrency(metrics.spendable),
            colorClass: "text-success",
          }}
          footer={
            <>
              {metrics.spendable > 0 && (() => {
                const remainingMonths = 12 - new Date().getMonth(); // gen=12, feb=11, ..., dic=1
                const monthlyEstimate = Math.round(metrics.spendable / remainingMonths);
                return (
                  <div className="flex justify-between items-center text-sm text-muted-foreground pt-1">
                    <span>≈ Stima mensile ({remainingMonths} mesi)</span>
                    <span className="font-medium text-success tabular-nums">{formatCurrency(monthlyEstimate)}/mese</span>
                  </div>
                );
              })()}
              {metrics.spendable === 0 && metrics.unpaidCurrentYearTotal > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      I tuoi obblighi fiscali {currentYear} ({formatCurrency(metrics.unpaidCurrentYearTotal)}, derivati dal reddito {currentYear - 1}) superano i fondi attualmente disponibili. Pagare una scadenza non aumenta lo spendibile (la cassa esce davvero): si aggiornerà man mano che incasserai.
                    </p>
                  </div>
                </div>
              )}
              {metrics.incassiYTD > 0 && (() => {
                // Netto prudenziale = Spendibile − SOLO acconti anno successivo.
                // Il saldo {currentYear} NON va ri-sottratto: è già accantonato
                // nello "Spendibile oggi" via daCopireAmount (evita doppio conteggio).
                const accontiNextYear = computeAccontiNextYearTotal(metrics.fiscalPeak);
                if (accontiNextYear <= 0) return null;
                const nettoPrudenziale = Math.max(0, subtractMoney(metrics.spendable, accontiNextYear));
                return (
                  <div className="border-t border-dashed border-border/50 pt-2 mt-1 space-y-1">
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>− Acconti {nextYear}</span>
                      <span className="text-warning">−{formatCurrency(accontiNextYear)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span>= Netto prudenziale</span>
                      <span className="text-warning">{formatCurrency(nettoPrudenziale)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-0.5">
                      Quanto ti resta se metti da parte fin da ora anche gli acconti che verserai nel {nextYear}. Il saldo {currentYear} è già conteggiato qui sopra.
                    </p>
                  </div>
                );
              })()}
              <Collapsible open={isL2Open}>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer min-h-[44px] min-w-[44px]"
                  onClick={() => setIsL2Open(!isL2Open)}
                >
                  {isL2Open ? "Nascondi dettaglio" : "Vedi dettaglio completo"}{" "}
                  {isL2Open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <CollapsibleContent>
                  <BreakdownLevel2 gestione={metrics.inpsManagement} metrics={metrics} />
                </CollapsibleContent>
              </Collapsible>
            </>
          }
        />
      </>
    );
  })();

  const accantonareBreakdown = metrics ? (
    <div className="space-y-3">
      {/* CALCOLO BASE */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calcolo base</p>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Incassi {currentYear}</span>
        <span className="font-medium">{formatCurrency(metrics.incassiYTD)}</span>
      </div>
      <div className="text-sm text-muted-foreground italic pl-3">
        × Coefficiente redditività ({metrics.settings.profitCoeff}%)
      </div>
      <div className="flex justify-between items-center text-sm pl-3">
        <span className="text-muted-foreground italic">= Reddito imponibile</span>
        <span className="font-medium">{formatCurrency(metrics.taxableAmount)}</span>
      </div>

      <hr className="border-border" />

      {/* IMPOSTE E CONTRIBUTI — condizionale Art/Comm vs Separata */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {isArtComm ? "Da coprire" : "Imposte e contributi"}
      </p>

      {isArtComm ? (
        <>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Imposta sostitutiva (con deducibilità INPS)</span>
            <span className="font-medium">{formatCurrency(metrics.impostaConDeducibilita)}</span>
          </div>
          {metrics.inpsVariabile > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">INPS variabile su eccedenza</span>
              <span className="font-medium">{formatCurrency(metrics.inpsVariabile)}</span>
            </div>
          )}
          {metrics.inpsVariabile === 0 && metrics.incassiYTD > 0 && (
            <div className="text-sm text-muted-foreground italic pl-3">
              INPS variabile: €0 (reddito sotto soglia minimale)
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Imposta sostitutiva (con deducibilità INPS)</span>
            <span className="font-medium">{formatCurrency(metrics.impostaConDeducibilita)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{inpsLabel}</span>
            <span className="font-medium">{formatCurrency(metrics.inpsTotale)}</span>
          </div>
        </>
      )}

      <div className="flex justify-between items-center font-bold text-base pt-3 border-t border-border">
        <span>{isArtComm ? "Totale da coprire" : "Totale accantonamento"}</span>
        <span className="text-warning">{formatCurrency(metrics.daCopireAmount)}</span>
      </div>

      {isArtComm && metrics.inpsMinimale > 0 && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 mt-2">
          <p className="text-xs text-blue-800">
            Le rate INPS fisse trimestrali ({formatCurrency(metrics.inpsMinimale)}/anno) sono nello Scadenziario e nella card "Oneri".
          </p>
        </div>
      )}
    </div>
  ) : null;

  const scadenzeBreakdown = upcomingDeadlines.length > 0
    ? <UpcomingDeadlines deadlines={upcomingDeadlines} />
    : <p className="text-sm text-muted-foreground">Nessuna scadenza in programma</p>;

  const entrateLordeBreakdown = metrics ? (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Soglia forfettario 85k</span>
          <span>{thresholdPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              thresholdPercent >= 90 ? "bg-destructive" :
              thresholdPercent >= 70 ? "bg-warning" : "bg-info"
            }`}
            style={{ width: `${thresholdPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Rimanenti: {formatCurrency(thresholdRemaining)}
        </p>
      </div>
      <div className="bg-muted/30 p-3 rounded-lg text-xs space-y-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Il superamento della soglia di 85.000€ comporta l'uscita dal regime forfettario l'anno successivo.
          </p>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button
          className="flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
          onClick={() => navigate("/incassi")}
        >
          Vedi storico incassi <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  ) : null;

  const isFirstYearOnly = metrics?.currentYearObligations.isFirstYearOnly ?? false;

  const usciteFutureBreakdown = metrics ? (
    <div className="space-y-4">
      {metrics.currentYearObligations.hasData ? (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isFirstYearOnly
              ? `Rate INPS obbligatorie primo anno`
              : `Obblighi ${currentYear} (da reddito ${currentYear - 1})`}
          </p>
          <div className="divide-y divide-slate-100 [&>*]:py-2">
            {!isFirstYearOnly && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Saldo Imposte {currentYear - 1}</span>
                  <span className="font-medium">{formatCurrency(metrics.currentYearObligations.saldoTaxPrevYear)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Saldo INPS {currentYear - 1}</span>
                  <span className="font-medium">{formatCurrency(metrics.currentYearObligations.saldoInpsPrevYear)}</span>
                </div>
              </>
            )}
            {!isFirstYearOnly && metrics.currentYearObligations.accontiResult && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Acconti Imposta {currentYear}</span>
                  <span className="font-medium">{formatCurrency(metrics.currentYearObligations.accontiResult.totaleAccontiImposta)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Acconti INPS {currentYear}</span>
                  <span className="font-medium">{formatCurrency(metrics.currentYearObligations.accontiResult.totaleAccontiINPS)}</span>
                </div>
              </>
            )}
            {metrics.currentYearObligations.rateInpsFisseAnnoN > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Rate INPS Fisse {currentYear}</span>
                <span className="font-medium">{formatCurrency(metrics.currentYearObligations.rateInpsFisseAnnoN)}</span>
              </div>
            )}
          </div>
          {!isFirstYearOnly && (
            <>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Rata Giugno {currentYear}</span>
                <span className="font-medium">{formatCurrency(metrics.currentYearObligations.juneTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Rata Novembre {currentYear}</span>
                <span className="font-medium">{formatCurrency(metrics.currentYearObligations.novemberTotal)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center font-bold text-base pt-3 border-t border-border">
            <span>Totale {currentYear}</span>
            <span className="text-warning">{formatCurrency(metrics.currentYearObligations.yearTotal)}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Nessun dato anno precedente — le obbligazioni saranno calcolate quando avrai incassi registrati nel {currentYear - 1}.
        </p>
      )}

      {metrics.incassiYTD > 0 && metrics.fiscalPeak.yearTotal > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Proiezioni {nextYear} (da incassi {currentYear})
          </p>

          {/* Rata Giugno — spacchettata */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm font-medium">
              <span>Rata Giugno {nextYear}</span>
              <span>{formatCurrency(metrics.fiscalPeak.juneTotal)}</span>
            </div>
            <div className="space-y-1 bg-muted/20 rounded-lg p-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Saldo Imposta {currentYear}</span>
                <span className="font-medium">{formatCurrency(metrics.fiscalPeak.saldoTaxNetto)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Saldo INPS {currentYear}</span>
                <span className="font-medium">{formatCurrency(metrics.fiscalPeak.saldoInpsNetto)}</span>
              </div>
              {metrics.fiscalPeak.accontoTax1 > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">1° Acconto Imposta {nextYear}</span>
                  <span className="font-medium">{formatCurrency(metrics.fiscalPeak.accontoTax1)}</span>
                </div>
              )}
              {metrics.fiscalPeak.accontoInps1 > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">1° Acconto INPS {nextYear}</span>
                  <span className="font-medium">{formatCurrency(metrics.fiscalPeak.accontoInps1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rata Novembre — spacchettata */}
          <div className="space-y-1.5 mt-3">
            <div className="flex justify-between items-center text-sm font-medium">
              <span>Rata Novembre {nextYear}</span>
              <span>{formatCurrency(metrics.fiscalPeak.novemberTotal)}</span>
            </div>
            <div className="space-y-1 bg-muted/20 rounded-lg p-3">
              {metrics.fiscalPeak.accontoTax2 > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {metrics.fiscalPeak.accontoTax1 === 0 ? "Acconto unico Imposta" : "2° Acconto Imposta"} {nextYear}
                  </span>
                  <span className="font-medium">{formatCurrency(metrics.fiscalPeak.accontoTax2)}</span>
                </div>
              )}
              {metrics.fiscalPeak.accontoInps2 > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">2° Acconto INPS {nextYear}</span>
                  <span className="font-medium">{formatCurrency(metrics.fiscalPeak.accontoInps2)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center font-semibold text-sm pt-2 border-t border-border/50 mt-3">
            <span>Totale {nextYear}</span>
            <span className="text-warning">{formatCurrency(metrics.fiscalPeak.yearTotal)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          className="flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer font-medium"
          onClick={() => navigate("/scadenziario")}
        >
          Vai allo scadenziario <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  ) : null;

  // ── NORMAL STATE: has incassi ──
  return (
    <AppLayout>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      {isMobile && <MobileHeader title={greeting} rightAction={<AvatarDropdown />} />}
      <PageErrorBoundary>
      <PageContainer
        className="space-y-5"
        {...(isMobile ? handlers : {})}
      >
        {/* Pull to refresh indicator - mobile only */}
        {isMobile && (
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            pullProgress={pullProgress}
            isRefreshing={isRefreshing}
          />
        )}

        {/* Desktop Header with quick actions + year selector */}
        <div className={isMobile ? "hidden" : ""}>
          <div className="flex items-center justify-between gap-4">
            <PageYearSelector
              year={selectedYear}
              onYearChange={handleYearChange}
              availableYears={availableYears}
            />
            <div className="flex-1">
              <DashboardHeader />
            </div>
          </div>
        </div>

        {/* Mobile: year selector + badges */}
        {isMobile && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PageYearSelector
                year={selectedYear}
                onYearChange={handleYearChange}
                availableYears={availableYears}
              />
              {isAdmin && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 gap-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
            <UserCountBadge />
          </div>
        )}

        {/* Mobile CTA */}
        {isMobile && (
          <div className="flex gap-2">
            <Button
              className="flex-1 min-w-0"
              onClick={() => {
                track("add_income_click", { source: "dashboard_mobile" });
                navigate("/incassi/nuovo");
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi incasso
            </Button>
            {canImport ? (
              <Button
                variant="outline"
                className="flex-1 min-w-0 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300"
                onClick={() => {
                  track("import_xml_click", { source: "dashboard_mobile" });
                  setImportDialogOpen(true);
                }}
              >
                <FileUp className="mr-2 h-4 w-4" />
                Importa XML
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1 min-w-0 opacity-60"
                disabled
              >
                <Lock className="mr-2 h-4 w-4" />
                XML (limite)
              </Button>
            )}
          </div>
        )}

        {/* Onboarding Banner — sopra gli alert critici */}
        <SectionErrorBoundary>
          <OnboardingBanner />
        </SectionErrorBoundary>

        {/* Social proof waitlist — compatto, dopo onboarding */}
        <SectionErrorBoundary>
          <ProWaitlistSocialBanner showOnboarding={showOnboarding} />
        </SectionErrorBoundary>

        {/* Banner zone — alert critici, mobile: max 2 visibili */}
        <BannerStack mobileLimit={2}>

          {metrics.inpsManagement !== "separata" && (
            <SectionErrorBoundary>
              <ExpiredRatesBanner
                expiredCount={metrics.expiredRatesCount}
                isDismissed={metrics.bannerRateScaduteDismissed || localDismissed}
                onDismiss={handleDismissExpiredBanner}
              />
            </SectionErrorBoundary>
          )}

          {showFallbackBanner && (
            <SectionErrorBoundary>
              <CommercialistaFallbackAlert
                trigger="expired_rates_30d"
                onDismiss={handleDismissFallbackBanner}
              />
            </SectionErrorBoundary>
          )}

          {metrics.hasUnpaidOver30d && (
            <SectionErrorBoundary>
              <UnpaidSchedulesSummary schedules={metrics.unpaidSchedules30d} />
            </SectionErrorBoundary>
          )}

          {/* Pricing survey nudge — after operational alerts */}
          <SectionErrorBoundary>
            <PricingSurveyNudge />
          </SectionErrorBoundary>

          {/* Benchmark nudge — lowest priority, PRO/admin only */}
          <SectionErrorBoundary>
            <BenchmarkNudgeBanner />
          </SectionErrorBoundary>

        </BannerStack>

        {/* ── Aha moment banner — first income ever ── */}
        {showAhaBanner && metrics && (
          <SectionErrorBoundary>
            <FirstIncomeBanner
              spendable={metrics.spendable}
              futureObligations={metrics.fiscalPeak.yearTotal}
              nextYear={nextYear}
              onDismiss={handleDismissAha}
            />
          </SectionErrorBoundary>
        )}

        {/* ══════ ZONA 1 — HERO: Spendibile + Soglia 85k ══════ */}
        <SectionErrorBoundary>
          <SpotlightCard glowColor="teal" className="rounded-2xl">
            <SpendibileHero
              spendable={metrics.spendable}
              sogliaIncassi={metrics.incassiYTD}
              sogliaLimite={FORFETTARIO_THRESHOLD}
              breakdownContent={spendibileBreakdown}
              helpText="Quanto puoi spendere oggi: incassi meno tasse, INPS, costi strumenti, obblighi correnti, buffer e riserve."
              shouldHighlight={shouldHighlight}
            />
          </SpotlightCard>
        </SectionErrorBoundary>

        {/* ══════ ZONA 2 — SITUAZIONE: 3 KPI secondarie + Scadenze inline ══════ */}
        <section>
          <SectionErrorBoundary>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              {/* 1. Entrate Lorde */}
              <SpotlightCard glowColor="blue" className="rounded-2xl">
                <KpiCard
                  label={`Entrate ${currentYear}`}
                  value={formatCurrency(metrics.incassiYTD)}
                  accentColor="border-l-blue-300"
                  valueColor="text-slate-800"
                  helpText="Totale incassi ricevuti nell'anno corrente (principio di cassa)."
                  breakdownContent={entrateLordeBreakdown}
                  breakdownTitle={`Entrate Lorde ${currentYear}`}
                  breakdownSubtitle="Incassi da inizio anno"
                />
              </SpotlightCard>

              {/* 2. Da accantonare */}
              <SpotlightCard glowColor="amber" className="rounded-2xl">
                <KpiCard
                  label={metrics.inpsManagement === "separata" ? "Da accantonare" : "Da coprire"}
                  value={formatCurrency(metrics.daCopireAmount)}
                  accentColor="border-l-amber-400"
                  valueColor="text-amber-700"
                  helpText={metrics.inpsManagement === "separata"
                    ? "Quanto dovresti avere già messo da parte in base agli incassi registrati."
                    : "Quanto devi ancora coprire tra imposte e contributi INPS obbligatori."
                  }
                  breakdownContent={accantonareBreakdown}
                  breakdownTitle={metrics.inpsManagement === "separata" ? "Da accantonare" : "Da coprire"}
                  breakdownSubtitle={metrics.inpsManagement === "separata" ? "Sul reddito di quest'anno" : "Tra imposte e contributi"}
                />
              </SpotlightCard>

              {/* 3. Oneri / Proiezione (label migliorato) */}
              <div className="col-span-2 sm:col-span-1 h-full">
                <SpotlightCard glowColor="violet" className="rounded-2xl">
                  <KpiCard
                    label={
                      metrics.currentYearObligations.hasData
                        ? (isFirstYearOnly
                            ? `Rate INPS ${currentYear}`
                            : `Oneri ${currentYear}`)
                        : `Proiezione ${nextYear}`
                    }
                    value={formatCurrency(
                      metrics.currentYearObligations.hasData
                        ? metrics.currentYearObligations.yearTotal
                        : metrics.fiscalPeak.yearTotal
                    )}
                    accentColor="border-l-violet-400"
                    valueColor="text-violet-700"
                    helpText={
                      metrics.currentYearObligations.hasData
                        ? (isFirstYearOnly
                            ? "Rate INPS fisse obbligatorie per il primo anno di attività."
                            : `Obblighi di pagamento ${currentYear} basati sul reddito ${currentYear - 1}.`)
                        : `Proiezione uscite ${nextYear} basata sugli incassi ${currentYear}.`
                    }
                    breakdownContent={usciteFutureBreakdown}
                    breakdownTitle={
                      metrics.currentYearObligations.hasData
                        ? (isFirstYearOnly
                            ? "Rate INPS Obbligatorie"
                            : `Obblighi di Pagamento ${currentYear}`)
                        : `Stima Uscite ${nextYear}`
                    }
                    breakdownSubtitle={
                      metrics.currentYearObligations.hasData
                        ? (isFirstYearOnly
                            ? "Rate INPS primo anno"
                            : `Da reddito ${currentYear - 1}`)
                        : "Uscite previste dal conto"
                    }
                  />
                </SpotlightCard>
              </div>
            </div>
          </SectionErrorBoundary>
        </section>

        {/* ProBanner soglia 85k — tra KPI grid e Scadenze */}
        {metrics.incassiYTD >= 7000000 && !isPro && (
          <ProBanner
            triggerId="soglia-85k"
            title="Ti stai avvicinando alla soglia forfettaria"
            description="Con PRO, monitoraggio avanzato e alert personalizzati sulla soglia 85k."
          />
        )}

        {/* Scadenze inline — lista compatta sotto la griglia */}
        <SectionErrorBoundary>
          <SpotlightCard glowColor="stone" className="rounded-2xl">
            <ScadenzeInline deadlines={upcomingDeadlines} />
          </SpotlightCard>
        </SectionErrorBoundary>

        {/* ══════ ZONA 3 — APPROFONDIMENTO: Grafico + Disclaimer ══════ */}
        <DisclaimerBanner />

        {/* Grafico Incassi Mensili — compact (Epic 13) */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Andamento</h3>
          <SectionErrorBoundary>
            <SpotlightCard glowColor="slate" className="rounded-2xl">
              {/*
                Epic 81 — Squircle wrapper pattern: Card outer carries shadow
                + border + bg-white + rounded-2xl (clip-path on inner Squircle
                would clip the shadow). Inner Squircle wraps CardContent so
                interior corners are iOS-style. Background bg-white on outer
                covers the rounded shape entirely; inner squircle clip is
                visually subtle for chart content (no element touches corners).
              */}
              <Card className="bg-white rounded-2xl border border-slate-200/40 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.04)]">
                <Squircle radius={16} smoothing={0.6} className="block">
                  <CardContent className="pt-4 pb-3 px-4">
                    <MonthlyRevenueChart
                      currentYearReceipts={currentYearReceipts}
                      previousYearReceipts={previousYearReceipts}
                      currentYear={currentYear}
                      compact
                    />
                  </CardContent>
                </Squircle>
              </Card>
            </SpotlightCard>
          </SectionErrorBoundary>
        </section>
      </PageContainer>
      </PageErrorBoundary>

      <ImportFattureDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        yearOverride={selectedYear}
      />

      {/* Modal consenso email — solo Dashboard, con ritardo 30s (ex AppLayout) */}
      <FeedbackEmailConsentModal />

      {/* Year gate dialog — T4 */}
      <Dialog open={yearGateOpen} onOpenChange={setYearGateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storico multi-anno</DialogTitle>
            <DialogDescription>
              Lo storico multi-anno è disponibile con PRO. Iscriviti alla waiting list per essere avvisato al lancio.
            </DialogDescription>
          </DialogHeader>
          {isJoined ? (
            <p className="text-sm text-emerald-600 font-medium">Sei in lista — ti avviseremo al lancio.</p>
          ) : (
            <Button onClick={() => { setYearGateOpen(false); setWaitlistDialogOpen(true); }}>Scopri PRO</Button>
          )}
        </DialogContent>
      </Dialog>
      <ProWaitlistConsentDialog open={waitlistDialogOpen} onOpenChange={setWaitlistDialogOpen} />
    </AppLayout>
  );
}
