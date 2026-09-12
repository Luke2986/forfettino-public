/**
 * Story 55.6 — Test Incassi: pulizia UI zero categorie + banner educativo
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  useIncomeStats: () => ({ data: { count_total: 10, count_year: 10 } }),
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

// Generate receipts
function makeReceipts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    receipt_date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    client_name: `Client${i}`,
    gross_amount: 1000 * (i + 1),
    tax_amount: 100,
    inps_amount: 50,
    net_spendable: 850,
    notes: null,
    fiscal_year: 2026,
    service_category_id: null,
  }));
}

let mockReceipts: any[] = [];

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
        in: () => ({ eq: () => Promise.resolve({ error: null }) }),
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

describe("Incassi — Pulizia UI zero categorie (Story 55.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockReceipts = makeReceipts(6);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("nasconde colonna Servizio quando 0 categorie attive (checkbox sempre visibili, 85-2)", async () => {
    mockActiveCategories = [];
    mockAllCategories = [];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Client0")).toBeInTheDocument();
    });
    // No "Servizio" column header
    expect(screen.queryByText("Servizio")).not.toBeInTheDocument();
    // Checkbox selezione sempre presenti: dal batch bollo (Story 85-2, AC 1)
    // la selezione non dipende più dalle categorie
    expect(screen.getByLabelText("Seleziona tutti gli incassi")).toBeInTheDocument();
  });

  it("mostra colonna Servizio e checkbox quando >= 1 categoria attiva", async () => {
    mockAllCategories = [{ id: "c1", name: "Consulenza", color: "#14b8a6", active: true }];
    mockActiveCategories = [...mockAllCategories];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Servizio")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Seleziona tutti gli incassi")).toBeInTheDocument();
  });

  it("nasconde filtro categoria quando 0 categorie attive", async () => {
    mockActiveCategories = [];
    mockAllCategories = [];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Client0")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Filtra per categoria servizio")).not.toBeInTheDocument();
  });

  it("mostra filtro categoria quando >= 1 categoria attiva", async () => {
    mockAllCategories = [{ id: "c1", name: "Consulenza", color: "#14b8a6", active: true }];
    mockActiveCategories = [...mockAllCategories];
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Filtra per categoria servizio")).toBeInTheDocument();
    });
  });
});

describe("Incassi — Banner educativo (Story 55.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("mostra banner educativo con >= 5 incassi e 0 categorie", async () => {
    mockActiveCategories = [];
    mockAllCategories = [];
    mockReceipts = makeReceipts(6);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Organizza i tuoi incassi per tipo di servizio")).toBeInTheDocument();
    });
    expect(screen.getByText("Crea categorie")).toBeInTheDocument();
  });

  it("non mostra banner educativo con < 5 incassi", async () => {
    mockActiveCategories = [];
    mockAllCategories = [];
    mockReceipts = makeReceipts(3);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Client0")).toBeInTheDocument();
    });
    expect(screen.queryByText("Organizza i tuoi incassi per tipo di servizio")).not.toBeInTheDocument();
  });

  it("non mostra banner educativo con categorie attive", async () => {
    mockAllCategories = [{ id: "c1", name: "Consulenza", color: "#14b8a6", active: true }];
    mockActiveCategories = [...mockAllCategories];
    mockReceipts = makeReceipts(6);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Client0")).toBeInTheDocument();
    });
    expect(screen.queryByText("Organizza i tuoi incassi per tipo di servizio")).not.toBeInTheDocument();
  });

  it("dismiss banner educativo persiste in localStorage", async () => {
    mockActiveCategories = [];
    mockAllCategories = [];
    mockReceipts = makeReceipts(6);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Organizza i tuoi incassi per tipo di servizio")).toBeInTheDocument();
    });
    // Click dismiss
    fireEvent.click(screen.getByLabelText("Chiudi banner"));
    expect(screen.queryByText("Organizza i tuoi incassi per tipo di servizio")).not.toBeInTheDocument();
    expect(localStorage.getItem("categories_edu_dismissed_u1")).toBe("true");
  });
});
