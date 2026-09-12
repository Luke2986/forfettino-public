import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mocks
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "a@b.com" }, loading: false }),
}));

vi.mock("./useProWaitlist", () => ({
  useProWaitlist: () => ({ isJoined: true }),
}));

import { useWaitlistReferral } from "./useWaitlistReferral";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useWaitlistReferral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns referral info from RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        referral_token: "abc123def456",
        invites_count: 2,
        queue_position_boost: 0,
        next_boost_at: 3,
        next_boost_label: "Priority +1 slot",
      },
      error: null,
    });

    const { result } = renderHook(() => useWaitlistReferral(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.referralToken).toBe("abc123def456");
    expect(result.current.invitesCount).toBe(2);
    expect(result.current.boostLevel).toBe(0);
    expect(result.current.nextBoostAt).toBe(3);
    expect(result.current.nextBoostLabel).toBe("Priority +1 slot");
    expect(result.current.referralUrl).toContain("/pro-presto?wl=abc123def456");
  });

  it("returns null referralUrl when no token", async () => {
    mockRpc.mockResolvedValue({
      data: { referral_token: null },
      error: null,
    });

    const { result } = renderHook(() => useWaitlistReferral(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.referralToken).toBeNull();
    expect(result.current.referralUrl).toBeNull();
  });

  it("constructs referralUrl from origin + token", async () => {
    mockRpc.mockResolvedValue({
      data: {
        referral_token: "test1234abcd5678",
        invites_count: 0,
        queue_position_boost: 0,
        next_boost_at: 3,
        next_boost_label: "Priority +1 slot",
      },
      error: null,
    });

    const { result } = renderHook(() => useWaitlistReferral(), { wrapper });

    await waitFor(() => expect(result.current.referralUrl).not.toBeNull());

    expect(result.current.referralUrl).toBe(
      `${window.location.origin}/pro-presto?wl=test1234abcd5678`
    );
  });
});
