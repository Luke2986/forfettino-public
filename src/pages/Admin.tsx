import { useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OverrideTier } from "@/types/subscription";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminUserActivityReport } from "@/components/admin/AdminUserActivityReport";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { AdminGestioneMetrics } from "@/components/admin/AdminGestioneMetrics";
import { AdminDerivedMetrics } from "@/components/admin/AdminDerivedMetrics";
import { AdminAnnouncementSection } from "@/components/admin/AdminAnnouncementSection";
import { AdminSendEmail } from "@/components/admin/AdminSendEmail";
import { AdminDeadlineEmailTrigger } from "@/components/admin/AdminDeadlineEmailTrigger";
import { AdminDeadlineEmailSelfTest } from "@/components/admin/AdminDeadlineEmailSelfTest";
import { AdminDeadlineEmailMetrics } from "@/components/admin/AdminDeadlineEmailMetrics";
import { AdminCTAAnalytics } from "@/components/admin/AdminCTAAnalytics";
import { AdminTTVWidget } from "@/components/admin/AdminTTVWidget";
import { AdminNSMMiniCard } from "@/components/admin/AdminNSMMiniCard";
import { AdminMarkPaidNsmCard } from "@/components/admin/AdminMarkPaidNsmCard";
import { AdminWizardFunnel } from "@/components/admin/AdminWizardFunnel";
import { AdminABComparison } from "@/components/admin/AdminABComparison";
import { AdminContributions } from "@/components/admin/AdminContributions";
import { AdminQualifiedUsersExport } from "@/components/admin/AdminQualifiedUsersExport";
import { AdminMilestones } from "@/components/admin/AdminMilestones";
import { AdminActionConfig } from "@/components/admin/AdminActionConfig";
import { PricingSurveyResults } from "@/components/admin/PricingSurveyResults";
import { AdminProWaitlist } from "@/components/admin/AdminProWaitlist";
import { AdminNewsletterDashboard } from "@/components/admin/AdminNewsletterDashboard";
import { CalendarSurveyResults } from "@/components/admin/CalendarSurveyResults";
import { NpsCampaignConfig } from "@/components/admin/NpsCampaignConfig";
import { NpsDashboard } from "@/components/admin/NpsDashboard";
import { BenchmarkUsageStats } from "@/components/admin/BenchmarkUsageStats";
import { AdminFeedbackStats } from "@/components/admin/AdminFeedbackStats";
import { AdminSecuritySettings } from "@/components/admin/AdminSecuritySettings";
import { AdminOtpStats } from "@/components/admin/AdminOtpStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  CreditCard,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
  Bell,
  Mail,
  UserX,
} from "lucide-react";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-[200px] w-full rounded-lg" />
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  );
}

