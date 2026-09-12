/**
 * Test per Calendario.tsx — OAuth callback integration
 * Story 48.3 — Verifica che al mount con ?code=X&state=Y il callback viene triggerato,
 * e che ?error=access_denied mostra lo stato denial.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// ── Mocks — must be BEFORE the component import ──

const mockNavigate = vi.fn();
const mockHandleCallback = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/hooks/useCalendarConnection", () => ({
  useCalendarConnection: () => ({
    connection: null,
    isConnected: false,
    isLoading: false,
    error: null,
    connectGoogle: vi.fn(),
    handleCallback: mockHandleCallback,
    isCallbackLoading: false,
    isCallbackSuccess: false,
  }),
}));

vi.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: () => ({
    events: [],
    getEventsForDay: () => [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
    session: { access_token: "test-token" },
  }),
}));

vi.mock("@/hooks/useMarkAsPaid", () => ({
  useMarkAsPaid: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));

vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: ({ title }: { title: string }) =>
    createElement("div", null, title),
}));

vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children),
}));

vi.mock("@/components/calendario/CalendarSurveyBanner", () => ({
  CalendarSurveyBanner: () => null,
}));

vi.mock("@/components/calendario/GoogleCalendarConnect", () => ({
  GoogleCalendarConnect: ({ denied }: { denied?: boolean }) =>
    createElement("div", { "data-testid": "gcal-connect", "data-denied": String(!!denied) }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: true, isLoading: false, tier: "pro" }),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Now import the component under test ──

import CalendarioPage from "../Calendario";

function renderWithRouter(initialEntry = "/calendario") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        createElement(CalendarioPage)
      )
    )
  );
}

describe("Calendario — OAuth callback handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls handleCallback when URL has ?code and ?state", async () => {
    renderWithRouter("/calendario?code=auth-code-xyz&state=user-123");

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledWith("auth-code-xyz", "user-123");
    });

    // Should clean up URL
    expect(mockNavigate).toHaveBeenCalledWith("/calendario", { replace: true });
  });

  it("sets denied=true on GoogleCalendarConnect when ?error=access_denied", async () => {
    renderWithRouter("/calendario?error=access_denied");

    await waitFor(() => {
      const gcalConnect = screen.getByTestId("gcal-connect");
      expect(gcalConnect.getAttribute("data-denied")).toBe("true");
    });

    // Should clean up URL
    expect(mockNavigate).toHaveBeenCalledWith("/calendario", { replace: true });
  });

  it("does not call handleCallback on normal page load", async () => {
    renderWithRouter("/calendario");

    // Wait a tick to ensure effect ran
    await waitFor(() => {
      expect(screen.getByTestId("gcal-connect")).toBeInTheDocument();
    });

    expect(mockHandleCallback).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
