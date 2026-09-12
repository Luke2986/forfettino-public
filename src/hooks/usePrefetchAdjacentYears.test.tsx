/**
 * Test per usePrefetchAdjacentYears hook
 * Story 23.1 — Prefetching Anni Adiacenti e Logica Anni Pro/Free
 *
 * Copertura:
 * - Prefetcha anni adiacenti al selectedYear
 * - Non prefetcha anni fuori da availableYears
 * - Non prefetcha se !user
 * - Non prefetcha l'anno selectedYear stesso
 * - Query keys matchano quelle di useFiscalCalculations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock dependencies
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
            order: vi.fn(() =>
              Promise.resolve({ data: [], error: null })
            ),
          })),
          single: vi.fn(() =>
            Promise.resolve({ data: null, error: null })
          ),
        })),
        single: vi.fn(() =>
          Promise.resolve({ data: null, error: null })
        ),
      })),
    })),
  },
}));

import { useAuth } from "./useAuth";
import { usePrefetchAdjacentYears } from "./usePrefetchAdjacentYears";

const mockUseAuth = vi.mocked(useAuth);

const CURRENT_YEAR = new Date().getFullYear();

function createTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePrefetchAdjacentYears", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-123" } as ReturnType<typeof useAuth>["user"],
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithGoogle: vi.fn(),
      sendOtp: vi.fn(),
      verifyOtp: vi.fn(),
    });
  });

  it("prefetcha anni adiacenti al selectedYear", () => {
    const queryClient = createTestClient();
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery");

    renderHook(
      () =>
        usePrefetchAdjacentYears(CURRENT_YEAR, [
          CURRENT_YEAR - 1,
          CURRENT_YEAR,
          CURRENT_YEAR + 1,
        ]),
      { wrapper: createWrapper(queryClient) }
    );

    // Deve prefetchare per anno-1 e anno+1, 4 query ciascuno = 8 totali
    expect(prefetchSpy).toHaveBeenCalledTimes(8);

    // Verifica che le query keys contengano gli anni giusti
    const calledKeys = prefetchSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey
    );

    // Deve avere query per anno-1
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["fiscal_year_settings", "user-123", CURRENT_YEAR - 1])
    );
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["receipts_ytd", "user-123", CURRENT_YEAR - 1])
    );
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["fiscalRules", CURRENT_YEAR - 1])
    );
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["current_year_schedules", "user-123", CURRENT_YEAR - 1])
    );

    // Deve avere query per anno+1
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["fiscal_year_settings", "user-123", CURRENT_YEAR + 1])
    );
  });

  it("non prefetcha anni fuori da availableYears", () => {
    const queryClient = createTestClient();
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery");

    // Solo anno corrente disponibile — nessun anno adiacente da prefetchare
    renderHook(
      () => usePrefetchAdjacentYears(CURRENT_YEAR, [CURRENT_YEAR]),
      { wrapper: createWrapper(queryClient) }
    );

    expect(prefetchSpy).not.toHaveBeenCalled();
  });

  it("non prefetcha se user è null", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithGoogle: vi.fn(),
      sendOtp: vi.fn(),
      verifyOtp: vi.fn(),
    });

    const queryClient = createTestClient();
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery");

    renderHook(
      () =>
        usePrefetchAdjacentYears(CURRENT_YEAR, [
          CURRENT_YEAR - 1,
          CURRENT_YEAR,
          CURRENT_YEAR + 1,
        ]),
      { wrapper: createWrapper(queryClient) }
    );

    expect(prefetchSpy).not.toHaveBeenCalled();
  });

  it("non prefetcha l'anno selectedYear stesso", () => {
    const queryClient = createTestClient();
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery");

    renderHook(
      () =>
        usePrefetchAdjacentYears(CURRENT_YEAR, [
          CURRENT_YEAR - 1,
          CURRENT_YEAR,
          CURRENT_YEAR + 1,
        ]),
      { wrapper: createWrapper(queryClient) }
    );

    const calledKeys = prefetchSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey
    );

    // Nessuna query deve contenere l'anno corrente
    const keysWithCurrentYear = calledKeys.filter((key) =>
      key.includes(CURRENT_YEAR)
    );
    expect(keysWithCurrentYear).toHaveLength(0);
  });

  it("non prefetcha se availableYears è vuoto", () => {
    const queryClient = createTestClient();
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery");

    renderHook(() => usePrefetchAdjacentYears(CURRENT_YEAR, []), {
      wrapper: createWrapper(queryClient),
    });

    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
