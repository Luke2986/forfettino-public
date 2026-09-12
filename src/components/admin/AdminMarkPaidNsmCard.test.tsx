import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminMarkPaidNsmCard } from "./AdminMarkPaidNsmCard";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mockRpc },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const POPULATED = {
  nsm_users: 12,
  tracked_marks: 40,
  tracking_since: "2026-06-09",
  green: 30,
  yellow: 6,
  red: 4,
  green_percent: 75.0,
  reason_given: 10,
  category_reality: 6,
  category_engine: 3,
  category_unknown: 1,
  window_tracked: 20,
  window_ordinary: 8,
  window_proroga: 7,
  window_differimento: 4,
  window_late: 1,
  surcharge_total_cents: 4800,
};

beforeEach(() => {
  mockRpc.mockReset();
});

describe("AdminMarkPaidNsmCard", () => {
  it("chiama la RPC get_payment_discrepancy_stats", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED, error: null });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("get_payment_discrepancy_stats");
    });
  });

  it("mostra NSM (utenti distinti) e accuratezza (% green)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED, error: null });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument(); // nsm_users (NSM)
    });
    // 75.0% compare sia nell'headline accuratezza sia nella barra verde →
    // disambiguo via aria-label dell'headline.
    expect(screen.getByLabelText(/Accuratezza: 75\.0 percento/)).toBeInTheDocument();
    // Nota forward-only: "40" e' in uno <span>, testo spezzato → matcher su textContent.
    // Match su piu' ancestor (p + card) → basta che almeno uno esista.
    expect(
      screen.getAllByText((_, el) =>
        (el?.textContent ?? "").includes("40 pagamenti tracciati"),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("mostra il breakdown causa con i candidati engine evidenziati", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED, error: null });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Causa scostamento/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Engine \(candidati bug/)).toBeInTheDocument();
    expect(screen.getByText(/attribuiti al motore/)).toBeInTheDocument();
  });

  it("empty state quando non ci sono pagamenti", async () => {
    mockRpc.mockResolvedValue({
      data: {
        nsm_users: 0, tracked_marks: 0, tracking_since: null,
        green: 0, yellow: 0, red: 0,
        green_percent: null, reason_given: 0,
        category_reality: 0, category_engine: 0, category_unknown: 0,
      },
      error: null,
    });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Nessuna tassa ancora segnata/)).toBeInTheDocument();
    });
  });

  it("NSM retroattiva senza tracking forward: mostra utenti, accuratezza in attesa", async () => {
    // Mark storici (art/comm) ma nessuna riga in payment_discrepancies.
    mockRpc.mockResolvedValue({
      data: {
        nsm_users: 5, tracked_marks: 0, tracking_since: null,
        green: 0, yellow: 0, red: 0,
        green_percent: null, reason_given: 0,
        category_reality: 0, category_engine: 0, category_unknown: 0,
      },
      error: null,
    });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // nsm_users retroattivi
    });
    // Accuratezza non disponibile finche' non arrivano pagamenti tracciati.
    expect(
      screen.getByLabelText(/Accuratezza non ancora disponibile/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/in attesa dei primi pagamenti tracciati/),
    ).toBeInTheDocument();
    // Nessuna barra distribuzione (niente tracking forward).
    expect(screen.queryByText(/Distribuzione scostamento/)).not.toBeInTheDocument();
  });

  it("error state quando la RPC fallisce", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Impossibile caricare le statistiche/)).toBeInTheDocument();
    });
  });

  it("mostra il breakdown per finestra di versamento + maggiorazione incassata", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED, error: null });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Finestra di versamento/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Oltre 20 agosto/)).toBeInTheDocument();
    // 4800 cent = 48,00 € di maggiorazione differimento incassata
    expect(screen.getByText(/Maggiorazione differimento incassata/)).toBeInTheDocument();
  });

  it("NON mostra il breakdown finestra se nessuna rata giugno tracciata", async () => {
    mockRpc.mockResolvedValue({
      data: { ...POPULATED, window_tracked: 0, window_ordinary: 0, window_proroga: 0, window_differimento: 0, window_late: 0, surcharge_total_cents: 0 },
      error: null,
    });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Finestra di versamento/)).not.toBeInTheDocument();
  });

  it("non mostra il breakdown causa se nessuno scostamento ha motivo", async () => {
    mockRpc.mockResolvedValue({
      data: { ...POPULATED, reason_given: 0, category_reality: 0, category_engine: 0, category_unknown: 0 },
      error: null,
    });
    render(<AdminMarkPaidNsmCard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Causa scostamento/)).not.toBeInTheDocument();
  });
});
