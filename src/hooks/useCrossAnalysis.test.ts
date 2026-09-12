/**
 * Story 55.4 — Test hook useCrossAnalysis
 * Mock RPC, verifica struttura matrice, totali, ordinamento.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase
const mockRpcData: any[] = [];
let mockRpcError: Error | null = null;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: mockRpcData, error: mockRpcError })),
  },
}));

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

import { useCrossAnalysis } from "./useCrossAnalysis";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useCrossAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcError = null;
    mockRpcData.length = 0;
  });

  it("trasforma dati flat in struttura matrice", async () => {
    mockRpcData.push(
      { client_id: "c1", client_name: "Acme", category_id: "s1", category_name: "Consulenza", category_color: "#14b8a6", total_gross: 5000, receipt_count: 3 },
      { client_id: "c1", client_name: "Acme", category_id: "s2", category_name: "Design", category_color: "#8b5cf6", total_gross: 2000, receipt_count: 1 },
      { client_id: "c2", client_name: "Beta", category_id: "s1", category_name: "Consulenza", category_color: "#14b8a6", total_gross: 3000, receipt_count: 2 },
    );

    const { result } = renderHook(() => useCrossAnalysis(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const d = result.current.data!;

    // Clients sorted by totalGross DESC: Acme (7000), Beta (3000)
    expect(d.clients).toHaveLength(2);
    expect(d.clients[0].name).toBe("Acme");
    expect(d.clients[0].totalGross).toBe(7000);
    expect(d.clients[1].name).toBe("Beta");
    expect(d.clients[1].totalGross).toBe(3000);

    // Categories sorted by totalGross DESC: Consulenza (8000), Design (2000)
    expect(d.categories).toHaveLength(2);
    expect(d.categories[0].name).toBe("Consulenza");
    expect(d.categories[0].totalGross).toBe(8000);
    expect(d.categories[1].name).toBe("Design");

    // Matrix
    expect(d.matrix.get("c1")?.get("s1")?.totalGross).toBe(5000);
    expect(d.matrix.get("c1")?.get("s2")?.totalGross).toBe(2000);
    expect(d.matrix.get("c2")?.get("s1")?.totalGross).toBe(3000);
    expect(d.matrix.get("c2")?.get("s2")).toBeUndefined();

    // Totals
    expect(d.totals.grand).toBe(10000);
    expect(d.totals.byClient.get("c1")).toBe(7000);
    expect(d.totals.byCategory.get("s1")).toBe(8000);
  });

  it("gestisce incassi senza client e senza categoria", async () => {
    mockRpcData.push(
      { client_id: null, client_name: "Senza cliente", category_id: null, category_name: "Non categorizzato", category_color: "#94a3b8", total_gross: 1000, receipt_count: 1 },
    );

    const { result } = renderHook(() => useCrossAnalysis(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const d = result.current.data!;
    expect(d.clients[0].id).toBeNull();
    expect(d.clients[0].name).toBe("Senza cliente");
    expect(d.categories[0].id).toBeNull();
    expect(d.categories[0].name).toBe("Non categorizzato");
    expect(d.matrix.get("__null__")?.get("__null__")?.totalGross).toBe(1000);
  });

  it("restituisce dati vuoti con RPC vuota", async () => {
    const { result } = renderHook(() => useCrossAnalysis(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const d = result.current.data!;
    expect(d.clients).toHaveLength(0);
    expect(d.categories).toHaveLength(0);
    expect(d.totals.grand).toBe(0);
  });

  it("gestisce errore RPC", async () => {
    mockRpcError = new Error("DB error");

    const { result } = renderHook(() => useCrossAnalysis(2026), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
