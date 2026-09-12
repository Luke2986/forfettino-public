/**
 * Test per useSubscription — tracking import count reale
 *
 * Copertura:
 * - importCount query conta receipts con source = 'xml_import' (non placeholder 0)
 * - canAddImport riflette il count reale vs FREE_IMPORT_LIMIT
 * - importsUsed riflette il count reale
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ===== Mocks =====

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { first_name: "Test", last_name: "User" } }),
}));

// Supabase mock con tracking delle chiamate
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInvoke = vi.fn();

let selectCallCount = 0;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "receipts") {
        selectCallCount++;
        // First call = receipt count (all receipts), second call = import count
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            mockSelect(table, _cols, opts);
            return {
              eq: (col: string, val: unknown) => {
                mockEq(col, val);
                return {
                  eq: (col2: string, val2: unknown) => {
                    mockEq(col2, val2);
                    // Check if this is the import count query (has 3 eq calls including source)
                    return {
                      eq: (col3: string, val3: unknown) => {
                        mockEq(col3, val3);
                        // This is the import count: user_id + fiscal_year + source
                        return Promise.resolve({ count: 3, error: null });
                      },
                      // This is the receipt count: user_id + fiscal_year only (no third eq)
                      then: (resolve: (v: unknown) => void) =>
                        resolve({ count: 7, error: null }),
                      [Symbol.toStringTag]: "Promise",
                    };
                  },
                };
              },
            };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
    functions: {
      invoke: () =>
        Promise.resolve({
          data: { subscribed: false, tier: "free", billing_interval: null, subscription_end: null },
          error: null,
        }),
    },
  },
}));

// Import DOPO i mock
import { SubscriptionProvider, useSubscription } from "./useSubscription";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>{children}</SubscriptionProvider>
    </QueryClientProvider>
  );
}

describe("useSubscription — import count tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
  });

  it("la query importCount filtra per source = 'xml_import' (non è più placeholder)", async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      // Il mock che filtra per source='xml_import' restituisce 3
      // Se il count fosse ancora placeholder (0), il test fallirebbe
      expect(result.current.importsUsed).toBe(3);
    });
  });

  it("canAddImport riflette il count reale vs limite", async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      // Free limit = 3, imports used = 3 → cannot add more
      expect(result.current.canAddImport).toBe(false);
      expect(result.current.importsLimit).toBe(3);
    });
  });
});
