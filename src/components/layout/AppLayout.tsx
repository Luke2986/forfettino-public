import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MessageCircle, Megaphone, CalendarCheck, Info, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileMenuProvider } from "./MobileMenuContext";
import { MobileMenuSheet } from "./MobileMenuSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFiscalRulesSync } from "@/hooks/useFiscalRulesSync";
import { useDeadlineNotificationCheck } from "@/hooks/useDeadlineNotificationCheck";
import { useDigestNotificationCheck } from "@/hooks/useDigestNotificationCheck";
import { useBlockingModalQueue } from "@/hooks/useBlockingModalQueue";
import { BlockingModal } from "@/components/notifications/BlockingModal";
import { GenericPopupContent } from "@/components/notifications/GenericPopupContent";
import { FeedbackPostScadenza } from "@/components/notifications/FeedbackPostScadenza";
import { useDeadlineFeedback } from "@/hooks/useDeadlineFeedback";
import { trackSession } from "@/lib/session-tracker";
import { usePrivacyConsent } from "@/hooks/usePrivacyConsent";
import { PrivacyConsentModal } from "@/components/legal/PrivacyConsentModal";
import { useFeedbackEmailConsent } from "@/hooks/useFeedbackEmailConsent";
import { useProfile } from "@/hooks/useProfile";
import { setAnalyticsConsent, syncPosthogUserProperties } from "@/lib/analytics";
import { useNpsTrigger } from "@/hooks/useNpsTrigger";
import { useNpsSidebarButton } from "@/hooks/useNpsSidebarButton";
import { NpsSurveyPopup } from "@/components/nps/NpsSurveyPopup";
import { InstallBanner } from "@/components/pwa/InstallBanner";

/** Mappa tipo notifica → icona per il pop-up modale (Story 25.2) */
function getPopupIcon(type: string): LucideIcon {
  switch (type) {
    case "admin_individual":
      return MessageCircle;
    case "admin_announcement":
      return Megaphone;
    case "feedback_request":
      return CalendarCheck;
    default:
      return Info;
  }
}

interface AppLayoutProps {
  children: ReactNode;
  /** When true, removes background gradient and max-width constraint (for full-bleed pages like TaskBoard) */
  fullBleed?: boolean;
}

