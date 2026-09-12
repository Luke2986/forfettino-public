/**
 * Test per Admin Page — Consenso Email Stat Card (Story 14.4)
 *
 * Copertura:
 * - Card "Consenso Email" renderizzata con il contatore corretto
 * - subLabel "utenti opt-in" visibile
 * - Card renderizzata anche con valore 0
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import type { ReactNode } from "react";

// Mock hooks
const mockAdminStats = {
  users: { total: 50, onboarded: 40, onboardingRate: 80, signupsThisMonth: 5, signupsByMonth: [] },
  subscriptions: { proCount: 3, conversionRate: 6, mrrCents: 3000, arrCents: 36000, pendingChurnCount: 0, churnRate: 0 },
  usage: { activeUsersWithReceipts: 20, usersWithFeedbackEmailConsent: 12 },
  userList: [],
  gestioneMetrics: {
    separata: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0 },
    artigiani: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0 },
    commercianti: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0 },
  },
  derivedMetrics: { retentionRate: 0, avgReceiptsPerUser: 0, freeReceiptDistribution: [] },
  notificationStats: { totalNotifications: 100, readNotifications: 60, overallOpenRate: 60, announcementReadCounts: {} },
};

vi.mock("@/hooks/useAdminStats", () => ({
  useAdminStats: () => ({
    data: mockAdminStats,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Mock complex child components that don't need rendering
vi.mock("@/components/admin/AdminUserActivityReport", () => ({
  AdminUserActivityReport: () => <div data-testid="activity-report" />,
}));
vi.mock("@/components/admin/AdminUserTable", () => ({
  AdminUserTable: () => <div data-testid="user-table" />,
}));
vi.mock("@/components/admin/AdminGestioneMetrics", () => ({
  AdminGestioneMetrics: () => <div data-testid="gestione-metrics" />,
}));
vi.mock("@/components/admin/AdminDerivedMetrics", () => ({
  AdminDerivedMetrics: () => <div data-testid="derived-metrics" />,
}));
vi.mock("@/components/admin/AdminAnnouncementSection", () => ({
  AdminAnnouncementSection: () => <div data-testid="announcements" />,
}));
vi.mock("@/components/admin/AdminCTAAnalytics", () => ({
  AdminCTAAnalytics: () => <div data-testid="cta-analytics" />,
}));
vi.mock("@/components/admin/AdminContributions", () => ({
  AdminContributions: () => <div data-testid="contributions" />,
}));
vi.mock("@/components/admin/AdminMilestones", () => ({
  AdminMilestones: () => <div data-testid="milestones" />,
}));
vi.mock("@/components/admin/AdminActionConfig", () => ({
  AdminActionConfig: () => <div data-testid="action-config" />,
}));
vi.mock("@/components/admin/PricingSurveyResults", () => ({
  PricingSurveyResults: () => <div data-testid="pricing-survey" />,
}));
vi.mock("@/components/admin/AdminFeedbackStats", () => ({
  AdminFeedbackStats: () => <div data-testid="feedback-stats" />,
}));
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));

import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-user", email: "admin@test.com" }, loading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: true, isLoading: false, tier: "pro" }),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import AdminPage from "../Admin";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe("Admin Page — Consenso Email Stat Card (Story 14.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Consenso Email card with correct count", () => {
    render(<AdminPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Consenso Email")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("utenti opt-in")).toBeInTheDocument();
  });

  it("renders card even when consent count is 0", () => {
    mockAdminStats.usage.usersWithFeedbackEmailConsent = 0;

    render(<AdminPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Consenso Email")).toBeInTheDocument();
    expect(screen.getByText("utenti opt-in")).toBeInTheDocument();

    // Restore
    mockAdminStats.usage.usersWithFeedbackEmailConsent = 12;
  });
});
