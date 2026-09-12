/**
 * Story 55.2 — Test tab "Categorie Servizio" in Impostazioni
 * Render lista, create, edit inline, toggle active, suggerimenti ATECO, limite Free.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

// === Mocks ===

const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockToggleActive = vi.fn();
const mockToast = vi.fn();

let mockCategories: any[] = [];
let mockActiveCategories: any[] = [];
let mockCanAdd = true;
let mockCategoriesUsed = 0;

vi.mock("@/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({
    categories: mockCategories,
    activeCategories: mockActiveCategories,
    categoriesUsed: mockCategoriesUsed,
    canAddCategory: mockCanAdd,
    isLoading: false,
    createCategory: mockCreateCategory,
    updateCategory: mockUpdateCategory,
    toggleActive: mockToggleActive,
    createCategoryMutation: { mutateAsync: mockCreateCategory },
    updateCategoryMutation: { mutateAsync: mockUpdateCategory },
    toggleActiveMutation: { mutateAsync: mockToggleActive },
  }),
}));

vi.mock("@/lib/category-suggestions", () => ({
  getSuggestions: (cat: string | null) =>
    cat === "artigiani"
      ? ["Produzione", "Riparazione", "Installazione", "Assistenza e supporto", "Gestione progetto", "Copywriting e contenuti", "Social media", "Sviluppo software", "Grafica e design", "Traduzioni"]
      : ["Consulenza", "Formazione", "Progettazione", "Assistenza e supporto", "Gestione progetto", "Copywriting e contenuti", "Social media", "Sviluppo software", "Grafica e design", "Traduzioni"],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@test.com" }, loading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast, dismiss: vi.fn(), toasts: [] }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isPro: false,
    tier: "free",
    subscription: null,
    receiptsUsed: 0,
    receiptsLimit: 5,
    importsUsed: 0,
    importsLimit: 3,
    canAddReceipt: true,
    canImport: true,
    canExport: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCheckout", () => ({
  useCheckout: () => ({ checkout: vi.fn(), openPortal: vi.fn(), isLoading: false }),
}));

vi.mock("@/hooks/useFiscalRules", () => ({
  useFiscalRules: () => ({ rules: null, isLoading: false }),
}));

vi.mock("@/hooks/useMfa", () => ({
  useMfa: () => ({ isMfaEnabled: false, isLoading: false, enableMfa: vi.fn(), disableMfa: vi.fn(), checkMfaStatus: () => Promise.resolve({ isPasswordLogin: false, hasEnrolledFactor: false }) }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { first_name: "Test", last_name: "User" } }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/components/settings/NotificationPreferencesExpanded", () => ({
  NotificationPreferencesExpanded: () => <div data-testid="notif-prefs" />,
}));

vi.mock("@/components/settings/PrivacyDataSection", () => ({
  PrivacyDataSection: () => <div data-testid="privacy-section" />,
}));

vi.mock("@/components/shared/PricingCards", () => ({
  PricingCards: () => <div data-testid="pricing-cards" />,
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: null, error: null }), maybeSingle: () => ({ data: null, error: null }) }), order: () => ({ limit: () => ({ single: () => ({ data: null, error: null }) }) }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  },
}));

// Minimal tab mock for jsdom using React context to propagate value through nested divs
const TabsContext = React.createContext<{ value: string; onChange: (v: string) => void }>({ value: "", onChange: () => {} });
vi.mock("@/components/ui/tabs", () => {
  const TabsMock = ({ value, onValueChange, children }: any) => (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div data-testid="tabs">{children}</div>
    </TabsContext.Provider>
  );
  const TabsListMock = ({ children, ...rest }: any) => <div role="tablist" {...rest}>{children}</div>;
  const TabsTriggerMock = ({ value, children, ...rest }: any) => {
    const ctx = React.useContext(TabsContext);
    return (
      <button role="tab" data-state={ctx.value === value ? "active" : "inactive"} onClick={() => ctx.onChange(value)} {...rest}>
        {children}
      </button>
    );
  };
  const TabsContentMock = ({ value, children, ...rest }: any) => {
    const ctx = React.useContext(TabsContext);
    return ctx.value === value ? <div role="tabpanel" {...rest}>{children}</div> : null;
  };
  return { Tabs: TabsMock, TabsList: TabsListMock, TabsTrigger: TabsTriggerMock, TabsContent: TabsContentMock };
});

// Mock remaining heavy deps
vi.mock("@/pages/Wizard", () => ({
  isEligibleRiduzione50: () => false,
  computeRiduzione50Scadenza: () => null,
  mapGestioneToInpsType: () => "artigiani",
  isValidEnrollmentYear: () => true,
}));

vi.mock("@/lib/fiscal-utils", () => ({
  deriveAliquotaSostitutiva: () => null,
}));

vi.mock("@/components/shared/AtecoCombobox", () => ({
  AtecoCombobox: (props: any) => <select data-testid="ateco-combobox" />,
}));

vi.mock("@/components/shared/CommercialistaFallbackAlert", () => ({
  CommercialistaFallbackAlert: () => null,
}));

vi.mock("@/lib/password-validation", () => ({
  strongPasswordSchema: { safeParse: () => ({ success: true }) },
}));

vi.mock("@/components/auth/PasswordStrengthIndicator", () => ({
  PasswordStrengthIndicator: () => null,
}));

import ImpostazioniPage from "@/pages/Impostazioni";

function renderPage(initialTab = "categorie") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/impostazioni?tab=${initialTab}`]}>
          <ImpostazioniPage />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe("Impostazioni — Tab Categorie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategories = [];
    mockActiveCategories = [];
    mockCanAdd = true;
    mockCategoriesUsed = 0;
  });

  async function navigateToCategorie() {
    const tab = await screen.findByRole("tab", { name: /^Categorie$/i });
    fireEvent.click(tab);
  }

  it("mostra tab trigger 'Categorie'", async () => {
    renderPage("fiscale");
    expect(await screen.findByRole("tab", { name: /^Categorie$/i })).toBeInTheDocument();
  });

  it("mostra suggerimenti ATECO quando nessuna categoria attiva", async () => {
    renderPage("fiscale");
    await navigateToCategorie();
    expect(screen.getByText(/Aggiungi con un tap/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Consulenza/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Formazione/)).toBeInTheDocument();
  });

  it("crea categoria cliccando su suggerimento", async () => {
    mockCreateCategory.mockResolvedValueOnce({ id: "c1", name: "Consulenza" });
    renderPage("fiscale");
    await navigateToCategorie();
    fireEvent.click(screen.getByText(/\+ Consulenza/));
    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({ name: "Consulenza" });
    });
  });

  it("mostra lista categorie con nome e switch", async () => {
    mockCategories = [
      { id: "c1", name: "Consulenza", color: "#14b8a6", active: true, sort_order: 0 },
      { id: "c2", name: "Formazione", color: "#f59e0b", active: false, sort_order: 1 },
    ];
    mockActiveCategories = [mockCategories[0]];
    mockCategoriesUsed = 1;
    renderPage("fiscale");
    await navigateToCategorie();
    expect(screen.getByText("Consulenza")).toBeInTheDocument();
    expect(screen.getByText("Formazione")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(2);
  });

  it("toggle active chiama toggleActive", async () => {
    mockCategories = [{ id: "c1", name: "Consulenza", color: "#14b8a6", active: true, sort_order: 0 }];
    mockActiveCategories = [mockCategories[0]];
    mockCategoriesUsed = 1;
    mockToggleActive.mockResolvedValueOnce({});
    renderPage("fiscale");
    await navigateToCategorie();
    const sw = screen.getByRole("switch", { name: /Disattiva categoria Consulenza/i });
    fireEvent.click(sw);
    await waitFor(() => {
      expect(mockToggleActive).toHaveBeenCalledWith("c1");
    });
  });

  it("mostra contatore Free X/3", async () => {
    mockCategoriesUsed = 2;
    renderPage("fiscale");
    await navigateToCategorie();
    expect(screen.getByText("2/3 categorie usate")).toBeInTheDocument();
  });

  it("disabilita bottone + Nuova quando !canAddCategory", async () => {
    mockCanAdd = false;
    mockCategoriesUsed = 3;
    renderPage("fiscale");
    await navigateToCategorie();
    const btn = screen.getByRole("button", { name: /Nuova categoria/i });
    expect(btn).toBeDisabled();
  });

  it("crea nuova categoria con input + bottone", async () => {
    mockCreateCategory.mockResolvedValueOnce({ id: "c1", name: "Test" });
    renderPage("fiscale");
    await navigateToCategorie();
    const input = screen.getByPlaceholderText("Nuova categoria...");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /Nuova categoria/i }));
    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({ name: "Test" });
    });
  });

  // Story 55.6 — AC #4: Empty state arricchito
  it("mostra spiegazione valore sopra suggerimenti ATECO quando 0 categorie (AC #4)", async () => {
    mockCategories = [];
    mockActiveCategories = [];
    mockCategoriesUsed = 0;
    renderPage("fiscale");
    await navigateToCategorie();
    expect(screen.getByTestId("categories-empty-state")).toBeInTheDocument();
    expect(screen.getByText("Categorizza per capire da dove arrivano i tuoi guadagni")).toBeInTheDocument();
    expect(screen.getByText(/Crea categorie come .Consulenza./)).toBeInTheDocument();
    // ATECO suggestions still present below
    expect(screen.getByText(/Aggiungi con un tap/)).toBeInTheDocument();
  });

  // Story 55.6 — AC #5: Toast primo successo (transizione 0→1)
  it("mostra toast speciale alla creazione della prima categoria (AC #5)", async () => {
    mockCategories = [];
    mockActiveCategories = [];
    mockCategoriesUsed = 0;
    mockCreateCategory.mockResolvedValueOnce({ id: "c1", name: "Consulenza" });
    renderPage("fiscale");
    await navigateToCategorie();
    fireEvent.click(screen.getByText(/\+ Consulenza/));
    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({ name: "Consulenza" });
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Categoria creata! Ora puoi selezionare il servizio quando registri un incasso." })
      );
    });
  });
});