export function AppLayout({ children, fullBleed }: AppLayoutProps) {
  const isMobile = useIsMobile();

  // Traccia sessione utente (Story 22-1) — fire-once per sessione browser
  // useRef persiste across Strict Mode remounts → esattamente 1 call per sessione
  const sessionTracked = useRef(false);
  useEffect(() => {
    if (!sessionTracked.current) {
      sessionTracked.current = true;
      trackSession();
    }
  }, []);

  // Inizializza consent analytics da profilo (Story 35-4, GDPR Art. 21)
  const { data: profile } = useProfile();
  useEffect(() => {
    if (profile) {
      // analytics_consent_at IS NULL → the user never expressed a preference,
      // so a false value is a default, not a refusal (see setAnalyticsConsent).
      setAnalyticsConsent(profile.analytics_consent ?? false, {
        explicit: profile.analytics_consent_at != null,
      });
    }
  }, [profile?.analytics_consent, profile?.analytics_consent_at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync PostHog user properties once per session when profile + consent are ready
  const phSynced = useRef(false);
  useEffect(() => {
    if (profile && profile.analytics_consent && !phSynced.current) {
      phSynced.current = true;
      syncPosthogUserProperties(profile);
    }
  }, [profile]);

  // Sincronizza le fiscal_rules via Supabase Realtime Broadcast (Story 7-2, FR38)
  // Attiva solo per utenti autenticati (AppLayout è dentro ProtectedRoute)
  useFiscalRulesSync();

  // Genera notifiche scadenze al primo accesso giornaliero (Story 9-3, FR48)
  // Debounce 24h via localStorage — errori silenziosi, mai blocca UX
  useDeadlineNotificationCheck();

  // Genera digest periodici in-app: riepilogo mensile, inattività, soglie (Story 9-5, FR49)
  // Debounce 24h via localStorage — errori silenziosi, mai blocca UX
  useDigestNotificationCheck();

  // Consenso privacy obbligatorio — priorità assoluta (Story 35-2, GDPR Art. 7)
  const { needsConsent, isLoading: consentLoading } = usePrivacyConsent();

  // Consenso email feedback — non bloccante, dopo privacy (Story 14-6)
  const { needsEmailConsent } = useFeedbackEmailConsent();

  // Coda FIFO pop-up modali bloccanti (Story 25-2)
  const { currentPopup, dismissCurrent } = useBlockingModalQueue();

  // NPS Survey popup — trigger engine con logica OR (Story 50-3)
  const { shouldShow: showNpsSurvey, triggerSource: npsTriggerSource, activeCampaignId, dismiss: dismissNps } = useNpsTrigger();

  // NPS sidebar button — manual trigger (Story 50-4)
  const { activeCampaignId: sidebarCampaignId } = useNpsSidebarButton();
  const [sidebarNpsOpen, setSidebarNpsOpen] = useState(false);
  const handleOpenNpsSurvey = useCallback(() => {
    dismissNps(); // silence auto-trigger to avoid double popup
    setSidebarNpsOpen(true);
  }, [dismissNps]);
  const handleCloseSidebarNps = useCallback(() => {
    setSidebarNpsOpen(false);
  }, []);

  // Feedback post-scadenza: salva "dismissed" quando utente chiude con X/Escape (Story 25-5)
  const feedbackMutation = useDeadlineFeedback();
  const handleFeedbackDismiss = () => {
    if (currentPopup?.type === "feedback_request" && currentPopup.metadata) {
      const meta = currentPopup.metadata as Record<string, unknown>;
      feedbackMutation.mutate({
        scheduleEventId: String(meta.schedule_id ?? ""),
        notificationId: currentPopup.id,
        response: "dismissed",
      });
    }
    dismissCurrent();
  };

  return (
    <MobileMenuProvider>
      <SidebarProvider open={true} onOpenChange={() => {}}>
        <div className="min-h-screen flex w-full">
          {/* Skip link — WCAG 2.4.1 Bypass Blocks (Story 32-4, A-01) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-teal-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-base"
          >
            Vai al contenuto principale
          </a>

          {/* Desktop sidebar - hidden on mobile */}
          {!isMobile && <AppSidebar onOpenNpsSurvey={handleOpenNpsSurvey} />}

          {/* Mobile menu sheet */}
          <MobileMenuSheet onOpenNpsSurvey={handleOpenNpsSurvey} />

          {/* Fix H1: maschera i dati fiscali sensibili (importi, redditi, INPS, PII)
              nelle registrazioni di sessione Microsoft Clarity. L'attributo cascata
              a tutti i discendenti del guscio autenticato; le pagine pubbliche/blog
              (fuori da AppLayout) restano non mascherate per l'analisi di conversione.
              Per esporre un elemento non sensibile usare data-clarity-unmask="true". */}
          <main id="main-content" data-clarity-mask="true" className={cn(
            "flex-1 flex flex-col",
            fullBleed
              ? "overflow-hidden"
              : "overflow-auto bg-gradient-to-b from-[#d1e8df] via-[#b8ddd0] to-[#9fd1c1]"
          )}>
            <div className={cn(
              "animate-page-enter flex-1 flex flex-col w-full",
              !fullBleed && "max-w-5xl mx-auto"
            )}>
              {children}
            </div>
          </main>
        </div>

        {/* Modal consenso privacy — priorità assoluta, PRIMA del FIFO (Story 35-2) */}
        <PrivacyConsentModal />

        {/* FeedbackEmailConsentModal spostato in Dashboard.tsx con ritardo 80s — needsEmailConsent resta per priorità FIFO/NPS */}

        {/* Pop-up modale bloccante FIFO (Story 25-2) — nascosto se consent pendente o email consent pendente */}
        {!needsConsent && !consentLoading && !needsEmailConsent && currentPopup && (
          <BlockingModal
            open={true}
            onDismiss={currentPopup.type === "feedback_request" ? handleFeedbackDismiss : dismissCurrent}
            icon={getPopupIcon(currentPopup.type)}
            title={currentPopup.title}
          >
            {currentPopup.type === "feedback_request" ? (
              <FeedbackPostScadenza
                scadenzaName={String((currentPopup.metadata as Record<string, unknown>)?.bucket_label ?? currentPopup.title)}
                scheduleEventId={String((currentPopup.metadata as Record<string, unknown>)?.schedule_id ?? "")}
                notificationId={currentPopup.id}
                onComplete={dismissCurrent}
              />
            ) : (
              <GenericPopupContent notification={currentPopup} onDismiss={dismissCurrent} />
            )}
          </BlockingModal>
        )}

        {/* Pop-up NPS survey — automatic trigger, priorità più bassa dopo FIFO (Story 50-2) */}
        {!needsConsent && !consentLoading && !needsEmailConsent && !currentPopup && showNpsSurvey && (
          <BlockingModal
            open={true}
            onDismiss={dismissNps}
            icon={Gift}
            iconBg="bg-teal-50"
            title="Ho un regalo per te!"
          >
            <NpsSurveyPopup
              onDismiss={dismissNps}
              onComplete={dismissNps}
              triggerSource={npsTriggerSource ?? "unknown"}
              campaignId={activeCampaignId}
            />
          </BlockingModal>
        )}

        {/* Pop-up NPS survey — sidebar button trigger, explicit user action (Story 50-4)
            Bypasses needsEmailConsent and showNpsSurvey gates — user clicked intentionally.
            Only blocked by privacy consent (legal requirement) and FIFO queue (avoid stacking). */}
        {!needsConsent && !consentLoading && !currentPopup && sidebarNpsOpen && (
          <BlockingModal
            open={true}
            onDismiss={handleCloseSidebarNps}
            icon={Gift}
            iconBg="bg-teal-50"
            title="Ho un regalo per te!"
          >
            <NpsSurveyPopup
              onDismiss={handleCloseSidebarNps}
              onComplete={handleCloseSidebarNps}
              triggerSource="sidebar_button"
              campaignId={sidebarCampaignId}
            />
          </BlockingModal>
        )}
        {/* PWA install banner — Android only, fixed position overlay (Story 68-3) */}
        <InstallBanner />
      </SidebarProvider>
    </MobileMenuProvider>
  );
}
