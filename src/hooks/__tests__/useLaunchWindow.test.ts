import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- Supabase mock ----

const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { useLaunchWindow, type LaunchWindowRow } from "../useLaunchWindow";

// ---- Helpers ----

function makeWindow(overrides: Partial<LaunchWindowRow> = {}): LaunchWindowRow {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  return {
    id: "win-1",
    name: "Lancio PRO",
    starts_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1h ago
    ends_at: dayAfterTomorrow.toISOString(),
    lifetime_ends_at: tomorrow.toISOString(),
    cap_total: 100,
    cap_remaining: 42,
    prices: { six_month: 4900, annual: 6900, lifetime: 16900 },
    is_active: true,
    created_at: now.toISOString(),
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ---- Tests ----

describe("useLaunchWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finestra aperta → isOpen=true, isLifetimeOpen=true (AC 4.1)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: makeWindow(), error: null });

    const { result } = renderHook(() => useLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isLifetimeOpen).toBe(true);
    expect(result.current.spotsRemaining).toBe(42);
    expect(result.current.daysRemaining).toBeGreaterThan(0);
    expect(result.current.lifetimeDaysRemaining).toBeGreaterThan(0);
    expect(result.current.window).not.toBeNull();
  });

  it("lifetime scaduto → isOpen=true, isLifetimeOpen=false (AC 4.2)", async () => {
    const pastLifetime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const futureEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    mockMaybeSingle.mockResolvedValue({
      data: makeWindow({ lifetime_ends_at: pastLifetime, ends_at: futureEnd }),
      error: null,
    });

    const { result } = renderHook(() => useLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isLifetimeOpen).toBe(false);
    expect(result.current.lifetimeDaysRemaining).toBe(0);
    expect(result.current.daysRemaining).toBeGreaterThan(0);
  });

  it("finestra chiusa (ends_at passato) → isOpen=false (AC 4.3)", async () => {
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const pastLifetime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    mockMaybeSingle.mockResolvedValue({
      data: makeWindow({
        ends_at: pastEnd,
        lifetime_ends_at: pastLifetime,
      }),
      error: null,
    });

    const { result } = renderHook(() => useLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLifetimeOpen).toBe(false);
    expect(result.current.daysRemaining).toBe(0);
    expect(result.current.lifetimeDaysRemaining).toBe(0);
  });

  it("cap esaurito → spotsRemaining=0 (AC 4.4)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: makeWindow({ cap_remaining: 0 }),
      error: null,
    });

    const { result } = renderHook(() => useLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.spotsRemaining).toBe(0);
    expect(result.current.isOpen).toBe(true);
  });

  it("nessuna finestra attiva → stato default (AC 4.5)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.window).toBeNull();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLifetimeOpen).toBe(false);
    expect(result.current.daysRemaining).toBe(0);
    expect(result.current.lifetimeDaysRemaining).toBe(0);
    expect(result.current.spotsRemaining).toBe(0);
  });
});
