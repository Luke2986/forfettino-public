import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminFeedbackStats } from "./AdminFeedbackStats";

// ── Mocks ──

const mockSelect = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ── Helper data ──

const SAMPLE_ROWS = [
  { response: "yes", reason: null, created_at: "2026-03-01T10:00:00Z" },
  { response: "yes", reason: null, created_at: "2026-03-02T10:00:00Z" },
  { response: "no", reason: "no_money", created_at: "2026-03-03T10:00:00Z" },
  { response: "no", reason: "forgot", created_at: "2026-03-04T10:00:00Z" },
  { response: "dismissed", reason: null, created_at: "2026-03-05T10:00:00Z" },
];

/** Mock builder that is both chainable (.gte) and thenable (await directly when days=null). */
function mockWithGte() {
  const result = { data: SAMPLE_ROWS, error: null };
  mockSelect.mockReturnValue({
    gte: vi.fn().mockResolvedValue(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });
}

function mockWithGteEmpty() {
  const result = { data: [], error: null };
  mockSelect.mockReturnValue({
    gte: vi.fn().mockResolvedValue(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });
}

function mockWithGteError() {
  const result = { data: null, error: { message: "DB down" } };
  mockSelect.mockReturnValue({
    gte: vi.fn().mockResolvedValue(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });
}

describe("AdminFeedbackStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra le progress bar con la distribuzione corretta", async () => {
    mockWithGte();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(await screen.findByText("5 risposte totali")).toBeInTheDocument();

    // Verifica le label di distribuzione
    expect(screen.getByText(/Sì, tutto ok/)).toBeInTheDocument();
    expect(screen.getByText(/No, difficoltà/)).toBeInTheDocument();
    expect(screen.getByText(/Chiuso senza risposta/)).toBeInTheDocument();

    // Verifica che ci siano progress bar (2 yes + 2 no + 1 dismissed = 5)
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThanOrEqual(3);

    // Verifica 1 (20%) per dismissed
    expect(screen.getByText("1 (20%)")).toBeInTheDocument();

    // Verifica che ci siano due "2 (40%)" — yes e no hanno la stessa distribuzione
    const fortyPctElements = screen.getAllByText("2 (40%)");
    expect(fortyPctElements).toHaveLength(2);
  });

  it("mostra il breakdown dei motivi 'No'", async () => {
    mockWithGte();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(await screen.findByText('Motivi "No" (2)')).toBeInTheDocument();
    expect(screen.getByText("Non avevo i soldi")).toBeInTheDocument();
    expect(screen.getByText("Dimenticato")).toBeInTheDocument();
  });

  it("mostra empty state quando non ci sono dati", async () => {
    mockWithGteEmpty();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(
      await screen.findByText("Nessun feedback ricevuto nel periodo selezionato."),
    ).toBeInTheDocument();
  });

  it("cambia filtro temporale", async () => {
    mockWithGte();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(await screen.findByText("5 risposte totali")).toBeInTheDocument();

    // Click su "90 giorni"
    fireEvent.click(screen.getByText("90 giorni"));

    const btn90 = screen.getByText("90 giorni");
    expect(btn90).toBeInTheDocument();
  });

  it("mostra il titolo", async () => {
    mockWithGteEmpty();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(await screen.findByText("Feedback Post-Scadenza")).toBeInTheDocument();
  });

  it("mostra errore su query failure", async () => {
    mockWithGteError();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(await screen.findByText(/Errore nel caricamento/)).toBeInTheDocument();
  });

  it("mostra i tre pulsanti filtro temporale", async () => {
    mockWithGteEmpty();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    expect(await screen.findByText("30 giorni")).toBeInTheDocument();
    expect(screen.getByText("90 giorni")).toBeInTheDocument();
    expect(screen.getByText("Tutto")).toBeInTheDocument();
  });

  it("filtro 'Tutto' (days=null) mostra i dati senza .gte()", async () => {
    mockWithGte();
    render(<AdminFeedbackStats />, { wrapper: createWrapper() });

    // Aspetta il render iniziale (30gg default)
    expect(await screen.findByText("5 risposte totali")).toBeInTheDocument();

    // Click su "Tutto" → days=null → hook fa await query senza .gte()
    fireEvent.click(screen.getByText("Tutto"));

    // Il mock thenable restituisce SAMPLE_ROWS anche senza .gte()
    expect(await screen.findByText("5 risposte totali")).toBeInTheDocument();
  });
});
