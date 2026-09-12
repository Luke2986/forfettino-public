/**
 * Test per useSubscription — logica admin_override_tier (Story 56-1)
 *
 * Copertura AC:
 * - AC#2: override 'pro' → isPro=true, canAddReceipt=true, canExport=true, canSelectYear=true, receiptsLimit=Infinity
 * - AC#3: override 'beta_tester' → stesse permission di isPro=true
 * - AC#4: override NULL + Stripe PRO → tier da Stripe (invariato)
 * - AC#7: override 'pro' + Stripe PRO → isPro=true (ridondante ma non dannoso)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ===== Mutable profile mock =====
let mockProfileData: Record<string, unknown> = {};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-override" } }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: mockProfileData }),
}));

// Mutable Stripe response
let mockStripeResponse = {
  subscribed: false,
  tier: "free",
  billing_interval: null,
  subscription_end: null,
};

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
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "receipts") {
        return {
          select: (_cols: string, _opts?: unknown) => ({
            eq: (_col: string, _val: unknown) => ({
              eq: (_col2: string, _val2: unknown) => ({
                eq: () => Promise.resolve({ count: 0, error: null }),
                then: (resolve: (v: unknown) => void) =>
                  resolve({ count: 0, error: null }),
                [Symbol.toStringTag]: "Promise",
              }),
            }),
          }),
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
          data: mockStripeResponse,
          error: null,
        }),
    },
  },
}));

import { SubscriptionProvider, useSubscription } from "./useSubscription";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>{children}</SubscriptionProvider>
      </QueryClientProvider>
    );
  };
}

describe("useSubscription — admin_override_tier (Story 56-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileData = { first_name: "Test", admin_override_tier: null };
    mockStripeResponse = {
      subscribed: false,
      tier: "free",
      billing_interval: null,
      subscription_end: null,
    };
  });

  it("AC#2: override 'pro' senza Stripe → isPro=true, tutte le permission PRO", async () => {
    mockProfileData = { first_name: "Test", admin_override_tier: "pro" };

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
      expect(result.current.tier).toBe("pro");
      expect(result.current.canAddReceipt).toBe(true);
      expect(result.current.canExport).toBe(true);
      expect(result.current.canSelectYear).toBe(true);
      expect(result.current.canImport).toBe(true);
      expect(result.current.receiptsLimit).toBe(Infinity);
    });
  });

  it("AC#3: override 'beta_tester' → stesse permission di isPro=true", async () => {
    mockProfileData = { first_name: "Test", admin_override_tier: "beta_tester" };

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
      expect(result.current.tier).toBe("pro");
      expect(result.current.canAddReceipt).toBe(true);
      expect(result.current.canExport).toBe(true);
      expect(result.current.canSelectYear).toBe(true);
      expect(result.current.canImport).toBe(true);
      expect(result.current.receiptsLimit).toBe(Infinity);
    });
  });

  it("AC#4: override NULL + Stripe PRO → tier da Stripe (comportamento invariato)", async () => {
    mockProfileData = { first_name: "Test", admin_override_tier: null };
    mockStripeResponse = {
      subscribed: true,
      tier: "pro",
      billing_interval: "month",
      subscription_end: null,
    };

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
      expect(result.current.tier).toBe("pro");
      expect(result.current.canExport).toBe(true);
    });
  });

  it("AC#4: override NULL + nessun Stripe → tier free (comportamento invariato)", async () => {
    mockProfileData = { first_name: "Test", admin_override_tier: null };

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(false);
      expect(result.current.tier).toBe("free");
      expect(result.current.canExport).toBe(false);
    });
  });

  it("AC#7: override 'pro' + Stripe PRO → isPro=true (ridondante ma non dannoso)", async () => {
    mockProfileData = { first_name: "Test", admin_override_tier: "pro" };
    mockStripeResponse = {
      subscribed: true,
      tier: "pro",
      billing_interval: "month",
      subscription_end: null,
    };

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
      expect(result.current.tier).toBe("pro");
      expect(result.current.canExport).toBe(true);
      expect(result.current.canAddReceipt).toBe(true);
    });
  });

  it("override NON tocca isStudio — isStudio resta false con override pro", async () => {
    mockProfileData = { first_name: "Test", admin_override_tier: "pro" };

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
      expect(result.current.isStudio).toBe(false);
    });
  });
});
