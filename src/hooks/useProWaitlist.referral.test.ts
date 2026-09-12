import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockInsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: (data: any) => mockInsert(data),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com" },
    loading: false,
  }),
}));

import { useProWaitlist } from "./useProWaitlist";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useProWaitlist — referral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("join passes referred_by_token when provided", async () => {
    const { result } = renderHook(() => useProWaitlist(), { wrapper });

    result.current.join.mutate("my_referral_token");

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          referred_by_token: "my_referral_token",
        })
      );
    });
  });

  it("join omits referred_by_token when not provided", async () => {
    const { result } = renderHook(() => useProWaitlist(), { wrapper });

    result.current.join.mutate(undefined);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.not.objectContaining({
          referred_by_token: expect.anything(),
        })
      );
    });
  });
});
