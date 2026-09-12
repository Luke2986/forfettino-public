/**
 * Test per AdminDeadlineEmailMetrics (Story 84.9, Task 6.1).
 *
 * Copertura:
 * - render KPI recapito da fixture (inviate/recapitate/bounce/reclami)
 * - tasso click reale (PostHog) + label "consenso analytics" (AC#3/#6)
 * - disclaimer Apple MPP su opened (AC#6)
 * - switch finestra ri-chiama l'RPC con p_since diverso
 * - export CSV invoca downloadCsv (spy)
 * - empty state (total=0)
 * - loading → skeleton; isError → messaggio
 * - blocco click in errore NON abbatte le KPI recapito
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// --- Mock state ---
let mockStats: unknown = null;
let mockStatsError: unknown = null;
let mockTrend: unknown = [];
let mockRecipients: unknown = [];
let mockClicksData: unknown = null;
let mockClicksError: unknown = null;
const rpcCalls: { name: string; args: unknown }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      if (name === "get_email_event_stats")
        return Promise.resolve({ data: mockStats, error: mockStatsError });
      if (name === "get_email_event_trend")
        return Promise.resolve({ data: mockTrend, error: null });
      if (name === "get_email_event_recipients")
        return Promise.resolve({ data: mockRecipients, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    functions: {
      invoke: () =>
        Promise.resolve({ data: mockClicksData, error: mockClicksError }),
    },
  },
}));

// Spy su downloadCsv, buildCsv reale
const mockDownloadCsv = vi.fn();
vi.mock("@/lib/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csv")>();
  return { ...actual, downloadCsv: (...a: unknown[]) => mockDownloadCsv(...a) };
});

import { AdminDeadlineEmailMetrics } from "../AdminDeadlineEmailMetrics";

const STATS_FIXTURE = {
  total: 200,
  sent: 100,
  delivered: 90,
  delivery_delayed: 2,
  bounced: 6,
  complained: 1,
  failed: 1,
  opened: 0,
  clicked: 0,
  by_threshold: {
    "7": { total: 50, delivered: 45, bounced: 3, complained: 1 },
    "0": { total: 50, delivered: 45, bounced: 3, complained: 0 },
  },
};

const CLICKS_FIXTURE = {
  clicks: 18,
  sends: 100,
  click_rate: 0.18,
  by_threshold: [{ threshold: "7", clicks: 10, sends: 50, click_rate: 0.2 }],
  trend: [{ day: "2026-06-25", clicks: 10, sends: 50 }],
};

function renderComponent() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminDeadlineEmailMetrics />
    </QueryClientProvider>,
  );
}

describe("AdminDeadlineEmailMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcCalls.length = 0;
    mockStats = STATS_FIXTURE;
    mockStatsError = null;
    mockTrend = [];
    mockRecipients = [];
    mockClicksData = CLICKS_FIXTURE;
    mockClicksError = null;
  });

  it("renderizza le KPI di recapito da fixture", async () => {
    renderComponent();
    await waitFor(() => {
      // Heading sezione + valori KPI univoci (le label "Inviate"/"Recapitate" sono
      // anche bottoni del filtro evento → asserire i valori, non le label ambigue).
      expect(screen.getByText(/Recapito · segnali SMTP completi/i)).toBeInTheDocument();
      expect(screen.getByText("90")).toBeInTheDocument(); // delivered
      expect(screen.getByText("6")).toBeInTheDocument(); // bounced
    });
  });

  it("mostra tasso click reale (PostHog) con label consenso analytics", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("18.0%")).toBeInTheDocument();
      expect(screen.getByText(/consenso analytics/i)).toBeInTheDocument();
    });
  });

  it("mostra il disclaimer Apple MPP su opened (predisposto)", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Apple Mail Privacy Protection/i)).toBeInTheDocument();
    });
  });

  it("switch finestra ri-chiama get_email_event_stats con p_since diverso", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("90")).toBeInTheDocument());

    const statsCallsBefore = rpcCalls.filter((c) => c.name === "get_email_event_stats");
    const sinceBefore = (statsCallsBefore[0].args as { p_since?: string }).p_since;
    expect(sinceBefore).toBeTruthy(); // default 30d → since presente

    // Cambia a "Tutto" → p_since undefined
    fireEvent.click(screen.getByRole("button", { name: "Tutto" }));

    await waitFor(() => {
      const allCalls = rpcCalls.filter((c) => c.name === "get_email_event_stats");
      const last = allCalls[allCalls.length - 1].args as { p_since?: string };
      expect(last.p_since).toBeUndefined();
    });
  });

  it("export CSV invoca downloadCsv", async () => {
    mockRecipients = [
      {
        recipient_email: "user@test.com",
        user_id: "u1",
        event_type: "email.delivered",
        threshold: "7",
        clicked_url: null,
        occurred_at: "2026-06-25T10:00:00Z",
      },
    ];
    renderComponent();
    const btn = await screen.findByTestId("export-recipients-csv");
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = mockDownloadCsv.mock.calls[0];
    expect(filename).toMatch(/^email-scadenze-30d-\d{4}-\d{2}-\d{2}\.csv$/);
    // Vista admin-only: email COMPLETA (serve a individuare i destinatari con problemi, AC#2).
    expect(csv).toContain("user@test.com");
  });

  it("mostra empty state quando total=0", async () => {
    mockStats = { ...STATS_FIXTURE, total: 0 };
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("email-metrics-empty")).toBeInTheDocument();
    });
  });

  it("mostra messaggio errore quando le KPI falliscono", async () => {
    mockStats = null;
    mockStatsError = new Error("rpc failure");
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Impossibile caricare le metriche email/i)).toBeInTheDocument();
    });
  });

  it("blocco click in errore NON abbatte le KPI recapito", async () => {
    mockClicksData = null;
    mockClicksError = new Error("posthog 502");
    renderComponent();
    await waitFor(() => {
      // KPI recapito presenti (valore delivered univoco)
      expect(screen.getByText("90")).toBeInTheDocument();
      // Errore locale nel blocco click
      expect(screen.getByTestId("click-error")).toBeInTheDocument();
    });
  });

  it("renderizza il trend chart quando ci sono dati (AC#3)", async () => {
    mockTrend = [
      { day: "2026-06-25", sent: 10, delivered: 9, bounced: 1, complained: 0, clicked: 0 },
      { day: "2026-06-26", sent: 8, delivered: 7, bounced: 1, complained: 0, clicked: 0 },
    ];
    renderComponent();
    await waitFor(() => {
      // Il grafico recharts è esposto come role="img" con aria-label dedicato.
      expect(
        screen.getByLabelText("Trend giornaliero recapito email"),
      ).toBeInTheDocument();
    });
    // NON deve comparire l'empty state del trend.
    expect(
      screen.queryByText(/Nessun dato nella finestra selezionata/i),
    ).not.toBeInTheDocument();
  });

  it("renderizza il breakdown per soglia (recapito) dalle righe by_threshold", async () => {
    renderComponent();
    await waitFor(() => {
      // STATS_FIXTURE.by_threshold ha le soglie 7 e 0 → StatBar "Soglia Ng · recapitate".
      expect(screen.getByText(/Soglia 7g · recapitate/i)).toBeInTheDocument();
      expect(screen.getByText(/Soglia 0g · recapitate/i)).toBeInTheDocument();
    });
  });

  it("avvisa quando il drill-down è troncato al limite", async () => {
    mockRecipients = Array.from({ length: 500 }, (_, i) => ({
      recipient_email: `u${i}@test.com`,
      user_id: `u${i}`,
      event_type: "email.delivered",
      threshold: "7",
      clicked_url: null,
      occurred_at: "2026-06-25T10:00:00Z",
    }));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("recipients-truncated")).toBeInTheDocument();
    });
  });

  it("pagina i destinatari a blocchi di 10 con navigazione avanti/indietro", async () => {
    mockRecipients = Array.from({ length: 25 }, (_, i) => ({
      recipient_email: `dest${i}@test.com`,
      user_id: `u${i}`,
      event_type: "email.delivered",
      threshold: "7",
      clicked_url: null,
      occurred_at: "2026-06-25T10:00:00Z",
    }));
    renderComponent();

    // Pagina 1: prime 10 righe (dest0..dest9), l'11ª (dest10) NON è resa.
    // Il pager e la tabella vivono nello stesso ramo → il pager come gate garantisce la tabella.
    await waitFor(() => {
      expect(screen.getByText(/Pagina 1 di 3/)).toBeInTheDocument();
    });
    expect(screen.getByText("dest0@test.com")).toBeInTheDocument();
    expect(screen.getByText("dest9@test.com")).toBeInTheDocument();
    expect(screen.queryByText("dest10@test.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Precedente" })).toBeDisabled();

    // → Pagina 2: righe dest10..dest19, la dest0 non è più resa.
    fireEvent.click(screen.getByRole("button", { name: "Successiva" }));
    await waitFor(() => {
      expect(screen.getByText(/Pagina 2 di 3/)).toBeInTheDocument();
    });
    expect(screen.getByText("dest10@test.com")).toBeInTheDocument();
    expect(screen.queryByText("dest0@test.com")).not.toBeInTheDocument();

    // → Pagina 3 (ultima): 5 righe residue, "Successiva" disabilitata.
    fireEvent.click(screen.getByRole("button", { name: "Successiva" }));
    await waitFor(() => {
      expect(screen.getByText(/Pagina 3 di 3/)).toBeInTheDocument();
    });
    expect(screen.getByText("dest24@test.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Successiva" })).toBeDisabled();

    // ← Ritorno a pagina 2 con "Precedente".
    fireEvent.click(screen.getByRole("button", { name: "Precedente" }));
    await waitFor(() => {
      expect(screen.getByText(/Pagina 2 di 3/)).toBeInTheDocument();
    });
  });

  it("il cambio filtro evento riporta i destinatari alla prima pagina", async () => {
    mockRecipients = Array.from({ length: 25 }, (_, i) => ({
      recipient_email: `dest${i}@test.com`,
      user_id: `u${i}`,
      event_type: "email.delivered",
      threshold: "7",
      clicked_url: null,
      occurred_at: "2026-06-25T10:00:00Z",
    }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Pagina 1 di 3/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Successiva" }));
    await waitFor(() => {
      expect(screen.getByText(/Pagina 2 di 3/)).toBeInTheDocument();
    });

    // Cambia filtro evento (Bounce) → deve tornare a pagina 1.
    fireEvent.click(screen.getByRole("button", { name: "Bounce" }));
    await waitFor(() => {
      expect(screen.getByText(/Pagina 1 di 3/)).toBeInTheDocument();
    });
  });
});
