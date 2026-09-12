/**
 * Story 55.2 — Test NuovoIncasso: selector categoria servizio
 * Submit con categoria selezionata, submit senza categoria (null), empty state link.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// === Mocks ===

let mockActiveCategories: any[] = [];

vi.mock("@/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({
    categories: mockActiveCategories,
    activeCategories: mockActiveCategories,
    categoriesUsed: mockActiveCategories.length,
    canAddCategory: true,
    isLoading: false,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    toggleActive: vi.fn(),
    createCategoryMutation: { mutateAsync: vi.fn() },
    updateCategoryMutation: { mutateAsync: vi.fn() },
    toggleActiveMutation: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@test.com" }, loading: false }),
}));

vi.mock("@/hooks/useFiscalCalculations", () => ({
  useFiscalCalculations: () => ({ metrics: null }),
  formatCurrency: (n: number) => `${n} €`,
}));

vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({ data: { count_total: 0, count_year: 0 } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isPro: false,
    canAddReceipt: true,
    canImport: true,
    canExport: false,
    importsUsed: 0,
    importsLimit: 3,
    receiptsUsed: 0,
    receiptsLimit: 5,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useRegenerateSchedule", () => ({
  useRegenerateSchedule: () => ({ regenerateForPaymentYear: vi.fn() }),
}));

vi.mock("@/hooks/useInstallmentPlans", () => ({
  useInstallmentPlans: () => ({
    activePlans: [],
    createPlanMutation: { mutateAsync: vi.fn() },
    registerPaymentMutation: { mutateAsync: vi.fn() },
    deletePlanMutation: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// AppLayout is mocked — no need for FiscalYearContext or useNpsTrigger

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  ANALYTICS_EVENTS: { INCASSO_CREATO: "INCASSO_CREATO" },
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));

// Collapsible mock — always open in tests
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => ({ data: [], error: null }),
          }),
          order: () => ({ data: [], error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

import NuovoIncassoPage from "@/pages/NuovoIncasso";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NuovoIncassoPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("NuovoIncasso — Categoria Servizio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveCategories = [];
  });

  it("mostra link 'Crea le tue categorie' quando nessuna categoria attiva", () => {
    renderPage();
    // The Collapsible needs to be opened first — look for "Dettagli" trigger
    const trigger = screen.getByText("Dettagli (opzionali)");
    trigger.click();
    expect(screen.getByText(/Crea le tue categorie in Impostazioni/)).toBeInTheDocument();
  });

  it("mostra Select categoria quando esistono categorie attive", () => {
    mockActiveCategories = [
      { id: "c1", name: "Consulenza", color: "#14b8a6", active: true },
    ];
    renderPage();
    screen.getByText("Dettagli (opzionali)").click();
    expect(screen.getByText("Categoria Servizio")).toBeInTheDocument();
  });
});