export default function AdminPage() {
  const isMobile = useIsMobile();
  const { data, isLoading, error, refetch, isFetching } = useAdminStats();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleOverrideChange = useCallback(async (userId: string, newTier: OverrideTier | null) => {
    const { error: invokeError } = await supabase.functions.invoke("admin-set-override-tier", {
      body: { userId, tier: newTier },
    });

    if (invokeError) {
      // supabase-js non espone il body dell'errore nel message: lo leggiamo da context
      // (Response), altrimenti ogni fallimento diventa un generico "Impossibile aggiornare".
      let detail = invokeError.message;
      const response = (invokeError as { context?: Response }).context;
      if (response && typeof response.json === "function") {
        try {
          const body = await response.json();
          if (body?.error) detail = String(body.error);
        } catch {
          // body non JSON: teniamo il messaggio originale
        }
      }
      console.error("admin-set-override-tier failed:", detail);
      toast({
        title: "Errore",
        description: `Impossibile aggiornare il livello: ${detail}`,
        variant: "destructive",
      });
      return;
    }

    const userCode = data?.userList.find((u) => u.id === userId)?.userCode ?? userId;
    toast({ title: "Livello aggiornato", description: `Livello aggiornato per ${userCode}` });
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  }, [data?.userList, toast, queryClient]);

  return (
    <AppLayout>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      {isMobile && <MobileHeader title="Pannello Admin" />}
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <ShieldCheck className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Pannello Admin</h1>
              <p className="text-muted-foreground">
                Metriche SaaS e gestione utenti
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Aggiorna
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Errore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Impossibile caricare le statistiche: {error.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && <LoadingSkeleton />}

        {/* Data Loaded */}
        {data && (
          <>
            {/* Stats Grid - Row 1: Users (blue) */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <AdminStatCard
                icon={<Users className="h-5 w-5 text-blue-500" />}
                label="Utenti Totali"
                value={data.users.total}
                subLabel={`+${data.users.signupsThisMonth} questo mese`}
                iconClassName="bg-blue-500/10"
              />
              <AdminStatCard
                icon={<CheckCircle2 className="h-5 w-5 text-blue-500" />}
                label="Onboarding Completato"
                value={data.users.onboarded}
                subLabel={`su ${data.users.total} registrati (${data.users.onboardingRate}%) · ${data.users.total - data.users.onboarded} drop-off`}
                iconClassName="bg-blue-500/10"
              />
              <AdminStatCard
                icon={<CreditCard className="h-5 w-5 text-blue-500" />}
                label="Abbonati Pro"
                value={data.subscriptions.proCount}
                subLabel={`${data.subscriptions.conversionRate}% conversione`}
                iconClassName="bg-blue-500/10"
              />
            </div>

            {/* Stats Grid - Row 2: Revenue (green) + Usage + Notifiche */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <AdminStatCard
                icon={<TrendingUp className="h-5 w-5 text-success" />}
                label="MRR"
                value={formatCurrency(data.subscriptions.mrrCents)}
                subLabel="Ricavi ricorrenti mensili"
                iconClassName="bg-success-muted"
              />
              <AdminStatCard
                icon={<CalendarClock className="h-5 w-5 text-success" />}
                label="ARR"
                value={formatCurrency(data.subscriptions.arrCents)}
                subLabel="Proiezione annuale"
                iconClassName="bg-success-muted"
              />
              <AdminStatCard
                icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                label="Pending Churn"
                value={`${data.subscriptions.churnRate}%`}
                subLabel={`${data.subscriptions.pendingChurnCount} cancellazioni in sospeso`}
                iconClassName="bg-destructive/10"
              />
            </div>

            {/* Stats Grid - Row 3: Usage + Notifiche (compact) */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <AdminStatCard
                icon={<Users className="h-5 w-5 text-warning" />}
                label="Utenti Attivi"
                value={data.usage.activeUsersWithReceipts}
                subLabel="Con almeno 1 incasso"
                iconClassName="bg-warning-muted"
              />
              {data.notificationStats && (
                <AdminStatCard
                  icon={<Bell className="h-5 w-5 text-violet-500" />}
                  label="Notifiche Lette"
                  value={data.notificationStats.readNotifications}
                  subLabel={`${data.notificationStats.totalNotifications} totali · ${data.notificationStats.overallOpenRate}% apertura`}
                  iconClassName="bg-violet-500/10"
                />
              )}
              <AdminStatCard
                icon={<Mail className="h-5 w-5 text-teal-500" />}
                label="Consenso Email"
                value={data.usage.usersWithFeedbackEmailConsent ?? 0}
                subLabel="utenti opt-in"
                iconClassName="bg-teal-500/10"
              />
              {(data.accountDeletions ?? 0) > 0 && (
                <AdminStatCard
                  icon={<UserX className="h-5 w-5 text-red-500" />}
                  label="Account Eliminati"
                  value={data.accountDeletions!}
                  subLabel="utenti cancellati"
                  iconClassName="bg-red-500/10"
                />
              )}
            </div>

            {/* Gestione INPS Metrics */}
            {data.gestioneMetrics && <AdminGestioneMetrics data={data.gestioneMetrics} distribution={data.gestioneDistribution} />}

            {/* Derived Metrics (FR52) */}
            {data.derivedMetrics && <AdminDerivedMetrics data={data.derivedMetrics} />}

            {/* User Activity Report (Story 28-1) */}
            <AdminUserActivityReport
              activityKpi={data.activityKpi}
              signupTrend={data.signupTrend}
              activityTrend={data.activityTrend}
            />

            {/* TTV Stats (Story 70-2) */}
            <AdminTTVWidget />

            {/* NSM Mini Widget (Story 75-2b) */}
            <AdminNSMMiniCard />

            {/* NSM tasse segnate pagate + accuratezza stime (Epic 82) */}
            <AdminMarkPaidNsmCard />

            {/* Wizard Funnel (Story 70-3) */}
            <AdminWizardFunnel />

            {/* A/B Test Wizard Comparison (Story 70-5) */}
            <AdminABComparison />

            {/* CTA Funnel Analytics (Story 22-2) */}
            {data.ctaAnalytics && <AdminCTAAnalytics data={data.ctaAnalytics} />}

            {/* Waitlist Pro */}
            <AdminProWaitlist />

            {/* Newsletter Dashboard (Story 71-4) */}
            <AdminNewsletterDashboard />

            {/* Pricing Survey Results (Van Westendorp) */}
            <PricingSurveyResults />

            {/* Calendar Usage Survey (Story 48.1) */}
            <CalendarSurveyResults />

            {/* NPS Campaign Config (Story 51.1) */}
            <NpsCampaignConfig />

            {/* NPS Dashboard Analytics (Story 51.2) */}
            <NpsDashboard />

            {/* Benchmark Usage Stats (Story 46.3) */}
            <BenchmarkUsageStats />

            {/* Contributions Leaderboard (Epic 26) */}
            <AdminContributions />

            {/* Export Utenti Qualificati (Epic 41) */}
            <AdminQualifiedUsersExport />

            {/* Action Config (Epic 26 - Punti configurabili) */}
            <AdminActionConfig />

            {/* Milestones CRUD (Epic 26 - Traguardi) */}
            <AdminMilestones />

            {/* Broadcast Announcements */}
            <AdminAnnouncementSection
              announcementReadCounts={data.notificationStats?.announcementReadCounts}
            />

            {/* Invio Email Resend (Story 44.2) */}
            <AdminSendEmail />

            {/* Invio test a me stesso — un clic (sopra il pannello avanzato) */}
            <AdminDeadlineEmailSelfTest />

            {/* Promemoria Scadenza — Invio Manuale (Story 84.4) */}
            <AdminDeadlineEmailTrigger />

            {/* Metriche Email Scadenze (Story 84.9) */}
            <AdminDeadlineEmailMetrics />

            {/* Feedback Post-Scadenza (Story 25.5) */}
            <AdminFeedbackStats />

            {/* Sicurezza — Device Trust Toggle + Soglia OTP (Story 67.2/67.3) */}
            <AdminSecuritySettings />

            {/* Statistiche OTP (Story 67.3) */}
            <AdminOtpStats />

            {/* User Table */}
            <AdminUserTable users={data.userList} onOverrideChange={handleOverrideChange} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
