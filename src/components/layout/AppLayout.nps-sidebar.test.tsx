/**
 * Test AppLayout — sidebar NPS popup integration (Story 50-4)
 * Verifica: trigger_source 'sidebar_button', priorità modale, coordinamento push/pull
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
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

// Mock AppSidebar — capture onOpenNpsSurvey prop
let capturedOnOpenNpsSurvey: (() => void) | undefined;
vi.mock("./AppSidebar", () => ({
  AppSidebar: (props: { onOpenNpsSurvey?: () => void }) => {
    capturedOnOpenNpsSurvey = props.onOpenNpsSurvey;
    return createElement("nav", { "data-testid": "sidebar" });
  },
}));
vi.mock("./MobileMenuSheet", () => ({ MobileMenuSheet: () => null }));
vi.mock("./MobileMenuContext", () => ({
  MobileMenuProvider: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

// Mock BlockingModal — render title + children
vi.mock("@/components/notifications/BlockingModal", () => ({
  BlockingModal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? createElement("div", { "data-testid": "blocking-modal" }, createElement("h2", null, title), children) : null,
}));

// Mock NpsSurveyPopup — render trigger source
vi.mock("@/components/nps/NpsSurveyPopup", () => ({
  NpsSurveyPopup: ({ triggerSource }: { triggerSource: string }) =>
    createElement("div", { "data-testid": "nps-popup", "data-trigger": triggerSource }),
}));

vi.mock("@/components/notifications/GenericPopupContent", () => ({
  GenericPopupContent: () => null,
}));
vi.mock("@/components/notifications/FeedbackPostScadenza", () => ({
  FeedbackPostScadenza: () => null,
}));
vi.mock("@/hooks/useDeadlineFeedback", () => ({
  useDeadlineFeedback: () => ({ mutate: vi.fn(), isPending: false }),
}));

// FIFO queue
const mockPopupData = { currentPopup: null as Record<string, unknown> | null, dismissCurrent: vi.fn(), queueLength: 0 };
vi.mock("@/hooks/useBlockingModalQueue", () => ({
  useBlockingModalQueue: () => mockPopupData,
}));

// Privacy / consent
vi.mock("@/hooks/usePrivacyConsent", () => ({
  usePrivacyConsent: () => ({ needsConsent: false, isFirstTime: false, acceptConsent: vi.fn(), isLoading: false, isPending: false }),
}));
vi.mock("@/components/legal/PrivacyConsentModal", () => ({ PrivacyConsentModal: () => null }));
vi.mock("@/components/legal/FeedbackEmailConsentModal", () => ({ FeedbackEmailConsentModal: () => null }));
vi.mock("@/hooks/useFeedbackEmailConsent", () => ({
  useFeedbackEmailConsent: () => ({ needsEmailConsent: false, isLoading: false }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { analytics_consent: true }, isLoading: false }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/analytics", () => ({ setAnalyticsConsent: vi.fn(), syncPosthogUserProperties: vi.fn() }));

// NPS sidebar button — used directly in AppLayout (Story 50-4)
vi.mock("@/hooks/useNpsSidebarButton", () => ({
  useNpsSidebarButton: () => ({ isVisible: false, activeCampaignId: "camp-1", isLoading: false }),
}));

// NPS trigger — controllabile
const mockNpsTrigger = {
  shouldShow: false,
  triggerSource: null as string | null,
  activeCampaignId: "camp-1",
  dismiss: vi.fn(() => {
    // Simulate real dismiss behavior — clears shouldShow on next render
    mockNpsTrigger.shouldShow = false;
    mockNpsTrigger.triggerSource = null;
  }),
};
vi.mock("@/hooks/useNpsTrigger", () => ({
  useNpsTrigger: () => mockNpsTrigger,
}));

// --- Helpers ---

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(MemoryRouter, null, children));
}

function renderLayout() {
  return render(
    createElement(AppLayout, null, createElement("div", null, "page content")),
    { wrapper: createWrapper() },
  );
}

describe("AppLayout — sidebar NPS popup (Story 50-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnOpenNpsSurvey = undefined;
    mockPopupData.currentPopup = null;
    mockPopupData.queueLength = 0;
    mockNpsTrigger.shouldShow = false;
    mockNpsTrigger.triggerSource = null;
    mockNpsTrigger.activeCampaignId = "camp-1";
  });

  it("passes onOpenNpsSurvey callback to AppSidebar", () => {
    renderLayout();
    expect(capturedOnOpenNpsSurvey).toBeTypeOf("function");
  });

  it("opens sidebar NPS popup with trigger_source 'sidebar_button' when callback fires", async () => {
    renderLayout();

    // Simulate sidebar button click inside act
    act(() => {
      capturedOnOpenNpsSurvey!();
    });

    await waitFor(() => {
      const popup = screen.getByTestId("nps-popup");
      expect(popup.getAttribute("data-trigger")).toBe("sidebar_button");
    });
  });

  it("sidebar NPS popup does NOT open when FIFO popup is active", () => {
    mockPopupData.currentPopup = { id: "n1", type: "admin_broadcast", title: "Admin msg", body: "test" };

    renderLayout();
    act(() => {
      capturedOnOpenNpsSurvey!();
    });

    // FIFO modal should be shown, but NPS popup should NOT
    expect(screen.queryByTestId("nps-popup")).toBeNull();
  });

  it("sidebar NPS popup dismisses auto-trigger and opens with sidebar_button source", async () => {
    mockNpsTrigger.shouldShow = true;
    mockNpsTrigger.triggerSource = "third_receipt";

    renderLayout();
    act(() => {
      capturedOnOpenNpsSurvey!();
    });

    // dismiss should have been called to silence the auto-trigger
    expect(mockNpsTrigger.dismiss).toHaveBeenCalled();

    // The sidebar popup should open with sidebar_button trigger
    await waitFor(() => {
      const popup = screen.getByTestId("nps-popup");
      expect(popup.getAttribute("data-trigger")).toBe("sidebar_button");
    });
  });
});
