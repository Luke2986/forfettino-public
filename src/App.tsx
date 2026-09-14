import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { FiscalYearProvider } from "@/contexts/FiscalYearContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/auth/AdminProtectedRoute";
import { MfaProtectedRoute } from "@/components/auth/MfaProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { isGuideLive } from "@/lib/feature-gates";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { EmailClickTracker } from "@/components/analytics/EmailClickTracker";

/**
 * Renders null. Invoca usePWAUpdate per forzare periodic-check del SW e
 * auto-reload quando una nuova versione dell'app e' disponibile.
 * Evita che l'utente rimanga bloccato su build vecchie a causa della
 * cache HTTP del browser su `sw.js`.
 */
function PWAUpdater() {
  usePWAUpdate();
  return null;
}

// Legal pages (lazy-loaded, public)
const PrivacyPolicyPage = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const CookiePolicyPage = lazyWithRetry(() => import("./pages/CookiePolicy"));
const TermsOfServicePage = lazyWithRetry(() => import("./pages/TermsOfService"));
const BentoDemoPage = lazyWithRetry(() => import("./pages/BentoDemo"));
const BenchmarkPage = lazyWithRetry(() => import("./pages/Benchmark"));
const ReportFatturatoPage = lazyWithRetry(() => import("./pages/ReportClienti"));
const TaskPage = lazyWithRetry(() => import("./pages/TaskPage"));
const ConfermaEmailPage = lazyWithRetry(() => import("./pages/ConfermaEmail"));
const CalcolatoreForfettarioPage = lazyWithRetry(() => import("./pages/CalcolatoreForfettario"));
const ProLaunchTeaserPage = lazyWithRetry(() => import("./pages/ProLaunchTeaser"));
const FaqPage = lazyWithRetry(() => import("./pages/FaqPage"));
const GlossarioPage = lazyWithRetry(() => import("./pages/GlossarioPage"));

// Pages — eagerly loaded (critical path)
import NotFound from "./pages/NotFound";

// Pages — lazy-loaded (protected, not needed at initial load)
const AuthPage = lazyWithRetry(() => import("./pages/Auth"));
const AuthCallbackPage = lazyWithRetry(() => import("./pages/AuthCallback"));
const ResetPasswordPage = lazyWithRetry(() => import("./pages/ResetPassword"));
const WizardPage = lazyWithRetry(() => import("./pages/Wizard"));
const DashboardPage = lazyWithRetry(() => import("./pages/Dashboard"));
const ClientiPage = lazyWithRetry(() => import("./pages/Clienti"));
const IncassiPage = lazyWithRetry(() => import("./pages/Incassi"));
const NuovoIncassoPage = lazyWithRetry(() => import("./pages/NuovoIncasso"));
const CalendarioPage = lazyWithRetry(() => import("./pages/Calendario"));
const ScadenziarioPage = lazyWithRetry(() => import("./pages/Scadenziario"));
const ToolPage = lazyWithRetry(() => import("./pages/Tool"));
const ImpostazioniPage = lazyWithRetry(() => import("./pages/Impostazioni"));
const FeedbackPage = lazyWithRetry(() => import("./pages/Feedback"));
const SupportoPage = lazyWithRetry(() => import("./pages/Supporto"));
const MessaggiPage = lazyWithRetry(() => import("./pages/Messaggi"));
const AdminFiscalRulesPage = lazyWithRetry(() => import("./pages/AdminFiscalRules"));
const GuidePerTePage = lazyWithRetry(() => import("./pages/GuidePerTe"));
const ClassificaPage = lazyWithRetry(() => import("./pages/Classifica"));
const ReferralLandingPage = lazyWithRetry(() => import("./pages/ReferralLanding"));
const BudgetPage = lazyWithRetry(() => import("./pages/Budget"));

// MFA Pages (lazy)
const MfaSetupPage = lazyWithRetry(() => import("./pages/mfa/MfaSetup"));
const MfaVerifyPage = lazyWithRetry(() => import("./pages/mfa/MfaVerify"));

