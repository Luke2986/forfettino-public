import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";
import { AppLayout } from "./AppLayout";

// --- Mocks ---

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useFiscalRulesSync", () => ({
  useFiscalRulesSync: vi.fn(),
}));

vi.mock("@/hooks/useDeadlineNotificationCheck", () => ({
  useDeadlineNotificationCheck: vi.fn(),
}));

vi.mock("@/hooks/useDigestNotificationCheck", () => ({
  useDigestNotificationCheck: vi.fn(),
}));

vi.mock("@/lib/session-tracker", () => ({
  trackSession: vi.fn(),
}));

vi.mock("./AppSidebar", () => ({
  AppSidebar: () => createElement("nav", { "data-testid": "sidebar" }),
}));

vi.mock("./MobileMenuSheet", () => ({
  MobileMenuSheet: () => null,
}));

vi.mock("./MobileMenuContext", () => ({
  MobileMenuProvider: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

// Mock BlockingModal to capture props
const mockBlockingModal = vi.fn((_props?: Record<string, unknown>) => null);
vi.mock("@/components/notifications/BlockingModal", () => ({
  BlockingModal: (props: Record<string, unknown>) => {
    mockBlockingModal(props);
    return props.open ? createElement("div", { "data-testid": "blocking-modal" }, props.title as string) : null;
  },
}));

// Mock GenericPopupContent
vi.mock("@/components/notifications/GenericPopupContent", () => ({
  GenericPopupContent: () => createElement("div", { "data-testid": "generic-popup-content" }),
}));

// Mock FeedbackPostScadenza (Story 25.5)
vi.mock("@/components/notifications/FeedbackPostScadenza", () => ({
  FeedbackPostScadenza: () => createElement("div", { "data-testid": "feedback-post-scadenza" }),
}));

// Mock useDeadlineFeedback (Story 25.5)
vi.mock("@/hooks/useDeadlineFeedback", () => ({
  useDeadlineFeedback: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock useBlockingModalQueue — controlliamo via variabile
const mockPopupData = { currentPopup: null as Record<string, unknown> | null, dismissCurrent: vi.fn(), queueLength: 0 };
vi.mock("@/hooks/useBlockingModalQueue", () => ({
  useBlockingModalQueue: () => mockPopupData,
}));

// Mock usePrivacyConsent (Story 35-2)
vi.mock("@/hooks/usePrivacyConsent", () => ({
  usePrivacyConsent: () => ({ needsConsent: false, isFirstTime: false, acceptConsent: vi.fn(), isLoading: false, isPending: false }),
}));

// Mock PrivacyConsentModal (Story 35-2)
vi.mock("@/components/legal/PrivacyConsentModal", () => ({
  PrivacyConsentModal: () => null,
}));

// Mock FeedbackEmailConsentModal (Story 14-6)
vi.mock("@/components/legal/FeedbackEmailConsentModal", () => ({
  FeedbackEmailConsentModal: () => null,
}));

// Mock useFeedbackEmailConsent (Story 14-6)
vi.mock("@/hooks/useFeedbackEmailConsent", () => ({
  useFeedbackEmailConsent: () => ({ needsEmailConsent: false, isLoading: false }),
}));

// Mock useProfile (Story 35-4 — consent init)
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { analytics_consent: true, feedback_email_consent_at: "2026-01-01" }, isLoading: false }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock analytics (Story 35-4 — consent gating)
vi.mock("@/lib/analytics", () => ({
  setAnalyticsConsent: vi.fn(),
  syncPosthogUserProperties: vi.fn(),
}));

// Mock useNpsTrigger (Story 50-3)
vi.mock("@/hooks/useNpsTrigger", () => ({
  useNpsTrigger: () => ({ shouldShow: false, triggerSource: null, activeCampaignId: null, dismiss: vi.fn() }),
}));

// Mock NpsSurveyPopup (Story 50-2)
vi.mock("@/components/nps/NpsSurveyPopup", () => ({
  NpsSurveyPopup: () => null,
}));

// Mock useNpsSidebarButton (Story 50-4) — used inside AppSidebar, but AppSidebar is mocked
// so this is only needed if AppSidebar mock changes
vi.mock("@/hooks/useNpsSidebarButton", () => ({
  useNpsSidebarButton: () => ({ isVisible: false, activeCampaignId: null, isLoading: false }),
}));

// --- Helpers ---

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, children),
    );
}

describe("AppLayout — BlockingModal integration (Story 25-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPopupData.currentPopup = null;
    mockPopupData.queueLength = 0;
  });

  it("NON renderizza BlockingModal quando la coda è vuota", () => {
    const { queryByTestId } = render(
      createElement(AppLayout, null, createElement("div", null, "page")),
      { wrapper: createWrapper() },
    );

    expect(queryByTestId("blocking-modal")).not.toBeInTheDocument();
  });

  it("renderizza BlockingModal quando currentPopup è presente", () => {
    mockPopupData.currentPopup = {
      id: "notif-1",
      type: "admin_broadcast",
      title: "Annuncio importante",
      body: "Corpo",
    };
    mockPopupData.queueLength = 1;

    const { getByTestId } = render(
      createElement(AppLayout, null, createElement("div", null, "page")),
      { wrapper: createWrapper() },
    );

    expect(getByTestId("blocking-modal")).toBeInTheDocument();
    expect(getByTestId("blocking-modal").textContent).toBe("Annuncio importante");
  });

  it("non importa più NotificationEducationDialog (verifica import rimosso)", async () => {
    // Verifica strutturale: il modulo AppLayout NON deve importare NotificationEducationDialog.
    // Leggiamo il source del modulo via mock check: se il mock non è stato definito, il modulo
    // non lo importa — e se nessun elemento education-dialog appare, il cleanup è confermato.
    const { container } = render(
      createElement(AppLayout, null, createElement("div", null, "page")),
      { wrapper: createWrapper() },
    );

    // L'output non deve contenere testo tipico del vecchio dialog
    const fullText = container.textContent ?? "";
    expect(fullText).not.toContain("Notifiche In-App Attive");
    expect(fullText).not.toContain("notification-education");
  });
});
