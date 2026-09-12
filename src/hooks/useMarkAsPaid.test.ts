import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { derivePaymentType } from "./useMarkAsPaid";

// Mock delle dipendenze impure; classifyDelta / discrepancy / money restano reali.
const { mockRpc, mockTrack } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/lib/analytics", () => ({
  track: mockTrack,
  trackAnonymous: vi.fn(),
  ANALYTICS_EVENTS: { SCADENZA_PAGATA: "scadenza_pagata" },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mockRpc },
}));

import { useMarkAsPaid } from "./useMarkAsPaid";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    user_id: "user-1",
    bucket: "june",
    due_date: "2026-07-20",
    payment_year: 2026,
    reference_year: 2025,
    status: "open",
    total_expected: 1500,
    total_paid: 0,
    tax_balance: 500,
    tax_advance: 300,
    inps_balance: 400,
    inps_advance: 300,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("derivePaymentType", () => {
  it("bucket inps_q1 → 'inps'", () => {
    expect(derivePaymentType("inps_q1")).toBe("inps");
  });

  it("bucket inps_q2 → 'inps'", () => {
    expect(derivePaymentType("inps_q2")).toBe("inps");
  });

  it("bucket inps_q3 → 'inps'", () => {
    expect(derivePaymentType("inps_q3")).toBe("inps");
  });

  it("bucket inps_q4 → 'inps'", () => {
    expect(derivePaymentType("inps_q4")).toBe("inps");
  });

  it("bucket june → 'mixed' (componenti miste)", () => {
    expect(derivePaymentType("june")).toBe("mixed");
  });

  it("bucket november → 'mixed' (componenti miste)", () => {
    expect(derivePaymentType("november")).toBe("mixed");
  });

  it("bucket sconosciuto → 'mixed' (default sicuro)", () => {
    expect(derivePaymentType("unknown_bucket")).toBe("mixed");
  });
});

describe("useMarkAsPaid — finestra di versamento + maggiorazione", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockTrack.mockReset();
    mockRpc.mockResolvedValue({ data: "disc-1", error: null });
  });

  it("inoltra p_payment_window + p_surcharge_cents alla RPC; la stima resta la base", async () => {
    const { result } = renderHook(() => useMarkAsPaid(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({
        schedule: makeSchedule() as never,
        paymentDate: "2026-08-20",
        amountPaidCents: 151200, // 1500 € + 0,80%
        paymentWindow: "differimento",
        surchargeCents: 1200,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith(
      "mark_tax_schedule_paid",
      expect.objectContaining({
        p_payment_window: "differimento",
        p_surcharge_cents: 1200,
        p_amount_estimated_cents: 150000, // base pura, NON 151200
        p_amount_paid_cents: 151200,
        // Pagato = atteso della finestra (stima + maggiorazione) → banda verde.
        p_tolerance_band: "green",
      }),
    );
  });

  it("chiamata legacy senza finestra → p_payment_window null, p_surcharge_cents 0", async () => {
    const { result } = renderHook(() => useMarkAsPaid(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({
        schedule: makeSchedule() as never,
        paymentDate: "2026-06-30",
        amountPaidCents: 150000,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith(
      "mark_tax_schedule_paid",
      expect.objectContaining({ p_payment_window: null, p_surcharge_cents: 0 }),
    );
  });

  it("arricchisce l'evento PostHog mark_as_paid_confirmed con payment_window + surcharge_cents", async () => {
    const { result } = renderHook(() => useMarkAsPaid(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({
        schedule: makeSchedule() as never,
        paymentDate: "2026-08-20",
        amountPaidCents: 151200,
        paymentWindow: "differimento",
        surchargeCents: 1200,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const confirmed = mockTrack.mock.calls.find(
      ([event]) => event === "mark_as_paid_confirmed",
    );
    expect(confirmed?.[1]).toEqual(
      expect.objectContaining({
        payment_window: "differimento",
        surcharge_cents: 1200,
      }),
    );
  });
});
