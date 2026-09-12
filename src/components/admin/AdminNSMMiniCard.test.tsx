import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminNSMMiniCard } from "./AdminNSMMiniCard";

// ── Mocks ──

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Dataset APU (hot-fix 2026-04-18 — refactor da WCAF a APU).
// Scenario realistico basato sui dati production del 18/04:
//   Iscritti 200 → Onboarded 180 → Con incasso 178 → Attivi 90gg 176 → Paymarked 5.
// APU = 5 / 176 ≈ 2.8%. Drop massimo: attivi → paymarked (97%).
// POPULATED_DATA non contiene by_gestione → testa anche la retro-compat col
// server pre-migration 20260419100000 (il widget deve gracefully nascondere
// la sezione "Per gestione").
const POPULATED_DATA = {
  fiscal_year: 2026,
  reference_date: "2026-04-18",
  funnel: [
    { key: "iscritti", label: "Iscritti", count: 200, percent_of_top: 100.0 },
    { key: "onboarded", label: "Onboarding completato", count: 180, percent_of_top: 90.0 },
    { key: "con_incasso", label: "Primo incasso", count: 178, percent_of_top: 89.0 },
    { key: "attivi_90gg", label: "Attivi ultimi 90 giorni", count: 176, percent_of_top: 88.0 },
    { key: "paymarked_ytd", label: "Hanno marcato pagato", count: 5, percent_of_top: 2.5 },
  ],
  apu_percent: 2.8,
  apu_numerator: 5,
  apu_denominator: 176,
};

// Dataset con split by_gestione (post migration 20260419100000).
// Scenario realistico aprile 2026:
//   Separata: 126 attivi, 0 paymarked (nessuna scadenza 2026 ancora dovuta).
//   Art/Comm: 50 attivi, 5 paymarked (qualche outlier — Q4 2025 marcato
//   a febbraio NON conta perche' payment_year=2025).
// Label mini-funnel: "Attivi (90gg)" (diversa dalla aggregate "Attivi
// ultimi 90 giorni") per distinguere nel DOM.
const POPULATED_DATA_WITH_GESTIONE = {
  ...POPULATED_DATA,
  by_gestione: {
    separata: {
      funnel: [
        { key: "onboarded", label: "Onboarding completato", count: 130, percent_of_top: 100.0 },
        { key: "con_incasso", label: "Primo incasso", count: 128, percent_of_top: 98.5 },
        { key: "attivi_90gg", label: "Attivi (90gg)", count: 126, percent_of_top: 96.9 },
        { key: "paymarked_ytd", label: "Hanno marcato pagato", count: 0, percent_of_top: 0.0 },
      ],
      apu_percent: 0.0,
      apu_numerator: 0,
      apu_denominator: 126,
    },
    art_comm: {
      funnel: [
        { key: "onboarded", label: "Onboarding completato", count: 52, percent_of_top: 100.0 },
        { key: "con_incasso", label: "Primo incasso", count: 51, percent_of_top: 98.1 },
        { key: "attivi_90gg", label: "Attivi (90gg)", count: 50, percent_of_top: 96.2 },
        { key: "paymarked_ytd", label: "Hanno marcato pagato", count: 5, percent_of_top: 9.6 },
      ],
      apu_percent: 10.0,
      apu_numerator: 5,
      apu_denominator: 50,
    },
  },
};

