/**
 * Test per AdminFiscalRules page
 * Story 7.1 — Interfaccia Admin per Aggiornamento Parametri INPS
 *
 * Copertura:
 * - Rendering pagina con header, selettore anno, form
 * - Selettore anno mostra anni disponibili con badge "corrente"
 * - Loading skeleton durante caricamento
 * - Error state quando la query fallisce
 * - Protezione admin verificata tramite route (test integrazione in App)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// ── Mock Supabase ──
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle, maybeSingle: mockSingle }));
const mockOrder = vi.fn(() => Promise.resolve({ data: [{ fiscal_year: 2026 }, { fiscal_year: 2025 }], error: null }));
const mockSelect = vi.fn((cols: string) => {
  if (cols === "fiscal_year") return { order: mockOrder };
  return { eq: mockEq };
});
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: mockFiscalRules2026, error: null })),
    })),
  })),
}));
const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({
    single: vi.fn(() => Promise.resolve({ data: { ...mockFiscalRules2026, fiscal_year: 2027 }, error: null })),
  })),
}));
const mockFrom = vi.fn<any>(() => ({
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
}));

const mockSend = vi.fn().mockResolvedValue("ok");
const mockRealtimeSubscribe = vi.fn().mockReturnThis();
const mockRealtimeOn = vi.fn().mockReturnValue({ subscribe: mockRealtimeSubscribe });
const mockRealtimeChannel = vi.fn<any>(() => ({
  on: mockRealtimeOn,
  subscribe: mockRealtimeSubscribe,
  send: mockSend,
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: {},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    channel: (...args: any[]) => mockRealtimeChannel(...args),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "test-user" } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    functions: { invoke: vi.fn() },
  },
}));

// ── Mock hooks ──
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user", email: "admin@test.com" }, loading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { first_name: "Admin", last_name: "User", user_code: "AA26ADMIN", analytics_consent: false } }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: "admin", isLoading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: true, isLoading: false, tier: "pro" }),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({ selectedYear: 2026, setSelectedYear: vi.fn() }),
  FiscalYearProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock hooks used by AppLayout that depend on full Supabase chain
vi.mock("@/hooks/useDeadlineNotificationCheck", () => ({
  useDeadlineNotificationCheck: vi.fn(),
}));
vi.mock("@/hooks/useDigestNotificationCheck", () => ({
  useDigestNotificationCheck: vi.fn(),
}));
vi.mock("@/hooks/useFiscalRulesSync", () => ({
  useFiscalRulesSync: vi.fn(),
}));
vi.mock("@/hooks/useBlockingModalQueue", () => ({
  useBlockingModalQueue: () => ({ currentPopup: null, dismissCurrent: vi.fn() }),
}));
vi.mock("@/hooks/useDeadlineFeedback", () => ({
  useDeadlineFeedback: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/usePrivacyConsent", () => ({
  usePrivacyConsent: () => ({ needsConsent: false, isLoading: false }),
}));
vi.mock("@/hooks/useFeedbackEmailConsent", () => ({
  useFeedbackEmailConsent: () => ({ needsEmailConsent: false }),
}));
vi.mock("@/lib/session-tracker", () => ({
  trackSession: vi.fn(),
}));

// Mock data con aliquote in formato percentuale (come nel DB: 26.07 per 26.07%)
const mockFiscalRules2026 = {
  id: "test-uuid",
  fiscal_year: 2026,
  inps_rate_separata: 26.07,
  massimale_separata: 122295.0,
  inps_rate_artigiani: 24.0,
  inps_rate_artigiani_alta: 25.0,
  minimale_artigiani: 4521.36,
  massimale_artigiani: 93707.0,
  inps_rate_commercianti: 24.48,
  inps_rate_commercianti_alta: 25.48,
  minimale_commercianti: 4611.64,
  massimale_commercianti: 93707.0,
  reddito_minimale: 18808.0,
  soglia_reddito_prima_fascia: 56224.0,
  maternita_annuale: 7.44,
  aliquota_sostitutiva_5: 5.0,
  aliquota_sostitutiva_15: 15.0,
  soglia_forfettario: 85000.0,
  source_url_separata: "https://www.inps.it/example",
  source_url_artigiani_commercianti: "https://www.confcommercio.it/example",
  created_at: "2026-02-12T00:00:00Z",
  updated_at: "2026-02-12T00:00:00Z",
};

import AdminFiscalRulesPage from "./AdminFiscalRules";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: fiscal_rules years query
  mockOrder.mockResolvedValue({ data: [{ fiscal_year: 2026 }, { fiscal_year: 2025 }], error: null });
  // Default: fiscal_rules single query
  mockSingle.mockResolvedValue({ data: mockFiscalRules2026, error: null });
});

describe("AdminFiscalRules Page", () => {
  it("renderizza header con titolo e descrizione", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Parametri INPS" })).toBeInTheDocument();
    expect(screen.getByText(/Aggiornamento parametri normativi/i)).toBeInTheDocument();
  });

  it("renderizza il selettore anno dopo caricamento", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Anno fiscale:")).toBeInTheDocument();
    });
  });

  it("renderizza il bottone Aggiorna", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Aggiorna")).toBeInTheDocument();
  });

  it("renderizza il bottone Nuovo Anno", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Nuovo Anno")).toBeInTheDocument();
    });
  });

  it("mostra le sezioni del form quando i dati sono caricati", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Gestione Separata")).toBeInTheDocument();
    });

    expect(screen.getByText("Artigiani")).toBeInTheDocument();
    expect(screen.getByText("Commercianti")).toBeInTheDocument();
    expect(screen.getByText("Parametri Condivisi")).toBeInTheDocument();
    expect(screen.getByText("Regime Forfettario")).toBeInTheDocument();
    expect(screen.getByText("Fonti Normative")).toBeInTheDocument();
  });

  it("mostra valori aliquota dal DB direttamente", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Gestione Separata")).toBeInTheDocument();
    });

    // 26.07 nel DB → "26.07" nel form (nessuna conversione)
    const separataInput = screen.getByLabelText("Aliquota INPS");
    expect(separataInput).toHaveValue("26.07");
  });

  it("mostra valori monetari direttamente", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Gestione Separata")).toBeInTheDocument();
    });

    // Ci sono 2 "Minimale annuo" (artigiani e commercianti), prendiamo il primo
    const minimaleInputs = screen.getAllByLabelText("Minimale annuo");
    expect(minimaleInputs[0]).toHaveValue("4521.36");
  });

  it("mostra error state quando la query fallisce", async () => {
    // Override default: ogni chiamata a single() ritorna errore
    mockSingle.mockReset();
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "DB error", details: "", hint: "", code: "500" },
    });

    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText(/Impossibile caricare i parametri/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("non mostra warning source_url se entrambe le URL sono presenti", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Gestione Separata")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Raccomandato.*URL.*circolare/i)).not.toBeInTheDocument();
  });

  it("mostra warning source_url quando entrambe le URL sono vuote", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        ...mockFiscalRules2026,
        source_url_separata: null,
        source_url_artigiani_commercianti: null,
      },
      error: null,
    });

    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Raccomandato.*inserire.*URL/i)).toBeInTheDocument();
    });
  });

  it("mostra il bottone Salva Modifiche", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Salva Modifiche")).toBeInTheDocument();
    });
  });

  it("apre il dialog Nuovo Anno quando si clicca il bottone", async () => {
    render(<AdminFiscalRulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Nuovo Anno")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Nuovo Anno"));

    await waitFor(() => {
      expect(screen.getByText("Aggiungi Anno Fiscale")).toBeInTheDocument();
    });
  });
});
