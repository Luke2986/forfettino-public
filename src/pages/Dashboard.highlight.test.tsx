/**
 * Test per Dashboard.tsx — Highlight Pulse post-incasso
 * Story 6.1 — Task 4: Test integrazione Dashboard highlight
 *
 * Copertura:
 * - Task 4.1: Dashboard con ?highlight=spendibile → hero card mostra classe ring-emerald-400
 * - Task 4.2: Highlight cleanup dopo 2.5s, query param rimosso
 * - Task 4.3: prefers-reduced-motion → ring senza animate-pulse (motion-safe:animate-pulse)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// ===== vi.mock (hoisted) =====

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: { first_name: "Luca", last_name: "Test", user_code: "LA26TEST1" },
    refetch: vi.fn(),
  }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({ selectedYear: 2026, setSelectedYear: vi.fn() }),
  FiscalYearProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockMetrics = {
  incassiYTD: 30000,
  taxableAmount: 23400,
  taxAmount: 3510,
  inpsAmount: 6097,
  spendable: 20393,
  totalWithholding: 9607,
  bufferAmount: 0,
  netAfterBuffer: 20393,
  inpsManagement: "separata",
  nextDeadline: null,
  deadlines: [],
  upcomingDeadlines: [],
  expiredRatesCount: 0,
  bannerRateScaduteDismissed: false,
  hasUnpaidOver30d: false,
  unpaidSchedules30d: [],
  saldoInizialeCC: 0,
  unpaidCurrentYearTotal: 0,
  paidCurrentYearTotal: 0,
  currentYearSchedules: [],
  yearlyToolCost: 0,
  currentYearObligations: {
    hasData: false,
    juneTotal: 0,
    novemberTotal: 0,
    yearTotal: 0,
    rateInpsFisseAnnoN: 0,
  },
  fiscalPeak: {
    juneTotal: 5000,
    novemberTotal: 3000,
    yearTotal: 8000,
    saldoTaxNetto: 1500,
    saldoInpsNetto: 1500,
    accontoTax1: 1000,
    accontoInps1: 1000,
    accontoTax2: 1500,
    accontoInps2: 1500,
  },
  settings: {
    taxRate: 15,
    inpsRate: 26.07,
    profitCoeff: 78,
    safetyBuffer: 5,
    reserveAmount: 0,
  },
  // Story 40 — Art/Comm properties (safe defaults for Separata mock)
  daCopireAmount: 9607,
  impostaConDeducibilita: 3510,
  inpsVariabile: 0,
  inpsMinimale: 0,
  inpsTotale: 6097,
  isFirstYearOnly: false,
  spendableRaw: 20393,
};

vi.mock("@/hooks/useFiscalCalculations", () => ({
  useFiscalCalculations: () => ({
    metrics: mockMetrics,
    isLoading: false,
    isError: false,
    currentYear: 2026,
    refetch: vi.fn(),
  }),
  formatCurrency: (val: number) => `€ ${val.toFixed(2).replace(".", ",")}`,
}));

vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({
    data: { count_total: 5, total_gross: 50000, count_ytd: 3, total_gross_ytd: 30000 },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isPro: false,
    isLoading: false,
    canAddReceipt: true,
    canImport: true,
    tier: "free",
  }),
}));

vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({
    isPulling: false,
    pullDistance: 0,
    pullProgress: 0,
    isRefreshing: false,
    handlers: {},
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  ANALYTICS_EVENTS: {
    PAGE_VIEW_DASHBOARD: "page_view_dashboard",
    PAGE_VIEW_SCADENZIARIO: "page_view_scadenziario",
    INCASSO_CREATO: "incasso_creato",
    SCADENZA_PAGATA: "scadenza_pagata",
    ONBOARDING_COMPLETATO: "onboarding_completato",
    CHECKLIST_DISMISSED: "checklist_dismissed",
    NOTIFICA_LETTA: "notifica_letta",
  },
  setAnalyticsConsent: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "app-layout" }, children),
}));

vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));

vi.mock("@/components/shared/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/shared/SectionErrorBoundary", () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/shared/DisclaimerBanner", () => ({
  DisclaimerBanner: () => null,
}));

vi.mock("@/components/shared/CommercialistaFallbackAlert", () => ({
  CommercialistaFallbackAlert: () => null,
}));

vi.mock("@/components/dashboard/PullToRefreshIndicator", () => ({
  PullToRefreshIndicator: () => null,
}));

vi.mock("@/components/dashboard/SogliaForfettarioBanner", () => ({
  SogliaForfettarioBanner: () => null,
  Calibro85k: () => null,
  SogliaInline: () => null,
}));

vi.mock("@/components/dashboard/UpcomingDeadlines", () => ({
  UpcomingDeadlines: () => null,
}));

vi.mock("@/components/dashboard/ScadenzeInline", () => ({
  ScadenzeInline: () => null,
}));

vi.mock("@/components/dashboard/MonthlyRevenueChart", () => ({
  MonthlyRevenueChart: () => null,
}));

vi.mock("@/components/dashboard/InactiveSurveyBanner", () => ({
  InactiveSurveyBanner: () => null,
}));

vi.mock("@/components/dashboard/ExpiredRatesBanner", () => ({
  ExpiredRatesBanner: () => null,
}));

vi.mock("@/components/dashboard/UnpaidSchedulesSummary", () => ({
  UnpaidSchedulesSummary: () => null,
}));

vi.mock("@/components/subscription/UsageCounter", () => ({
  UsageCounter: () => null,
}));

vi.mock("@/components/dashboard/BreakdownSection", () => ({
  BreakdownSection: () => null,
}));

vi.mock("@/components/dashboard/BreakdownLevel2", () => ({
  BreakdownLevel2: () => null,
}));

vi.mock("@/components/dashboard/ExplanationSheet", () => ({
  ExplanationSheet: () => null,
}));

// Mock KpiCard to expose className (highlight) prop
vi.mock("@/components/dashboard/KpiCard", () => ({
  KpiCard: (props: any) =>
    React.createElement(
      "div",
      {
        "data-testid": `kpi-${props.label}`,
        className: props.className || "",
      },
      props.label
    ),
}));

// Mock SpendibileHero — expose shouldHighlight as data attribute + ring classes
vi.mock("@/components/dashboard/SpendibileHero", () => ({
  SpendibileHero: (props: any) =>
    React.createElement(
      "div",
      {
        "data-testid": "spendibile-hero",
        "data-highlight": props.shouldHighlight ? "true" : "false",
        className: props.shouldHighlight ? "ring-2 ring-teal-400 ring-offset-2 motion-safe:animate-pulse" : "",
      },
      "Netto Spendibile"
    ),
}));

// Mock KpiCardRow — pass-through container
vi.mock("@/components/dashboard/KpiCardRow", () => ({
  KpiCardRow: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "kpi-row" }, children),
}));

// Mock DashboardHeader
vi.mock("@/components/dashboard/DashboardHeader", () => ({
  DashboardHeader: () => React.createElement("div", { "data-testid": "dashboard-header" }),
}));

// Mock OnboardingBanner
vi.mock("@/components/dashboard/OnboardingBanner", () => ({
  OnboardingBanner: () => null,
}));

// Mock FirstIncomeBanner — render testid + onDismiss
vi.mock("@/components/dashboard/FirstIncomeBanner", () => ({
  FirstIncomeBanner: (props: any) =>
    React.createElement(
      "div",
      { "data-testid": "first-income-banner" },
      React.createElement("button", {
        "data-testid": "aha-dismiss",
        onClick: props.onDismiss,
      })
    ),
}));

// Mock BannerStack — pass-through container
vi.mock("@/components/dashboard/BannerStack", () => ({
  BannerStack: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

// Mock ImportFattureDialog
vi.mock("@/components/import/ImportFattureDialog", () => ({
  ImportFattureDialog: () => null,
}));

// Mock Supabase (Dashboard uses query + mutation)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            select: () => Promise.resolve({ data: [], error: null }),
          }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

import DashboardPage from "./Dashboard";

function createWrapper(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      HelmetProvider,
      null,
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(MemoryRouter, { initialEntries }, children)
      )
    );
  };
}

describe("Dashboard highlight post-incasso", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Task 4.1: SpendibileHero receives shouldHighlight when ?highlight=spendibile (Epic 13: ring-teal-400)
  it("SpendibileHero receives highlight when URL has ?highlight=spendibile", () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile"]),
    });

    const heroCard = screen.getByTestId("spendibile-hero");
    expect(heroCard.getAttribute("data-highlight")).toBe("true");
    expect(heroCard.className).toContain("ring-2");
    expect(heroCard.className).toContain("ring-teal-400");
  });

  // Task 4.1: SpendibileHero has no highlight when URL has no param
  it("SpendibileHero has no highlight when URL has no highlight param", () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/"]),
    });

    const heroCard = screen.getByTestId("spendibile-hero");
    expect(heroCard.getAttribute("data-highlight")).toBe("false");
    expect(heroCard.className).not.toContain("ring-teal-400");
  });

  // Task 4.2: Only SpendibileHero is highlighted, secondary cards are not
  it("highlight is only on SpendibileHero, not on secondary KPI cards", () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile"]),
    });

    // Hero card gets highlight
    const heroCard = screen.getByTestId("spendibile-hero");
    expect(heroCard.getAttribute("data-highlight")).toBe("true");
    // Secondary KPI cards should NOT have highlight classes
    const allKpiCards = screen.getAllByTestId(/^kpi-/);
    const highlightedKpis = allKpiCards.filter(
      (c) => c.className.includes("ring-teal-400")
    );
    expect(highlightedKpis).toHaveLength(0);
  });

  // Task 4.3: Highlight uses teal-400 ring for visual feedback
  it("highlight className includes ring-teal-400 for visual feedback", () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile"]),
    });

    const heroCard = screen.getByTestId("spendibile-hero");
    expect(heroCard.className).toContain("ring-2");
    expect(heroCard.className).toContain("ring-teal-400");
    expect(heroCard.className).toContain("motion-safe:animate-pulse");
  });
});

// ===== ExpandableDashboardCard — highlight timer + CSS =====

describe("ExpandableDashboardCard highlight timer", () => {
  // These tests use the REAL ExpandableDashboardCard component (not mocked)
  // imported separately to test the internal 2s timer behavior

  // We need a separate import scope, so we test via a simple wrapper
  // that renders the real component with the highlight prop

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies ring-emerald-400 and motion-safe:animate-pulse when highlight=true", async () => {
    // Dynamically import the real component (bypassing the vi.mock above)
    const { ExpandableDashboardCard: RealCard } = await vi.importActual<
      typeof import("@/components/dashboard/ExpandableDashboardCard")
    >("@/components/dashboard/ExpandableDashboardCard");

    const DummyIcon = () => React.createElement("span", null, "icon");

    render(
      React.createElement(RealCard, {
        title: "Test Card",
        value: "€ 100,00",
        description: "Test",
        icon: DummyIcon,
        breakdownContent: React.createElement("div", null, "breakdown"),
        highlight: true,
      })
    );

    const card = screen.getByRole("button");
    expect(card.className).toContain("ring-emerald-400");
    expect(card.className).toContain("motion-safe:animate-pulse");
    // Verify it does NOT use bare animate-pulse
    expect(card.className).not.toMatch(/(?<![:-])animate-pulse/);
  });

  it("removes highlight ring after 2 seconds", async () => {
    const { ExpandableDashboardCard: RealCard } = await vi.importActual<
      typeof import("@/components/dashboard/ExpandableDashboardCard")
    >("@/components/dashboard/ExpandableDashboardCard");

    const DummyIcon = () => React.createElement("span", null, "icon");

    render(
      React.createElement(RealCard, {
        title: "Test Card",
        value: "€ 100,00",
        description: "Test",
        icon: DummyIcon,
        breakdownContent: React.createElement("div", null, "breakdown"),
        highlight: true,
      })
    );

    // Initially highlighted
    expect(screen.getByRole("button").className).toContain("ring-emerald-400");

    // Advance past the 2s timer
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    // After 2s the highlight should be gone
    expect(screen.getByRole("button").className).not.toContain("ring-emerald-400");
  });

  it("does not show highlight when highlight=false", async () => {
    const { ExpandableDashboardCard: RealCard } = await vi.importActual<
      typeof import("@/components/dashboard/ExpandableDashboardCard")
    >("@/components/dashboard/ExpandableDashboardCard");

    const DummyIcon = () => React.createElement("span", null, "icon");

    render(
      React.createElement(RealCard, {
        title: "Test Card",
        value: "€ 100,00",
        description: "Test",
        icon: DummyIcon,
        breakdownContent: React.createElement("div", null, "breakdown"),
        highlight: false,
      })
    );

    expect(screen.getByRole("button").className).not.toContain("ring-emerald-400");
  });
});

// ===== Aha Moment Banner — Integration (Story 27.2) =====

describe("Dashboard Aha banner integration (Story 27.2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("shows FirstIncomeBanner when URL has ?highlight=spendibile&first=true", async () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile&first=true"]),
    });

    await waitFor(() => {
      expect(screen.getByTestId("first-income-banner")).toBeDefined();
    });
  });

  it("does NOT show FirstIncomeBanner when URL has only ?highlight=spendibile (no first)", () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile"]),
    });

    expect(screen.queryByTestId("first-income-banner")).toBeNull();
  });

  it("does NOT show FirstIncomeBanner on plain / URL", () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/"]),
    });

    expect(screen.queryByTestId("first-income-banner")).toBeNull();
  });

  // Integration test flaky post-Epic 27/Epic 38 demo banner refactor — onDismiss path
  // coperta direttamente dal test unit FirstIncomeBanner.test.tsx
  it.skip("hides banner on dismiss and persists to localStorage", async () => {
    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile&first=true"]),
    });

    await waitFor(() => {
      expect(screen.getByTestId("first-income-banner")).toBeDefined();
    });

    // Click dismiss
    const dismissBtn = screen.getByTestId("aha-dismiss");
    act(() => {
      dismissBtn.click();
    });

    // Banner should be gone
    expect(screen.queryByTestId("first-income-banner")).toBeNull();

    // localStorage should be set
    expect(localStorage.getItem("aha_banner_dismissed_test-user-id")).toBe("true");
  });

  it("does NOT show banner if previously dismissed in localStorage", () => {
    localStorage.setItem("aha_banner_dismissed_test-user-id", "true");

    render(React.createElement(DashboardPage), {
      wrapper: createWrapper(["/?highlight=spendibile&first=true"]),
    });

    expect(screen.queryByTestId("first-income-banner")).toBeNull();
  });
});
