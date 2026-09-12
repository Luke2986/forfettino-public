/**
 * Test per FiscalRulesForm component
 * Story 7.1 + 13.8 — Interfaccia Admin per Aggiornamento Parametri INPS
 *
 * Copertura:
 * - Rendering sezioni form (Separata, Artigiani, Commercianti, Condivisi, Regime, Fonti)
 * - Valori visualizzati direttamente dal DB (aliquote in formato percentuale: 26.07)
 * - Warning source_url vuoto
 * - Validazione Zod su submit (aliquote negative, URL invalida)
 * - Submit con mutation e toast feedback
 * - [13.8] Dirty state: bottone disabilitato quando clean, abilitato quando dirty
 * - [13.8] Indicatore "Modifiche non salvate" visibile solo quando dirty
 * - [13.8] Reset dirty state dopo salvataggio riuscito
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mock Supabase ──
const mockUpdateSingle = vi.fn(() => Promise.resolve({ data: {}, error: null }));
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEq = vi.fn(() => ({ select: mockUpdateSelect }));
const mockUpdate = vi.fn<any>(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn<any>(() => ({
  update: mockUpdate,
}));

// Mock channel per broadcastFiscalRulesUpdate (fire-and-forget nel hook onSuccess)
const mockChannelSend = vi.fn(() => Promise.resolve("ok"));
const mockChannelSubscribe = vi.fn((_status: string, cb?: (status: string) => void) => {
  if (cb) cb("SUBSCRIBED");
  return { unsubscribe: vi.fn() };
});
const mockChannel = vi.fn(() => ({
  send: mockChannelSend,
  subscribe: mockChannelSubscribe,
  unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (..._args: unknown[]) => mockFrom(),
    channel: (..._args: unknown[]) => mockChannel(),
    removeChannel: vi.fn(),
  },
}));

import { FiscalRulesForm } from "./FiscalRulesForm";
import type { FiscalRulesRow } from "@/hooks/useFiscalRules";

// Mock data con aliquote in formato percentuale (come nel DB: 26.07 per 26.07%)
const mockData: FiscalRulesRow = {
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSingle.mockResolvedValue({ data: mockData, error: null });
});

describe("FiscalRulesForm", () => {
  it("renderizza tutte le sezioni del form", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    expect(screen.getByText("Gestione Separata")).toBeInTheDocument();
    expect(screen.getByText("Artigiani")).toBeInTheDocument();
    expect(screen.getByText("Commercianti")).toBeInTheDocument();
    expect(screen.getByText("Parametri Condivisi")).toBeInTheDocument();
    expect(screen.getByText("Regime Forfettario")).toBeInTheDocument();
    expect(screen.getByText("Fonti Normative")).toBeInTheDocument();
  });

  it("mostra aliquote direttamente dal DB (formato percentuale)", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const input = screen.getByLabelText("Aliquota INPS");
    expect(input).toHaveValue("26.07");
  });

  it("mostra valori monetari direttamente senza conversione", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const inputs = screen.getAllByLabelText("Minimale annuo");
    expect(inputs[0]).toHaveValue("4521.36");
  });

  it("non mostra warning quando source_url sono presenti", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    expect(screen.queryByText(/Raccomandato/i)).not.toBeInTheDocument();
  });

  it("mostra warning quando source_url sono vuote", () => {
    const dataNoUrl = {
      ...mockData,
      source_url_separata: null,
      source_url_artigiani_commercianti: null,
    };
    render(<FiscalRulesForm data={dataNoUrl} />, { wrapper: createWrapper() });

    expect(screen.getByText(/Raccomandato.*inserire.*URL/i)).toBeInTheDocument();
  });

  it("mostra il bottone Salva Modifiche", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    expect(screen.getByText("Salva Modifiche")).toBeInTheDocument();
  });

  it("permette di modificare un campo numerico", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const input = screen.getByLabelText("Aliquota INPS");
    fireEvent.change(input, { target: { value: "27.00" } });
    expect(input).toHaveValue("27.00");
  });

  it("save button è disabilitato quando il form è pulito (dirty=false)", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const saveButton = screen.getByText("Salva Modifiche").closest("button")!;
    expect(saveButton).toBeDisabled();
  });

  it("save button si abilita dopo modifica campo (dirty=true)", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const input = screen.getByLabelText("Aliquota INPS");
    fireEvent.change(input, { target: { value: "27.00" } });

    const saveButton = screen.getByText("Salva Modifiche").closest("button")!;
    expect(saveButton).not.toBeDisabled();
  });

  it("mostra indicatore 'Modifiche non salvate' quando dirty", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    expect(screen.queryByText("Modifiche non salvate")).not.toBeInTheDocument();

    const input = screen.getByLabelText("Aliquota INPS");
    fireEvent.change(input, { target: { value: "27.00" } });

    expect(screen.getByText("Modifiche non salvate")).toBeInTheDocument();
  });

  it("chiama mutation con valori in formato percentuale al submit", async () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    // Devo rendere dirty il form per abilitare il save
    const input = screen.getByLabelText("Aliquota INPS");
    fireEvent.change(input, { target: { value: "27.00" } });

    const saveButton = screen.getByText("Salva Modifiche");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    // Verifica che update è stato chiamato con il valore modificato
    const updatePayload = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatePayload.inps_rate_separata).toBeCloseTo(27.0, 2);
  });

  it("resetta dirty state dopo salvataggio riuscito", async () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    // Rendi dirty il form
    const input = screen.getByLabelText("Aliquota INPS");
    fireEvent.change(input, { target: { value: "27.00" } });

    expect(screen.getByText("Modifiche non salvate")).toBeInTheDocument();
    const saveButton = screen.getByText("Salva Modifiche").closest("button")!;
    expect(saveButton).not.toBeDisabled();

    // Salva
    fireEvent.click(saveButton);

    // Dopo save riuscito, dirty state deve resettarsi
    await waitFor(() => {
      expect(screen.queryByText("Modifiche non salvate")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Salva Modifiche").closest("button")!).toBeDisabled();
  });

  it("mostra errore validazione per aliquota negativa", async () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const input = screen.getByLabelText("Aliquota INPS");
    fireEvent.change(input, { target: { value: "-5" } });

    const saveButton = screen.getByText("Salva Modifiche");
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Zod: "Number must be greater than or equal to 0"
      const errorMessages = screen.getAllByText(/greater than or equal|non valido/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it("mostra link esterni per source_url compilate", () => {
    render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    const externalLinks = screen.getAllByRole("link");
    const inpsLink = externalLinks.find((l) => l.getAttribute("href") === "https://www.inps.it/example");
    expect(inpsLink).toBeDefined();
  });

  it("aggiorna il form quando i dati cambiano (prop data)", () => {
    const { rerender } = render(<FiscalRulesForm data={mockData} />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Aliquota INPS")).toHaveValue("26.07");

    // Simula cambio anno con nuovi dati (aliquota in formato percentuale)
    const newData = { ...mockData, inps_rate_separata: 28.0 };
    const Wrapper = createWrapper();
    rerender(<Wrapper><FiscalRulesForm data={newData} /></Wrapper>);

    // Re-query l'input dopo il rerender (il DOM è stato ricostruito)
    expect(screen.getByLabelText("Aliquota INPS")).toHaveValue("28");
  });
});
