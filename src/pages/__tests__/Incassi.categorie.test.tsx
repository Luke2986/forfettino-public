/**
 * Story 55.2 — Test Incassi: colonna Servizio, filtro, batch tagging, edit dialog con categoria
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// === Mocks ===

let mockActiveCategories: any[] = [];
let mockAllCategories: any[] = [];

vi.mock("@/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({
    categories: mockAllCategories,
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
  formatCurrency: (n: number) => `€${n.toFixed(2)}`,
}));

vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({ data: { count_total: 5, count_year: 5 } }),
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

vi.mock("@/hooks/useAvailableYears", () => ({
  useAvailableYears: () => ({ availableYears: [2026] }),
}));

vi.mock("@/hooks/usePrefetchAdjacentYears", () => ({
  usePrefetchAdjacentYears: () => {},
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useExportCommercialista", () => ({
  useExportCommercialista: () => ({ handleExport: vi.fn(), isExporting: false, isReady: false }),
}));

// AppLayout is mocked — no need for FiscalYearContext or useNpsTrigger

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));

vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockReceipts = [
  {
    id: "r1",
    receipt_date: "2026-01-15",
    client_name: "Alpha",
    gross_amount: 5000,
    tax_amount: 500,
    inps_amount: 300,
    net_spendable: 4200,
    notes: null,
    fiscal_year: 2026,
    service_category_id: "c1",
  },
  {
    id: "r2",
    receipt_date: "2026-02-10",
    client_name: "Beta",
    gross_amount: 3000,
    tax_amount: 300,
    inps_amount: 180,
    net_spendable: 2520,
    notes: null,
    fiscal_year: 2026,
    service_category_id: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: table === "receipts" ? mockReceipts : [], error: null }),
          }),
          order: () => Promise.resolve({ data: table === "receipts" ? mockReceipts : [], error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }),
        }),
        in: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock("@/components/import/ImportFattureDialog", () => ({
  ImportFattureDialog: () => null,
}));

vi.mock("@/components/subscription/ReceiptLimitBanner", () => ({
  ReceiptLimitBanner: () => null,
}));

vi.mock("@/components/subscription/ProBanner", () => ({
  ProBanner: () => null,
}));

vi.mock("@/components/subscription/ReceiptLimitDialog", () => ({
  ReceiptLimitDialog: () => null,
}));

vi.mock("@/components/subscription/UsageCounter", () => ({
  UsageCounter: () => null,
}));

vi.mock("@/components/receipts/TaxSliceBar", () => ({
  TaxSliceBar: () => <div data-testid="tax-slice-bar" />,
}));

vi.mock("@/components/incassi/InstallmentPlanCard", () => ({
  InstallmentPlanCard: () => null,
}));

vi.mock("@/components/incassi/InstallmentPlanSheet", () => ({
  InstallmentPlanSheet: () => null,
}));

vi.mock("@/components/incassi/RegisterPaymentDialog", () => ({
  RegisterPaymentDialog: () => null,
}));

import IncassiPage from "@/pages/Incassi";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IncassiPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Incassi — Categorie Servizio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllCategories = [
      { id: "c1", name: "Consulenza", color: "#14b8a6", active: true },
      { id: "c2", name: "Formazione", color: "#f59e0b", active: true },
    ];
    mockActiveCategories = [...mockAllCategories];
  });

  it("mostra colonna 'Servizio' nell'header tabella", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Servizio")).toBeInTheDocument();
    });
  });

  it("mostra nome categoria nella cella Servizio per receipt con service_category_id", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Consulenza")).toBeInTheDocument();
    });
  });

  it("mostra '—' per receipt senza categoria", async () => {
    renderPage();
    await waitFor(() => {
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("mostra checkbox per selezione batch", async () => {
    renderPage();
    await waitFor(() => {
      // Header checkbox + 2 row checkboxes
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("mostra filtro categoria quando ci sono categorie attive", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Filtra per categoria servizio")).toBeInTheDocument();
    });
  });

  it("non mostra filtro categoria quando non ci sono categorie", async () => {
    mockActiveCategories = [];
    renderPage();
    await waitFor(() => {
      expect(screen.queryByLabelText("Filtra per categoria servizio")).not.toBeInTheDocument();
    });
  });
});
