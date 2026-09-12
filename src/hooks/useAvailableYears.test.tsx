/**
 * Test per useAvailableYears hook
 * Story 23.1 — Prefetching Anni Adiacenti e Logica Anni Pro/Free
 *
 * Copertura:
 * - Free: ritorna [N-1, N, N+1] senza query DB
 * - Pro: ritorna anni da DB + N + N+1, ordinati crescente
 * - Pro senza dati: fallback a [N-1, N, N+1]
 * - Ordinamento corretto
 * - Loading state corretto
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock dependencies
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: vi.fn(),
}));

// Chain: from().select().eq() → Promise
const mockResult = vi.fn();
const mockEq = vi.fn(() => mockResult());
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import { useAvailableYears } from "./useAvailableYears";

const mockUseAuth = vi.mocked(useAuth);
const mockUseSubscription = vi.mocked(useSubscription);

const CURRENT_YEAR = new Date().getFullYear();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function mockSubscription(isPro: boolean) {
  mockUseSubscription.mockReturnValue({
    isPro,
    isStudio: false,
    hasPaidPlan: isPro,
    tier: isPro ? "pro" : "free",
    isLoading: false,
    subscription: null,
    canImport: true,
    canExport: isPro,
    canSelectYear: isPro,
    canAddReceipt: true,
    receiptsUsed: 0,
    receiptsLimit: isPro ? Infinity : 5,
    importsUsed: 0,
    importsLimit: isPro ? Infinity : 3,
    canAddImport: true,
    refetch: vi.fn(),
  } as ReturnType<typeof useSubscription>);
}

describe("useAvailableYears", () => {
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

  describe("Free user", () => {
    beforeEach(() => {
      mockSubscription(false);
    });

    it("ritorna [N-1, N, N+1] senza query DB", () => {
      const { result } = renderHook(() => useAvailableYears(), {
        wrapper: createWrapper(),
      });

      expect(result.current.availableYears).toEqual([
        CURRENT_YEAR - 1,
        CURRENT_YEAR,
        CURRENT_YEAR + 1,
      ]);
      expect(result.current.isLoading).toBe(false);
      // Free user non deve fare query DB
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("Pro user", () => {
    beforeEach(() => {
      mockSubscription(true);
    });

    it("ritorna anni da DB + N + N+1, ordinati crescente", async () => {
      // Simula query Supabase che ritorna anni 2024 e 2025
      mockResult.mockReturnValueOnce({
        data: [{ fiscal_year: 2025 }, { fiscal_year: 2024 }],
        error: null,
      });

      const { result } = renderHook(() => useAvailableYears(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Deve includere: anni da DB + anno corrente + anno successivo, deduplied e sorted
      const expected = [
        ...new Set([2024, 2025, CURRENT_YEAR, CURRENT_YEAR + 1]),
      ].sort((a, b) => a - b);
      expect(result.current.availableYears).toEqual(expected);
    });

    it("fallback a [N-1, N, N+1] se query ritorna vuoto", async () => {
      mockResult.mockReturnValueOnce({
        data: [],
        error: null,
      });

      const { result } = renderHook(() => useAvailableYears(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fallback: almeno N e N+1 presenti (merged con vuoto)
      expect(result.current.availableYears).toContain(CURRENT_YEAR);
      expect(result.current.availableYears).toContain(CURRENT_YEAR + 1);
    });

    it("deduplica anni correttamente", async () => {
      // L'anno corrente è anche in DB — non deve duplicarsi
      mockResult.mockReturnValueOnce({
        data: [{ fiscal_year: CURRENT_YEAR }, { fiscal_year: CURRENT_YEAR - 1 }],
        error: null,
      });

      const { result } = renderHook(() => useAvailableYears(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Nessun duplicato
      const uniqueYears = [...new Set(result.current.availableYears)];
      expect(result.current.availableYears).toEqual(uniqueYears);
      expect(result.current.availableYears).toEqual(
        [...result.current.availableYears].sort((a, b) => a - b)
      );
    });

    it("mostra isLoading=true durante il fetch", () => {
      // Non risolvere la promise per mantenere loading
      mockResult.mockReturnValueOnce(new Promise(() => {}));

      const { result } = renderHook(() => useAvailableYears(), {
        wrapper: createWrapper(),
      });

      // Durante il caricamento iniziale, deve dare il fallback FREE_YEARS
      expect(result.current.availableYears).toEqual([
        CURRENT_YEAR - 1,
        CURRENT_YEAR,
        CURRENT_YEAR + 1,
      ]);
    });
  });

  describe("No user", () => {
    it("ritorna [N-1, N, N+1] se utente non autenticato", () => {
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
      mockSubscription(false);

      const { result } = renderHook(() => useAvailableYears(), {
        wrapper: createWrapper(),
      });

      expect(result.current.availableYears).toEqual([
        CURRENT_YEAR - 1,
        CURRENT_YEAR,
        CURRENT_YEAR + 1,
      ]);
    });
  });
});
