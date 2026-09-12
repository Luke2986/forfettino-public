/**
 * Story 58.1 — Test pagina ReportClienti
 * Segmented control periodo, tab Totale Pro-only, cambio tab aggiorna dati.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// === Mock hooks ===

let mockIsPro = false;
let mockSubLoading = false;
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: mockIsPro, isLoading: mockSubLoading }),
}));

let mockUserRole: string | null = "user";
let mockRoleLoading = false;
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: mockUserRole, isLoading: mockRoleLoading }),
}));

let mockSelectedYear = 2026;
vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({ selectedYear: mockSelectedYear }),
}));

let mockReceiptYears: number[] = [2025, 2026];
vi.mock("@/hooks/useReceiptYears", () => ({
  useReceiptYears: () => ({ data: mockReceiptYears, isLoading: false }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Mock report hook — track calls to verify fiscalYear parameter
const defaultReportData = [
  { clientId: "c1", clientName: "Alpha", totalGross: 7000, totalNet: 5600, receiptCount: 3, firstReceiptDate: "2026-01-01", lastReceiptDate: "2026-03-01", percentage: 70 },
  { clientId: "c2", clientName: "Beta", totalGross: 3000, totalNet: 2400, receiptCount: 2, firstReceiptDate: "2026-02-01", lastReceiptDate: "2026-03-01", percentage: 30 },
];
const defaultMetrics = { hhi: 5800, concentration: "concentrato" as const, topClientPct: 70, clientCount: 2, totalGross: 10000 };
let mockReportFiscalYear: number | null = null;
let mockReportReturn: { data: any; metrics: any; isLoading: boolean; error: any } = {
  data: defaultReportData,
  metrics: defaultMetrics,
  isLoading: false,
  error: null,
};
vi.mock("@/hooks/useClientRevenueReport", () => ({
  useClientRevenueReport: (fy: number | null) => {
    mockReportFiscalYear = fy;
    return mockReportReturn;
  },
}));

// Mock Tabs per jsdom (Radix Tabs non triggera onValueChange in jsdom)
vi.mock("@/components/ui/tabs", () => {
  const TabsMock = ({ value, onValueChange, children, ...rest }: { value: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => (
    <div data-testid="tabs" data-value={value} {...rest}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { _onValueChange: onValueChange, _value: value }) : child
      )}
    </div>
  );
  const TabsListMock = ({ children, _onValueChange, _value, ...props }: any) => (
    <div role="tablist" {...props}>
      {React.Children.map(children, (child) =>
        child && React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { _onValueChange, _value }) : child
      )}
    </div>
  );
  const TabsTriggerMock = ({ value, children, _onValueChange, _value, ...props }: any) => (
    <button
      role="tab"
      data-state={_value === value ? "active" : "inactive"}
      onClick={() => _onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
  const TabsContentMock = ({ value, children, _value, ...props }: any) => (
    <div data-testid={`tab-content-${value}`} hidden={_value !== value} {...props}>
      {children}
    </div>
  );
  return { Tabs: TabsMock, TabsList: TabsListMock, TabsTrigger: TabsTriggerMock, TabsContent: TabsContentMock };
});

// Mock layout components to simplify rendering
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));
vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

// Mock sub-components (story 58.2: ClientRankedBars sostituisce donut+tabella)
vi.mock("@/components/report-clienti/ConcentrationAlert", () => ({
  ConcentrationAlert: () => <div data-testid="concentration-alert" />,
}));
let lastRankedBarsProps: any = {};
vi.mock("@/components/report-clienti/ClientRankedBars", () => ({
  ClientRankedBars: (props: any) => {
    lastRankedBarsProps = props;
    return <div data-testid="ranked-bars" />;
  },
}));
vi.mock("@/components/report-clienti/MissingClientsNudge", () => ({
  MissingClientsNudge: () => null,
}));

// Mock useAuth (needed by some hooks)
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

// Mock ProWaitlist (Story 64.3)
let mockIsJoined = false;
vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => ({ isJoined: mockIsJoined, join: vi.fn(), isLoading: false }),
}));

// Mock ProGateOverlay — pass-through (tests run as Pro by default; gate tested in GatedPages.test.tsx)
vi.mock("@/components/subscription/ProGateOverlay", () => ({
  ProGateOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock ProWaitlistConsentDialog (Story 64.3)
vi.mock("@/components/subscription/ProWaitlistConsentDialog", () => ({
  ProWaitlistConsentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pro-waitlist-dialog">ProWaitlistDialog</div> : null,
}));

// Mock sonner toast (Story 64.3)
const mockToastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: { info: (...args: any[]) => mockToastInfo(...args) },
}));

// Mock export functions (Story 54.4 + 55.3)
const mockExportClientReport = vi.fn();
vi.mock("@/lib/client-report-export", () => ({
  exportClientReport: (...args: any[]) => mockExportClientReport(...args),
}));
const mockExportServiceReport = vi.fn();
vi.mock("@/lib/service-report-export", () => ({
  exportServiceReport: (...args: any[]) => mockExportServiceReport(...args),
}));

// Mock service report hook (Story 55.3)
vi.mock("@/hooks/useServiceRevenueReport", () => ({
  useServiceRevenueReport: () => ({ data: [], metrics: undefined, isLoading: false, error: null }),
}));

// Mock service categories hook (Story 55.3)
vi.mock("@/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({ categories: [], activeCategories: [], categoriesUsed: 0, canAddCategory: true, isLoading: false }),
}));

// Mock service report sub-components (Story 55.3)
vi.mock("@/components/report-servizi/ServiceRankedBars", () => ({
  ServiceRankedBars: () => <div data-testid="service-ranked-bars" />,
}));
vi.mock("@/components/report-servizi/MissingServicesNudge", () => ({
  MissingServicesNudge: () => null,
}));

// Mock cross analysis hook (Story 55.4)
let mockCrossReturn: { data: any; isLoading: boolean; error: any } = {
  data: { entries: [], clients: [], categories: [], matrix: new Map(), totals: { byClient: new Map(), byCategory: new Map(), grand: 0 } },
  isLoading: false,
  error: null,
};
vi.mock("@/hooks/useCrossAnalysis", () => ({
  useCrossAnalysis: () => mockCrossReturn,
}));

// Mock cross analysis components (Story 55.4)
vi.mock("@/components/report-incrociata/CrossAnalysisHeatmap", () => ({
  CrossAnalysisHeatmap: () => <div data-testid="cross-heatmap" />,
}));
vi.mock("@/components/report-incrociata/CrossStackedBarChart", () => ({
  CrossStackedBarChart: () => <div data-testid="cross-chart" />,
}));
vi.mock("@/components/report-incrociata/CrossInsights", () => ({
  CrossInsights: () => <div data-testid="cross-insights" />,
}));

// Mock cross analysis export (Story 55.4)
const mockExportCrossAnalysis = vi.fn();
vi.mock("@/lib/cross-analysis-export", () => ({
  exportCrossAnalysis: (...args: any[]) => mockExportCrossAnalysis(...args),
}));

// Mock supabase client (Story 85-1): serve per le query dirette
// rivalsa_total / bollo_total nella hero card. Chain thenable che
// discrimina sulla colonna richiesta in select().
vi.mock("@/integrations/supabase/client", () => {
  const chain = (data: unknown[]) => {
    const obj: any = {
      eq: () => obj,
      then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return obj;
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: (cols: string) => {
          if (table === "receipts" && cols.includes("marca_bollo_amount")) {
            // 2 incassi con bollo → totale 4 €
            return chain([{ marca_bollo_amount: 2 }, { marca_bollo_amount: 2 }]);
          }
          if (table === "receipts" && cols.includes("rivalsa_inps_amount")) {
            return chain([{ rivalsa_inps_amount: 40 }]);
          }
          return chain([]);
        },
      }),
    },
  };
});

import ReportClienti from "../ReportClienti";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/report"]}>
        <ReportClienti />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReportClienti — Segmented Control (Story 58.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
  });

  it("renderizza tab per ogni anno disponibile", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "2025" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "2026" })).toBeTruthy();
  });

  it("renderizza con 3 anni disponibili", () => {
    mockReceiptYears = [2024, 2025, 2026];
    renderPage();
    expect(screen.getByRole("tab", { name: "2024" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "2025" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "2026" })).toBeTruthy();
  });

  it("renderizza con 1 anno disponibile", () => {
    mockReceiptYears = [2026];
    renderPage();
    expect(screen.getByRole("tab", { name: "2026" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "2025" })).toBeNull();
  });

  it("filtra anni futuri dal segmented control", () => {
    mockReceiptYears = [2025, 2026, 2027];
    renderPage();
    expect(screen.getByRole("tab", { name: "2025" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "2026" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "2027" })).toBeNull();
  });

  it("tab 'Totale' NON visibile per utenti Free", () => {
    mockIsPro = false;
    renderPage();
    expect(screen.queryByRole("tab", { name: "Totale" })).toBeNull();
  });

  it("tab 'Totale' visibile per utenti Pro", () => {
    mockIsPro = true;
    renderPage();
    expect(screen.getByRole("tab", { name: "Totale" })).toBeTruthy();
  });

  it("tab 'Totale' visibile per admin", () => {
    mockUserRole = "admin";
    renderPage();
    expect(screen.getByRole("tab", { name: "Totale" })).toBeTruthy();
  });

  it("default selezionato = anno corrente dal FiscalYearContext", () => {
    mockSelectedYear = 2026;
    renderPage();
    const tab2026 = screen.getByRole("tab", { name: "2026" });
    expect(tab2026.getAttribute("data-state")).toBe("active");
  });

  it("hook riceve anno corrente come default", () => {
    mockSelectedYear = 2026;
    renderPage();
    expect(mockReportFiscalYear).toBe(2026);
  });

  it("cambio tab a un anno diverso aggiorna il hook", async () => {
    renderPage();
    const tab2025 = screen.getByRole("tab", { name: "2025" });
    fireEvent.click(tab2025);
    await waitFor(() => {
      expect(tab2025.getAttribute("data-state")).toBe("active");
      expect(mockReportFiscalYear).toBe(2025);
    });
  });

  it("cambio tab a 'Totale' passa null al hook", async () => {
    mockIsPro = true;
    renderPage();
    const tabTotale = screen.getByRole("tab", { name: "Totale" });
    fireEvent.click(tabTotale);
    await waitFor(() => {
      expect(tabTotale.getAttribute("data-state")).toBe("active");
      expect(mockReportFiscalYear).toBeNull();
    });
  });

  it("non usa PageYearSelector (rimosso)", () => {
    renderPage();
    // PageYearSelector rendererebbe un select/dropdown, verifico che non esista
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("mostra titolo pagina 'Report Fatturato'", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Report Fatturato");
  });

  it("mostra spinner durante il caricamento", () => {
    mockReportReturn = { data: undefined, metrics: undefined, isLoading: true, error: null };
    renderPage();
    expect(screen.getByText((_, el) => el?.classList.contains("animate-spin") ?? false)).toBeTruthy();
    // Nessun contenuto principale visibile
    expect(screen.queryByTestId("concentration-alert")).toBeNull();
  });

  it("mostra messaggio errore quando la query fallisce", () => {
    mockReportReturn = { data: undefined, metrics: undefined, isLoading: false, error: new Error("DB error") };
    renderPage();
    expect(screen.getByText(/errore nel caricamento/i)).toBeTruthy();
  });

  it("mostra empty state per anno specifico", () => {
    mockReportReturn = { data: [], metrics: undefined, isLoading: false, error: null };
    mockSelectedYear = 2026;
    renderPage();
    expect(screen.getByText(/nessun incasso registrato nel 2026/i)).toBeTruthy();
    expect(screen.getByText(/registra il tuo primo incasso/i)).toBeTruthy();
  });

  it("mostra empty state generico in modalità Totale", async () => {
    mockIsPro = true;
    mockReportReturn = { data: [], metrics: undefined, isLoading: false, error: null };
    renderPage();
    // Seleziona Totale
    fireEvent.click(screen.getByRole("tab", { name: "Totale" }));
    await waitFor(() => {
      expect(screen.getByText(/nessun incasso registrato$/i)).toBeTruthy();
    });
  });
});

describe("ReportClienti — Hero Stats (Story 58.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
  });

  it("mostra fatturato totale formattato quando ci sono dati", () => {
    renderPage();
    // totalGross = 10000 → formatCurrency produce "10.000,00 €"
    expect(screen.getByText(/10\.000/)).toBeTruthy();
  });

  it("mostra conteggio clienti plurale", () => {
    renderPage();
    expect(screen.getByText("2 clienti")).toBeTruthy();
  });

  it("mostra conteggio clienti singolare", () => {
    mockReportReturn = {
      data: [defaultReportData[0]],
      metrics: { ...defaultMetrics, clientCount: 1, totalGross: 7000 },
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("1 cliente")).toBeTruthy();
  });

  it("NON mostra hero stats durante loading", () => {
    mockReportReturn = { data: undefined, metrics: undefined, isLoading: true, error: null };
    renderPage();
    expect(screen.queryByText(/clienti?$/)).toBeNull();
  });

  it("NON mostra hero stats quando non ci sono dati", () => {
    mockReportReturn = { data: [], metrics: undefined, isLoading: false, error: null };
    renderPage();
    expect(screen.queryByText(/clienti?$/)).toBeNull();
  });
});

describe("ReportClienti — Righe rivalsa e marca da bollo (Story 85-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
  });

  it("mostra 'di cui marca da bollo' con il totale (2 incassi × 2 € = 4 €)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/di cui marca da bollo/)).toBeTruthy();
    });
    // Totale 4 € (jsdom Intl parziale: regex sulle cifre)
    expect(screen.getByText(/4[,.]00/)).toBeTruthy();
  });

  it("mostra 'di cui rivalsa INPS 4%' con il totale (40 €)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/di cui rivalsa INPS 4%/)).toBeTruthy();
    });
    expect(screen.getByText(/40[,.]00/)).toBeTruthy();
  });
});

describe("ReportClienti — Hero Card & Section Header (Story 59.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
  });

  it("mostra label 'Fatturato lordo' quando ci sono dati", () => {
    renderPage();
    expect(screen.getByText("Fatturato lordo")).toBeTruthy();
  });

  it("NON mostra label 'Fatturato lordo' durante loading", () => {
    mockReportReturn = { data: undefined, metrics: undefined, isLoading: true, error: null };
    renderPage();
    expect(screen.queryByText("Fatturato lordo")).toBeNull();
  });

  it("mostra section header 'Ranking clienti' quando ci sono dati", () => {
    renderPage();
    expect(screen.getByText("Ranking clienti")).toBeTruthy();
  });

  it("sottotitolo 'Clicca su un cliente' presente per Pro con anno selezionato", () => {
    mockIsPro = true;
    mockSelectedYear = 2026;
    renderPage();
    expect(screen.getByText("Clicca su un cliente per il trend mensile")).toBeTruthy();
  });

  it("sottotitolo 'Clicca su un cliente' presente per admin con anno selezionato", () => {
    mockUserRole = "admin";
    mockSelectedYear = 2026;
    renderPage();
    expect(screen.getByText("Clicca su un cliente per il trend mensile")).toBeTruthy();
  });

  it("sottotitolo 'Clicca su un cliente' assente per utenti Free", () => {
    mockIsPro = false;
    mockUserRole = "user";
    renderPage();
    expect(screen.queryByText("Clicca su un cliente per il trend mensile")).toBeNull();
  });

  it("sottotitolo 'Clicca su un cliente' assente per Pro in modalità Totale", async () => {
    mockIsPro = true;
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Totale" }));
    await waitFor(() => {
      expect(screen.queryByText("Clicca su un cliente per il trend mensile")).toBeNull();
    });
  });

  it("sottotitolo 'Clicca su un cliente' assente per admin in modalità Totale", async () => {
    mockUserRole = "admin";
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Totale" }));
    await waitFor(() => {
      expect(screen.queryByText("Clicca su un cliente per il trend mensile")).toBeNull();
    });
  });
});

describe("ReportClienti — selectedPeriod prop (Story 58.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = true;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
    lastRankedBarsProps = {};
  });

  it("passa selectedPeriod al componente ClientRankedBars", () => {
    renderPage();
    expect(lastRankedBarsProps.selectedPeriod).toBe(2026);
  });

  it("passa selectedPeriod=null quando Totale è selezionato", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Totale" }));
    await waitFor(() => {
      expect(lastRankedBarsProps.selectedPeriod).toBeNull();
    });
  });

  it("aggiorna selectedPeriod al cambio anno", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "2025" }));
    await waitFor(() => {
      expect(lastRankedBarsProps.selectedPeriod).toBe(2025);
    });
  });
});

describe("ReportClienti — Export CSV (Story 54.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
  });

  it("bottone 'Esporta CSV' è presente quando ci sono dati", () => {
    mockIsPro = true;
    renderPage();
    expect(screen.getByRole("button", { name: /esporta csv/i })).toBeTruthy();
  });

  it("bottone abilitato per utente Pro con dati", () => {
    mockIsPro = true;
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    expect(btn).not.toBeDisabled();
  });

  it("bottone abilitato per admin con dati", () => {
    mockUserRole = "admin";
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    expect(btn).not.toBeDisabled();
  });

  it("bottone Free ha styling disabled e aria-disabled (non HTML disabled)", () => {
    mockIsPro = false;
    mockUserRole = "user";
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    // Non è HTML disabled (per intercettare il click), ma ha aria-disabled
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("bottone Free ha title 'Disponibile con Pro'", () => {
    mockIsPro = false;
    mockUserRole = "user";
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    expect(btn.getAttribute("title")).toBe("Disponibile con Pro");
  });

  it("bottone disabilitato se non ci sono dati", () => {
    mockIsPro = true;
    mockReportReturn = { data: [], metrics: undefined, isLoading: false, error: null };
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    expect(btn).toBeDisabled();
  });

  it("click chiama exportClientReport con dati e periodo", () => {
    mockIsPro = true;
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(btn);
    expect(mockExportClientReport).toHaveBeenCalledWith(defaultReportData, 2026);
  });

  it("click con periodo Totale passa null", async () => {
    mockIsPro = true;
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Totale" }));
    await waitFor(() => {
      expect(mockReportFiscalYear).toBeNull();
    });
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(btn);
    expect(mockExportClientReport).toHaveBeenCalledWith(defaultReportData, null);
  });
});

describe("ReportClienti — T3 Export CSV Gate (Story 64.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
  });

  it("utente Free click apre ProWaitlistConsentDialog", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(btn);
    expect(screen.getByTestId("pro-waitlist-dialog")).toBeTruthy();
    expect(mockExportClientReport).not.toHaveBeenCalled();
  });

  it("utente Free isJoined click mostra toast info", () => {
    mockIsJoined = true;
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(btn);
    expect(mockToastInfo).toHaveBeenCalledWith(expect.stringMatching(/già in lista/i));
    expect(screen.queryByTestId("pro-waitlist-dialog")).toBeNull();
  });

  it("utente Pro click esegue export normalmente", () => {
    mockIsPro = true;
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(btn);
    expect(mockExportClientReport).toHaveBeenCalledWith(defaultReportData, 2026);
    expect(screen.queryByTestId("pro-waitlist-dialog")).toBeNull();
  });

  it("admin click esegue export normalmente", () => {
    mockUserRole = "admin";
    renderPage();
    const btn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(btn);
    expect(mockExportClientReport).toHaveBeenCalledWith(defaultReportData, 2026);
  });
});

describe("ReportClienti — Tab Analisi Incrociata (Story 55.4)", () => {
  const crossDataWithEntries = {
    entries: [{ clientId: "c1", clientName: "Acme", categoryId: "s1", categoryName: "Consulenza", categoryColor: "#14b8a6", totalGross: 5000, receiptCount: 3 }],
    clients: [{ id: "c1", name: "Acme", totalGross: 5000 }],
    categories: [{ id: "s1", name: "Consulenza", color: "#14b8a6", totalGross: 5000 }],
    matrix: new Map([["c1", new Map([["s1", { totalGross: 5000, receiptCount: 3 }]])]]),
    totals: { byClient: new Map([["c1", 5000]]), byCategory: new Map([["s1", 5000]]), grand: 5000 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = true;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockSelectedYear = 2026;
    mockReceiptYears = [2025, 2026];
    mockReportFiscalYear = null;
    mockIsJoined = false;
    mockReportReturn = { data: defaultReportData, metrics: defaultMetrics, isLoading: false, error: null };
    mockCrossReturn = { data: crossDataWithEntries, isLoading: false, error: null };
  });

  it("renderizza tab 'Analisi Incrociata'", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /analisi incrociata/i })).toBeTruthy();
  });

  it("utente Free vede icona lucchetto sul tab", () => {
    mockIsPro = false;
    const { container } = renderPage();
    const tab = screen.getByRole("tab", { name: /analisi incrociata/i });
    // Lock icon should be a child
    const lockIcon = tab.querySelector("svg");
    expect(lockIcon).toBeTruthy();
  });

  it("utente Pro NON vede icona lucchetto", () => {
    mockIsPro = true;
    renderPage();
    const tab = screen.getByRole("tab", { name: /analisi incrociata/i });
    const lockIcon = tab.querySelector("svg");
    expect(lockIcon).toBeNull();
  });

  it("utente Free click mostra toast e dialog Pro", () => {
    mockIsPro = false;
    renderPage();
    const tab = screen.getByRole("tab", { name: /analisi incrociata/i });
    fireEvent.click(tab);
    expect(mockToastInfo).toHaveBeenCalledWith(expect.stringMatching(/analisi incrociata/i));
    // La dialog Pro dovrebbe apparire
    expect(screen.getAllByTestId("pro-waitlist-dialog").length).toBeGreaterThanOrEqual(1);
  });

  it("utente Pro switch al tab mostra contenuto cross analysis", () => {
    renderPage();
    const tab = screen.getByRole("tab", { name: /analisi incrociata/i });
    fireEvent.click(tab);
    // Heatmap dovrebbe essere visibile (default view = table)
    expect(screen.getByTestId("cross-heatmap")).toBeTruthy();
  });

  it("toggle Grafico mostra chart al posto della heatmap", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /analisi incrociata/i }));
    // Click "Grafico" button
    fireEvent.click(screen.getByRole("button", { name: /grafico/i }));
    expect(screen.getByTestId("cross-chart")).toBeTruthy();
    expect(screen.queryByTestId("cross-heatmap")).toBeNull();
  });

  it("mostra empty state quando non ci sono dati cross", () => {
    mockCrossReturn = {
      data: { entries: [], clients: [], categories: [], matrix: new Map(), totals: { byClient: new Map(), byCategory: new Map(), grand: 0 } },
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /analisi incrociata/i }));
    // Should not show heatmap
    expect(screen.queryByTestId("cross-heatmap")).toBeNull();
  });
});
