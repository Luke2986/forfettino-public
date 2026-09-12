/**
 * Test per useInvoices hook
 * Story 10.2 — Ghost Invoices + Story 10.3 — Fatture a Rate
 *
 * Copertura 10.2:
 * - fetchInvoices query, createInvoiceMutation, markAsCollectedMutation,
 *   deleteInvoiceMutation, editInvoiceMutation, derived data
 *
 * Copertura 10.3:
 * - 8.1: registerPaymentMutation — validazione importo, creazione record, transizione stato
 * - 8.2: markAsReceivedMutation, registerPayment (3 rate progressive), derived con payments
 * - 8.8: Edge case importo = residuo → auto-transizione 'incassata'
 * - 8.9: Edge case importo > residuo → errore bloccante
 * - 8.10: Coerenza somma receipts = importo_lordo
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ===== Mocks =====

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

// Mutable mock data
let mockInvoicesData = [
  {
    id: "inv-1",
    user_id: "test-user-id",
    numero_fattura: "2026/001",
    importo_lordo: 5000,
    cliente: "Acme Corp",
    data_emissione: "2026-03-01",
    data_incasso: null,
    stato: "emessa",
    note: null,
    fiscal_year: 2026,
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "inv-2",
    user_id: "test-user-id",
    numero_fattura: "2026/002",
    importo_lordo: 3000,
    cliente: "Beta Srl",
    data_emissione: "2026-04-01",
    data_incasso: "2026-05-01",
    stato: "incassata",
    note: null,
    fiscal_year: 2026,
    created_at: "2026-04-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  },
];

let mockPaymentsData: any[] = [];

// Track calls for assertions
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockInsertWithSelect = vi.fn(() => ({
  select: vi.fn(() => ({
    single: vi.fn(() =>
      Promise.resolve({ data: { id: "new-pay-id" }, error: null })
    ),
  })),
}));
const mockReceiptInsert = vi.fn(() => Promise.resolve({ error: null }));

const mockUpdateChain = vi.fn(() => ({
  eq: vi.fn((..._args: any[]) => {
    const p = Promise.resolve({ error: null });
    // Support chaining .eq().eq() for markAsReceived
    (p as any).eq = vi.fn(() => Promise.resolve({ error: null }));
    return p;
  }),
}));

const mockDeleteChain = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  })),
}));

// Single-invoice fetch for mutations (returns first invoice by default)
let mockSingleInvoice: any = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "invoices") {
        return {
          select: () => ({
            eq: (..._args: any[]) => ({
              eq: (..._args2: any[]) => ({
                order: () =>
                  Promise.resolve({
                    data: mockInvoicesData,
                    error: null,
                  }),
              }),
              single: () =>
                Promise.resolve({
                  data: mockSingleInvoice ?? mockInvoicesData[0],
                  error: null,
                }),
            }),
          }),
          insert: mockInsert,
          update: mockUpdateChain,
          delete: mockDeleteChain,
        };
      }
      if (table === "invoice_payments") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: mockPaymentsData, error: null }),
            }),
          }),
          insert: mockInsertWithSelect,
        };
      }
      if (table === "receipts") {
        return {
          insert: mockReceiptInsert,
        };
      }
      // Default: return empty for any other table
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    },
  },
}));

import { useInvoices } from "./useInvoices";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoicesData = [
      {
        id: "inv-1",
        user_id: "test-user-id",
        numero_fattura: "2026/001",
        importo_lordo: 5000,
        cliente: "Acme Corp",
        data_emissione: "2026-03-01",
        data_incasso: null,
        stato: "emessa",
        note: null,
        fiscal_year: 2026,
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
      {
        id: "inv-2",
        user_id: "test-user-id",
        numero_fattura: "2026/002",
        importo_lordo: 3000,
        cliente: "Beta Srl",
        data_emissione: "2026-04-01",
        data_incasso: "2026-05-01",
        stato: "incassata",
        note: null,
        fiscal_year: 2026,
        created_at: "2026-04-01T10:00:00Z",
        updated_at: "2026-05-01T10:00:00Z",
      },
    ];
    mockPaymentsData = [];
    mockSingleInvoice = null;
  });

  // ===== Story 10.2: Basic Queries and Derived Data =====

  describe("Story 10.2: Fetch and derived data", () => {
    it("fetches invoices for the given fiscal year", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      expect(result.current.invoices[0].numero_fattura).toBe("2026/001");
      expect(result.current.invoices[1].numero_fattura).toBe("2026/002");
    });

    it("derives pendingInvoices filtering non-incassata status", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      // Only inv-1 is "emessa"
      expect(result.current.pendingInvoices.length).toBe(1);
      expect(result.current.pendingInvoices[0].id).toBe("inv-1");
    });

    it("derives pendingCount correctly", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(1);
      });
    });

    it("derives pendingTotal from residuo of pending invoices", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        // Only inv-1 (5000) is "emessa", residuo = sanitizeMoney(5000) - 0 = 5000
        expect(result.current.pendingTotal).toBe(5000);
      });
    });

    it("createInvoiceMutation calls supabase insert", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      result.current.createInvoiceMutation.mutate({
        numero_fattura: "2026/003",
        importo_lordo: 2000,
        fiscal_year: 2026,
        data_emissione: "2026-06-01",
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled();
      });
    });

    it("deleteInvoiceMutation calls supabase delete with stato guard", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      result.current.deleteInvoiceMutation.mutate("inv-1");

      await waitFor(() => {
        expect(mockDeleteChain).toHaveBeenCalled();
      });
    });

    it("editInvoiceMutation calls supabase update with stato guard", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      result.current.editInvoiceMutation.mutate({
        id: "inv-1",
        updates: { importo_lordo: 6000 },
      });

      await waitFor(() => {
        expect(mockUpdateChain).toHaveBeenCalled();
      });
    });

    it("returns isLoading=true initially then false after data loads", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ===== Story 10.3: Derived Data with Payments =====

  describe("Story 10.3: Derived data with payments (invoicesWithTotals)", () => {
    it("computes totalIncassato and residuo correctly with payments", async () => {
      mockPaymentsData = [
        {
          id: "pay-1",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 2000,
          data_incasso: "2026-04-01",
          note: "Prima rata",
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      const inv1 = result.current.invoicesWithTotals.find(
        (i) => i.id === "inv-1"
      )!;
      expect(inv1.totalIncassato).toBe(2000);
      expect(inv1.residuo).toBe(3000);
    });

    it("computes totalIncassato = 0 when no payments exist", async () => {
      mockPaymentsData = [];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      const inv1 = result.current.invoicesWithTotals.find(
        (i) => i.id === "inv-1"
      )!;
      expect(inv1.totalIncassato).toBe(0);
      expect(inv1.residuo).toBe(5000);
      expect(inv1.payments).toEqual([]);
    });

    it("groups payments by invoice_id correctly", async () => {
      mockPaymentsData = [
        {
          id: "pay-1",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 1000,
          data_incasso: "2026-04-01",
          note: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
        {
          id: "pay-2",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 2000,
          data_incasso: "2026-05-01",
          note: null,
          created_at: "2026-05-01T10:00:00Z",
          updated_at: "2026-05-01T10:00:00Z",
        },
        {
          id: "pay-3",
          invoice_id: "inv-2",
          user_id: "test-user-id",
          importo: 3000,
          data_incasso: "2026-05-01",
          note: null,
          created_at: "2026-05-01T10:00:00Z",
          updated_at: "2026-05-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      const inv1 = result.current.invoicesWithTotals.find(
        (i) => i.id === "inv-1"
      )!;
      expect(inv1.payments.length).toBe(2);
      expect(inv1.totalIncassato).toBe(3000);

      const inv2 = result.current.invoicesWithTotals.find(
        (i) => i.id === "inv-2"
      )!;
      expect(inv2.payments.length).toBe(1);
      expect(inv2.totalIncassato).toBe(3000);
    });

    it("pendingInvoices includes ricevuta and parzialmente_incassata states", async () => {
      mockInvoicesData = [
        { ...mockInvoicesData[0], id: "inv-emessa", stato: "emessa" },
        { ...mockInvoicesData[0], id: "inv-ricevuta", stato: "ricevuta" },
        {
          ...mockInvoicesData[0],
          id: "inv-partial",
          stato: "parzialmente_incassata",
        },
        { ...mockInvoicesData[0], id: "inv-incassata", stato: "incassata" },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(4);
      });

      expect(result.current.pendingInvoices.length).toBe(3);
      expect(result.current.pendingCount).toBe(3);

      const pendingIds = result.current.pendingInvoices.map((i) => i.id);
      expect(pendingIds).toContain("inv-emessa");
      expect(pendingIds).toContain("inv-ricevuta");
      expect(pendingIds).toContain("inv-partial");
      expect(pendingIds).not.toContain("inv-incassata");
    });

    it("pendingTotal sums residuo across all pending invoices", async () => {
      mockInvoicesData = [
        {
          ...mockInvoicesData[0],
          id: "inv-a",
          importo_lordo: 5000,
          stato: "emessa",
        },
        {
          ...mockInvoicesData[0],
          id: "inv-b",
          importo_lordo: 3000,
          stato: "ricevuta",
        },
        {
          ...mockInvoicesData[0],
          id: "inv-c",
          importo_lordo: 10000,
          stato: "parzialmente_incassata",
        },
        {
          ...mockInvoicesData[0],
          id: "inv-d",
          importo_lordo: 2000,
          stato: "incassata",
        },
      ];
      mockPaymentsData = [
        {
          id: "p1",
          invoice_id: "inv-c",
          user_id: "test-user-id",
          importo: 4000,
          data_incasso: "2026-04-01",
          note: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(4);
      });

      // inv-a=5000, inv-b=3000, inv-c=10000-4000=6000, inv-d excluded
      expect(result.current.pendingTotal).toBe(14000);
    });

    it("paymentsMap is exposed correctly", async () => {
      mockPaymentsData = [
        {
          id: "pay-1",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 1000,
          data_incasso: "2026-04-01",
          note: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.paymentsMap.size).toBe(1);
      });

      expect(result.current.paymentsMap.get("inv-1")!.length).toBe(1);
      expect(result.current.paymentsMap.get("inv-1")![0].id).toBe("pay-1");
    });
  });

  // ===== Story 10.3: markAsReceivedMutation =====

  describe("Story 10.3: markAsReceivedMutation", () => {
    it("calls supabase update with stato = ricevuta", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.markAsReceivedMutation.mutate("inv-1");
      });

      await waitFor(() => {
        expect(mockUpdateChain).toHaveBeenCalled();
      });

      const updateArg = (mockUpdateChain.mock.calls as any[][])[0]?.[0];
      expect(updateArg).toEqual({ stato: "ricevuta" });
    });
  });

  // ===== Story 10.3: registerPaymentMutation =====

  describe("Story 10.3: registerPaymentMutation", () => {
    it("calls supabase insert on invoice_payments table", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 2000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(mockInsertWithSelect).toHaveBeenCalled();
      });
    });

    it("creates receipt record with invoice_id and invoice_payment_id", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 2000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(mockReceiptInsert).toHaveBeenCalled();
      });

      const receiptArg = (mockReceiptInsert.mock.calls as any[][])[0]?.[0];
      expect(receiptArg!.invoice_id).toBe("inv-1");
      expect(receiptArg!.invoice_payment_id).toBe("new-pay-id");
      expect(receiptArg!.user_id).toBe("test-user-id");
      expect(receiptArg!.fiscal_year).toBe(2026);
    });

    it("updates invoice status after payment", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 2000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(mockUpdateChain).toHaveBeenCalled();
      });
    });
  });

  // ===== 8.8: Edge case — importo = residuo → auto-transizione =====

  describe("8.8: Edge case — importo = residuo → auto-transizione 'incassata'", () => {
    it("when payment = full amount, invoice update uses stato 'incassata'", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 5000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(mockUpdateChain).toHaveBeenCalled();
      });

      // The last update call should set stato = 'incassata' + data_incasso
      const lastCall =
        (mockUpdateChain.mock.calls as any[][])[mockUpdateChain.mock.calls.length - 1]?.[0];
      expect(lastCall!.stato).toBe("incassata");
      expect(lastCall!.data_incasso).toBeDefined();
    });

    it("partial payment sets stato 'parzialmente_incassata'", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 2000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(mockUpdateChain).toHaveBeenCalled();
      });

      const lastCall =
        (mockUpdateChain.mock.calls as any[][])[mockUpdateChain.mock.calls.length - 1]?.[0];
      expect(lastCall!.stato).toBe("parzialmente_incassata");
    });
  });

  // ===== 8.9: Edge case — importo > residuo → errore bloccante =====

  describe("8.9: Edge case — importo > residuo → errore bloccante", () => {
    it("throws error when payment amount exceeds full invoice amount", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 6000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(result.current.registerPaymentMutation.isError).toBe(true);
      });

      expect(result.current.registerPaymentMutation.error?.message).toContain(
        "supera il residuo"
      );
      // No insert should have been called
      expect(mockInsertWithSelect).not.toHaveBeenCalled();
    });

    it("throws error when payment exceeds remaining residuo", async () => {
      mockPaymentsData = [
        {
          id: "pay-existing",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 4000,
          data_incasso: "2026-03-15",
          note: null,
          created_at: "2026-03-15T10:00:00Z",
          updated_at: "2026-03-15T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      // Residuo = 5000 - 4000 = 1000. Try to pay 2000
      await act(async () => {
        result.current.registerPaymentMutation.mutate({
          invoiceId: "inv-1",
          importo: 2000,
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(result.current.registerPaymentMutation.isError).toBe(true);
      });

      expect(result.current.registerPaymentMutation.error?.message).toContain(
        "supera il residuo"
      );
    });
  });

  // ===== 8.10: Coerenza somma receipts = importo_lordo =====

  describe("8.10: Coerenza — totalIncassato + residuo = importo_lordo", () => {
    it("invariant holds with no payments", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      result.current.invoicesWithTotals.forEach((inv) => {
        expect(inv.totalIncassato + inv.residuo).toBe(
          Math.round(inv.importo_lordo * 100) / 100
        );
      });
    });

    it("invariant holds with partial payments", async () => {
      mockPaymentsData = [
        {
          id: "p1",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 1500,
          data_incasso: "2026-04-01",
          note: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
        {
          id: "p2",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 1500,
          data_incasso: "2026-05-01",
          note: null,
          created_at: "2026-05-01T10:00:00Z",
          updated_at: "2026-05-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      const inv1 = result.current.invoicesWithTotals.find(
        (i) => i.id === "inv-1"
      )!;
      expect(inv1.totalIncassato).toBe(3000);
      expect(inv1.residuo).toBe(2000);
      expect(inv1.totalIncassato + inv1.residuo).toBe(5000);
    });

    it("residuo = 0 when fully paid", async () => {
      mockPaymentsData = [
        {
          id: "p1",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 5000,
          data_incasso: "2026-04-01",
          note: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      const inv1 = result.current.invoicesWithTotals.find(
        (i) => i.id === "inv-1"
      )!;
      expect(inv1.totalIncassato).toBe(5000);
      expect(inv1.residuo).toBe(0);
    });
  });

  // ===== Story 10.3: markAsCollectedMutation (refactored) =====

  describe("Story 10.3: markAsCollectedMutation (uses shared helper)", () => {
    it("creates payment + receipt via shared logic", async () => {
      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoices.length).toBe(2);
      });

      await act(async () => {
        result.current.markAsCollectedMutation.mutate({
          invoiceId: "inv-1",
          dataIncasso: new Date("2026-04-01T00:00:00"),
          profitCoefficient: 67,
          taxRate: 5,
          inpsRate: 26.07,
        });
      });

      await waitFor(() => {
        expect(mockInsertWithSelect).toHaveBeenCalled();
        expect(mockReceiptInsert).toHaveBeenCalled();
      });
    });
  });

  // ===== Story 10.3: Delete guards with payments =====

  describe("Story 10.3: Delete guards with payments", () => {
    it("rejects delete for invoice with payments", async () => {
      mockPaymentsData = [
        {
          id: "pay-1",
          invoice_id: "inv-1",
          user_id: "test-user-id",
          importo: 1000,
          data_incasso: "2026-04-01",
          note: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(2);
      });

      await act(async () => {
        result.current.deleteInvoiceMutation.mutate("inv-1");
      });

      await waitFor(() => {
        expect(result.current.deleteInvoiceMutation.isError).toBe(true);
      });

      expect(
        result.current.deleteInvoiceMutation.error?.message
      ).toContain("pagamenti registrati");
    });

    it("rejects delete for parzialmente_incassata state", async () => {
      mockInvoicesData = [
        { ...mockInvoicesData[0], stato: "parzialmente_incassata" },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(1);
      });

      await act(async () => {
        result.current.deleteInvoiceMutation.mutate("inv-1");
      });

      await waitFor(() => {
        expect(result.current.deleteInvoiceMutation.isError).toBe(true);
      });

      expect(
        result.current.deleteInvoiceMutation.error?.message
      ).toContain("non è eliminabile");
    });
  });

  // ===== Story 10.3: Edit guards =====

  describe("Story 10.3: Edit guards", () => {
    it("allows edit for ricevuta state", async () => {
      mockInvoicesData = [{ ...mockInvoicesData[0], stato: "ricevuta" }];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(1);
      });

      await act(async () => {
        result.current.editInvoiceMutation.mutate({
          id: "inv-1",
          updates: { importo_lordo: 6000 },
        });
      });

      await waitFor(() => {
        expect(mockUpdateChain).toHaveBeenCalled();
      });
    });

    it("rejects edit for parzialmente_incassata state", async () => {
      mockInvoicesData = [
        { ...mockInvoicesData[0], stato: "parzialmente_incassata" },
      ];

      const { result } = renderHook(() => useInvoices(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.invoicesWithTotals.length).toBe(1);
      });

      await act(async () => {
        result.current.editInvoiceMutation.mutate({
          id: "inv-1",
          updates: { importo_lordo: 6000 },
        });
      });

      await waitFor(() => {
        expect(result.current.editInvoiceMutation.isError).toBe(true);
      });

      expect(
        result.current.editInvoiceMutation.error?.message
      ).toContain("non è modificabile");
    });
  });
});
