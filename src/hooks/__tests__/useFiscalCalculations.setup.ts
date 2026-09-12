/**
 * Setup condiviso per tutti i test di useFiscalCalculations.
 *
 * Esporta: mock data, mock builders, createChain(), createWrapper(), setupDefaultMocks().
 * NOTA: vi.mock() deve restare nei singoli file test (hoisted).
 */

import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ===== Mock data constants =====

export const mockFiscalRulesData = {
  id: "rules-uuid",
  fiscal_year: 2025,
  inps_rate_separata: 26.07,
  massimale_separata: 120607.0,
  inps_rate_artigiani: 24.0,
  inps_rate_artigiani_alta: 25.0,
  minimale_artigiani: 4427.04,
  massimale_artigiani: 91680.0,
  inps_rate_commercianti: 24.48,
  inps_rate_commercianti_alta: 25.48,
  minimale_commercianti: 4515.43,
  massimale_commercianti: 91680.0,
  reddito_minimale: 18415.0,
  soglia_reddito_prima_fascia: 55008.0,
  maternita_annuale: 7.44,
  aliquota_sostitutiva_5: 5.0,
  aliquota_sostitutiva_15: 15.0,
  soglia_forfettario: 85000.0,
  source_url_separata: "https://www.inps.it/example",
  source_url_artigiani_commercianti: "https://www.confcommercio.it/example",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

export const ACCONTI_ZERO = {
  accontoImpostaGiugno: 0,
  accontoImpostaNovembre: 0,
  impostaHasDueRate: false,
  accontoINPSGiugno: 0,
  accontoINPSNovembre: 0,
  totaleAccontiImposta: 0,
  totaleAccontiINPS: 0,
  totaleAcconti: 0,
};

export const ACCONTI_NORMAL = {
  accontoImpostaGiugno: 100,
  accontoImpostaNovembre: 150,
  impostaHasDueRate: true,
  accontoINPSGiugno: 80,
  accontoINPSNovembre: 80,
  totaleAccontiImposta: 250,
  totaleAccontiINPS: 160,
  totaleAcconti: 410,
};

export const mockSettings = {
  id: "settings-uuid",
  user_id: "test-user-id",
  fiscal_year: 2025,
  tax_rate: 15,
  profit_coefficient: 78,
  inps_rate: 26.07,
  safety_buffer_rate: 5,
  reserve_amount: 0,
  buffer_base: "receipts",
  inps_management: "separata",
  deadline_window_days: 45,
  riduzione_35_attiva: false,
  riduzione_50_attiva: false,
  banner_rate_scadute_dismissed: false,
  banner_fallback_commercialista_dismissed: false,
  acconti_imposta_versati: 0,
  acconti_inps_eccedenza_versati: 0,
  saldo_iniziale_cc: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

export const mockReceipts = [
  {
    id: "r1",
    user_id: "test-user-id",
    fiscal_year: 2025,
    gross_amount: 10000,
    description: "Fattura 1",
    receipt_date: "2025-03-15",
    created_at: "2025-03-15T00:00:00Z",
    updated_at: "2025-03-15T00:00:00Z",
  },
  {
    id: "r2",
    user_id: "test-user-id",
    fiscal_year: 2025,
    gross_amount: 5000,
    description: "Fattura 2",
    receipt_date: "2025-04-01",
    created_at: "2025-04-01T00:00:00Z",
    updated_at: "2025-04-01T00:00:00Z",
  },
];

export const mockSettingsPrevYear = {
  ...mockSettings,
  fiscal_year: 2024,
  anno_apertura_piva: 2020,
};

export function mockScheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    user_id: "test-user-id",
    bucket: "june",
    due_date: "2025-06-30",
    payment_year: 2025,
    reference_year: 2024,
    tax_balance: 500,
    tax_advance: 300,
    inps_balance: 200,
    inps_advance: 100,
    total_expected: 1100,
    total_paid: 0,
    status: "open",
    notes: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ===== Supabase chain mock =====

export let mockTableData: Record<string, { data: unknown; error: unknown }> = {};
export let mockTableDataSingle: Record<string, { data: unknown; error: unknown }> = {};
export let mockTableDataMaybeSingle: Record<string, { data: unknown; error: unknown }> = {};
export let mockTableDataCount: Record<string, { data: unknown; error: unknown; count: number | null }> = {};

/**
 * Per-fiscal-year mock data override.
 * Chiave: "tableName:fiscalYear" → dati specifici per quell'anno.
 * Usato da createChain per distinguere query su receipts anno N vs anno N-1.
 * Se non presente, fallback a mockTableData[tableName].
 */
export let mockTableDataByYear: Record<string, { data: unknown; error: unknown }> = {};

export function createChain(tableName: string) {
  const chain: Record<string, unknown> = {};
  let trackedFiscalYear: number | null = null;
  const methods = ["select", "neq", "gte", "lte", "lt", "gt", "order", "limit", "not", "in", "is"];

  for (const method of methods) {
    chain[method] = vi.fn((..._args: unknown[]) => chain);
  }

  // Track fiscal_year from .eq() calls for per-year data resolution
  chain.eq = vi.fn((...args: unknown[]) => {
    if (args[0] === "fiscal_year" && typeof args[1] === "number") {
      trackedFiscalYear = args[1];
    }
    return chain;
  });

  chain.single = vi.fn(() => {
    const res = mockTableDataSingle[tableName] ?? mockTableData[tableName] ?? { data: null, error: null };
    return Promise.resolve(res);
  });

  chain.maybeSingle = vi.fn(() => {
    // Check per-year override first (Story 39-2: differentiate current vs prev year settings)
    if (trackedFiscalYear != null) {
      const yearKey = `${tableName}:${trackedFiscalYear}`;
      if (yearKey in mockTableDataByYear) {
        return Promise.resolve(mockTableDataByYear[yearKey]);
      }
      // Current-year queries (matching mockSettings.fiscal_year) use single/default data
      // Previous-year queries fall through to mockTableDataMaybeSingle below
      if (trackedFiscalYear === mockSettings.fiscal_year) {
        const res = mockTableDataSingle[tableName]
          ?? mockTableData[tableName]
          ?? { data: null, error: null };
        return Promise.resolve(res);
      }
    }
    const res = mockTableDataMaybeSingle[tableName] ?? { data: null, error: null };
    return Promise.resolve(res);
  });

  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    // Check per-year override first
    if (trackedFiscalYear != null) {
      const yearKey = `${tableName}:${trackedFiscalYear}`;
      if (yearKey in mockTableDataByYear) {
        return Promise.resolve(mockTableDataByYear[yearKey]).then(resolve, reject);
      }
    }
    const res = mockTableData[tableName] ?? { data: [], error: null };
    return Promise.resolve(res).then(resolve, reject);
  };

  return chain;
}

// ===== QueryClient wrapper =====

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ===== Default mock setup =====

export function setupDefaultMocks() {
  mockTableData = {
    fiscal_year_settings: { data: mockSettings, error: null },
    receipts: { data: mockReceipts, error: null },
    tool_subscriptions: { data: [], error: null },
    tax_schedule: { data: [], error: null },
  };
  mockTableDataSingle = {
    fiscal_year_settings: { data: mockSettings, error: null },
    tax_schedule: { data: null, error: { code: "PGRST116", message: "No rows" } },
  };
  mockTableDataMaybeSingle = {
    fiscal_year_settings: { data: mockSettingsPrevYear, error: null },
  };
  mockTableDataCount = {};
  mockTableDataByYear = {};
}