describe("AdminNSMMiniCard (APU + funnel hot-fix 2026-04-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra skeleton loader durante la fetch", () => {
    mockRpc.mockImplementation(() => new Promise(() => {}));

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    // Titolo visibile anche in loading (layout condiviso)
    expect(screen.getByText("NSM: Adozione Forfettino")).toBeInTheDocument();
    // Nessun numero del funnel visibile
    expect(screen.queryByText("2.8%")).not.toBeInTheDocument();
    // Loading ARIA
    const loadingRegion = screen.getByRole("status");
    expect(loadingRegion).toHaveAttribute("aria-busy", "true");
  });

  it("chiama la RPC get_nsm_adoption_funnel senza parametri", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    // APU headline 2.8% appare solo quando la risposta e' populate
    await screen.findByText("2.8%");
    expect(mockRpc).toHaveBeenCalledWith("get_nsm_adoption_funnel");
  });

  it("renderizza APU headline + conteggi + meta anno", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    // APU headline
    expect(await screen.findByText("2.8%")).toBeInTheDocument();
    // Sublabel conteggi APU
    expect(screen.getByText(/5 paymarked \/ 176 attivi ultimi 90gg/)).toBeInTheDocument();
    // Header meta (anno corrente + data IT)
    expect(screen.getByText(/Anno 2026 · Aggiornato al 18\/04\/2026/)).toBeInTheDocument();
    // Label "APU · Active Paymark Users"
    expect(screen.getByText(/APU · Active Paymark Users/)).toBeInTheDocument();
  });

  it("renderizza tutti i 5 step del funnel con label + count", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");

    // Tutti gli step con label
    expect(screen.getByText("Iscritti")).toBeInTheDocument();
    expect(screen.getByText("Onboarding completato")).toBeInTheDocument();
    expect(screen.getByText("Primo incasso")).toBeInTheDocument();
    expect(screen.getByText("Attivi ultimi 90 giorni")).toBeInTheDocument();
    expect(screen.getByText("Hanno marcato pagato")).toBeInTheDocument();

    // Conteggi (ciascun numero univoco)
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
    expect(screen.getByText("178")).toBeInTheDocument();
    expect(screen.getByText("176")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("mostra 5 progressbar con aria-valuenow derivato da percent_of_top", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(5);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(bars[0]).toHaveAttribute("aria-valuemin", "0");
    expect(bars[0]).toHaveAttribute("aria-valuemax", "100");
    expect(bars[4]).toHaveAttribute("aria-valuenow", "2.5");
  });

  it("applica colore rosso a APU < 25% (red flag semantico)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    const headline = await screen.findByText("2.8%");
    expect(headline.className).toContain("text-red-600");
  });

  it("applica colore ambra a APU 25-49%", async () => {
    mockRpc.mockResolvedValue({
      data: { ...POPULATED_DATA, apu_percent: 35.0 },
      error: null,
    });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    const headline = await screen.findByText("35.0%");
    expect(headline.className).toContain("text-amber-700");
  });

  it("applica colore verde a APU >= 50% (obiettivo PLG sano)", async () => {
    mockRpc.mockResolvedValue({
      data: { ...POPULATED_DATA, apu_percent: 62.5 },
      error: null,
    });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    const headline = await screen.findByText("62.5%");
    expect(headline.className).toContain("text-emerald-700");
  });

  it("mostra insight drop-off quando > 10% utenti persi tra due step consecutivi", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");

    // Drop attivi(176) → paymarked(5) = 171/176 = 97.2%. Deve essere riportato.
    expect(screen.getByText(/97.2%/)).toBeInTheDocument();
    expect(
      screen.getByText(/degli utenti perso prima di "Hanno marcato pagato"/),
    ).toBeInTheDocument();
  });

  it("NON mostra insight drop-off quando tutti gli step > 90% del precedente", async () => {
    // Funnel sano: tutti conversion >= 95%
    mockRpc.mockResolvedValue({
      data: {
        ...POPULATED_DATA,
        funnel: [
          { key: "iscritti", label: "Iscritti", count: 100, percent_of_top: 100.0 },
          { key: "onboarded", label: "Onboarding completato", count: 98, percent_of_top: 98.0 },
          { key: "con_incasso", label: "Primo incasso", count: 96, percent_of_top: 96.0 },
          { key: "attivi_90gg", label: "Attivi ultimi 90 giorni", count: 95, percent_of_top: 95.0 },
          { key: "paymarked_ytd", label: "Hanno marcato pagato", count: 92, percent_of_top: 92.0 },
        ],
        apu_percent: 96.8,
        apu_numerator: 92,
        apu_denominator: 95,
      },
      error: null,
    });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("96.8%");
    // Drop massimo e' 5→2 step 4→5 = 3.2%, sotto soglia 10%.
    expect(screen.queryByText(/degli utenti perso prima di/)).not.toBeInTheDocument();
  });

  it("mostra error state quando la RPC fallisce", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("perms denied") });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    expect(
      await screen.findByText(/Impossibile caricare la NSM/),
    ).toBeInTheDocument();
    // Titolo visibile anche in error
    expect(screen.getByText("NSM: Adozione Forfettino")).toBeInTheDocument();
  });

  it("mostra '—' e gestisce APU null (edge: 0 attivi)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        fiscal_year: 2026,
        reference_date: "2026-04-18",
        funnel: [
          { key: "iscritti", label: "Iscritti", count: 0, percent_of_top: 100.0 },
          { key: "onboarded", label: "Onboarding completato", count: 0, percent_of_top: null },
          { key: "con_incasso", label: "Primo incasso", count: 0, percent_of_top: null },
          { key: "attivi_90gg", label: "Attivi ultimi 90 giorni", count: 0, percent_of_top: null },
          { key: "paymarked_ytd", label: "Hanno marcato pagato", count: 0, percent_of_top: null },
        ],
        apu_percent: null,
        apu_numerator: 0,
        apu_denominator: 0,
      },
      error: null,
    });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    // APU headline mostra '—'
    expect(await screen.findByText("—")).toBeInTheDocument();
    // Sublabel coerente con 0/0
    expect(
      screen.getByText(/0 paymarked \/ 0 attivi ultimi 90gg/),
    ).toBeInTheDocument();
    // Nessun drop-off insight (tutti gli step sono 0)
    expect(screen.queryByText(/degli utenti perso prima di/)).not.toBeInTheDocument();
  });

  it("fallback '—' su reference_date vuoto (defense-in-depth)", async () => {
    mockRpc.mockResolvedValue({
      data: { ...POPULATED_DATA, reference_date: "" },
      error: null,
    });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");
    expect(screen.getByText(/Aggiornato al —/)).toBeInTheDocument();
  });

  // ==========================================================================
  // SPLIT BY GESTIONE (migration 20260419100000)
  // ==========================================================================

  it("NON mostra sezione 'Per gestione' se server non ritorna by_gestione (retro-compat)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");
    // Retro-compat: pre migration 20260419100000 il server non torna
    // by_gestione → la sezione e' nascosta gracefully.
    expect(screen.queryByText(/Per gestione INPS/)).not.toBeInTheDocument();
    expect(screen.queryByText("Gestione Separata")).not.toBeInTheDocument();
    expect(screen.queryByText("Artigiani / Commercianti")).not.toBeInTheDocument();
  });

  it("mostra sezione 'Per gestione INPS' con le due mini-card quando by_gestione presente", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA_WITH_GESTIONE, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");

    expect(screen.getByText(/Per gestione INPS/)).toBeInTheDocument();
    expect(screen.getByText("Gestione Separata")).toBeInTheDocument();
    expect(screen.getByText("Artigiani / Commercianti")).toBeInTheDocument();
    // Sublabel stagionale: contestualizza le scadenze fiscali
    expect(screen.getByText(/art\/comm: 16\/05/)).toBeInTheDocument();
    expect(screen.getByText(/separata: 20\/07/)).toBeInTheDocument();
  });

  it("mostra APU headline distinto per Separata (0.0%) e Art/Comm (10.0%)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA_WITH_GESTIONE, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%"); // aggregate
    // "0.0%" appare come APU headline Separata + percent_of_top ultimo
    // step del funnel Separata → filtro per tipografia headline (text-2xl).
    const zeroCandidates = screen.getAllByText("0.0%");
    const separataHeadline = zeroCandidates.find((el) => el.className.includes("text-2xl"));
    expect(separataHeadline).toBeDefined();
    // Stesso pattern per "10.0%" (APU Art/Comm)
    const tenCandidates = screen.getAllByText("10.0%");
    const artCommHeadline = tenCandidates.find((el) => el.className.includes("text-2xl"));
    expect(artCommHeadline).toBeDefined();
  });

  it("mostra conteggi APU per gestione (sublabel '[n] paymarked / [d] attivi 90gg')", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA_WITH_GESTIONE, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");

    // Mini-card usano il formato "X paymarked / Y attivi 90gg" (senza "ultimi")
    expect(screen.getByText(/0 paymarked \/ 126 attivi 90gg/)).toBeInTheDocument();
    expect(screen.getByText(/5 paymarked \/ 50 attivi 90gg/)).toBeInTheDocument();
  });

  it("renderizza 4-step funnel per ciascuna gestione (5 aggregate + 4 separata + 4 art/comm = 13 progressbar)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA_WITH_GESTIONE, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(13);
  });

  it("APU Separata 0.0% applica colore rosso (sotto soglia 25%)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA_WITH_GESTIONE, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");
    // "0.0%" appare sia come headline sia nel percent_of_top dello step
    // paymarked del funnel Separata → filtro per classe text-2xl.
    const candidates = screen.getAllByText("0.0%");
    const headline = candidates.find((el) => el.className.includes("text-2xl"));
    expect(headline).toBeDefined();
    expect(headline!.className).toContain("text-red-600");
  });

  it("APU Art/Comm 10.0% applica colore rosso (ancora sotto 25%)", async () => {
    mockRpc.mockResolvedValue({ data: POPULATED_DATA_WITH_GESTIONE, error: null });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");
    // Prendo l'headline Art/Comm: tra tutti gli elementi con "10.0%"
    // cerco quello con la classe tipografica dell'headline (text-2xl).
    const candidates = screen.getAllByText("10.0%");
    const headline = candidates.find((el) => el.className.includes("text-2xl"));
    expect(headline).toBeDefined();
    expect(headline!.className).toContain("text-red-600");
  });

  it("gestione con APU >= 50% applica colore verde (PLG sano)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...POPULATED_DATA,
        by_gestione: {
          separata: POPULATED_DATA_WITH_GESTIONE.by_gestione.separata,
          art_comm: {
            ...POPULATED_DATA_WITH_GESTIONE.by_gestione.art_comm,
            apu_percent: 62.5,
            apu_numerator: 30,
            apu_denominator: 48,
          },
        },
      },
      error: null,
    });

    render(<AdminNSMMiniCard />, { wrapper: createWrapper() });

    await screen.findByText("2.8%");
    const headline = screen.getByText("62.5%");
    expect(headline.className).toContain("text-emerald-700");
  });
});