/** Scroll to top on route change + disable browser scroll restoration */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Backward-compat redirect: /r/:code → /referral/:code */
function OldReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  return <Navigate to={`/referral/${code ?? ""}`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — dati dashboard freschi ma senza refetch continuo
      refetchOnWindowFocus: false, // Evita refetch ad ogni focus tab
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <PWAUpdater />
      <AuthProvider>
        <SubscriptionProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            {/* 84-6: cattura deadline_email_clicked al primo load, sopra le route protette,
                prima del redirect di auth che altrimenti consuma gli UTM dall'URL. */}
            <EmailClickTracker />
            <FiscalYearProvider>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Suspense fallback={null}><AuthPage /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
              <Route path="/auth/callback" element={<Suspense fallback={null}><AuthCallbackPage /></Suspense>} />

              {/* Legacy redirect */}
              <Route path="/auth" element={<Navigate to="/login" replace />} />

              {/* MFA routes (require auth but NOT MfaGate to avoid loops) */}
              <Route path="/mfa/setup" element={<MfaProtectedRoute><Suspense fallback={null}><MfaSetupPage /></Suspense></MfaProtectedRoute>} />
              <Route path="/mfa/verify" element={<MfaProtectedRoute><Suspense fallback={null}><MfaVerifyPage /></Suspense></MfaProtectedRoute>} />

              {/* Protected routes */}
              <Route
                path="/wizard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><WizardPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><DashboardPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clienti"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><ClientiPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/incassi"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><IncassiPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/incassi/nuovo"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><NuovoIncassoPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendario"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><CalendarioPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scadenziario"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><ScadenziarioPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tool"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><ToolPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/impostazioni"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><ImpostazioniPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messaggi"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><MessaggiPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feedback"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><FeedbackPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/supporto"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><SupportoPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/parametri"
                element={
                  <AdminProtectedRoute>
                    <Suspense fallback={null}><AdminFiscalRulesPage /></Suspense>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/guide-per-te"
                element={
                  isGuideLive() ? (
                    <ProtectedRoute>
                      <Suspense fallback={null}><GuidePerTePage /></Suspense>
                    </ProtectedRoute>
                  ) : (
                    <AdminProtectedRoute>
                      <Suspense fallback={null}><GuidePerTePage /></Suspense>
                    </AdminProtectedRoute>
                  )
                }
              />

              {/* Task Board Personale (Pro + Admin) */}
              <Route
                path="/task"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><TaskPage /></Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Allocazione Netto Spendibile (protected, sidebar admin-only) */}
              <Route
                path="/budget"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><BudgetPage /></Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Benchmark Comparatore Tariffe (protected, sidebar pro-only) */}
              <Route
                path="/benchmark"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><BenchmarkPage /></Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Report Fatturato (protected, sidebar pro-only) */}
              <Route
                path="/report"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><ReportFatturatoPage /></Suspense>
                  </ProtectedRoute>
                }
              />
              {/* Redirect vecchio path */}
              <Route path="/report-clienti" element={<Navigate to="/report" replace />} />

              {/* Il tuo contributo (protected) */}
              <Route
                path="/classifica"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}><ClassificaPage /></Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Referral landing (public) */}
              <Route path="/referral/:code" element={<Suspense fallback={null}><ReferralLandingPage /></Suspense>} />
              {/* Backward compat: old /r/:code links redirect to new path */}
              <Route path="/r/:code" element={<OldReferralRedirect />} />

              {/* Calculator standalone page (public, SEO) */}
              <Route path="/calcolatore-forfettario" element={<Suspense fallback={null}><CalcolatoreForfettarioPage /></Suspense>} />

              {/* PRO launch teaser (public, SEO) */}
              <Route path="/pro-presto" element={<Suspense fallback={null}><ProLaunchTeaserPage /></Suspense>} />

              {/* FAQ page (public, SEO — story 79.9) */}
              <Route path="/faq" element={<Suspense fallback={null}><FaqPage /></Suspense>} />

              {/* Glossary page (public, SEO/GEO — story 79.10) */}
              <Route path="/glossario" element={<Suspense fallback={null}><GlossarioPage /></Suspense>} />

              {/* Newsletter confirmation (public, no auth required) */}
              <Route path="/conferma-email" element={<Suspense fallback={null}><ConfermaEmailPage /></Suspense>} />

              {/* Legal pages (public, no auth required) */}
              <Route path="/privacy-policy" element={<Suspense fallback={null}><PrivacyPolicyPage /></Suspense>} />
              <Route path="/cookie-policy" element={<Suspense fallback={null}><CookiePolicyPage /></Suspense>} />
              <Route path="/terms" element={<Suspense fallback={null}><TermsOfServicePage /></Suspense>} />

              {/* Demo (public, dev only) */}
              <Route path="/bento-demo" element={<Suspense fallback={null}><BentoDemoPage /></Suspense>} />

              {/* No public marketing site in questo snapshot: root → login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </FiscalYearProvider>
          </BrowserRouter>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
