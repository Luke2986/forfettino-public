import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { useWaitlistCount, formatWaitlistCount } from "./useWaitlistCount";

const mockRpc = vi.mocked(supabase.rpc);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("formatWaitlistCount", () => {
  it("returns null for count < 10", () => {
    expect(formatWaitlistCount(0)).toBeNull();
    expect(formatWaitlistCount(7)).toBeNull();
    expect(formatWaitlistCount(9)).toBeNull();
  });

  it("rounds down to multiple of 10 for count 10-99", () => {
    expect(formatWaitlistCount(10)).toBe("10+");
    expect(formatWaitlistCount(17)).toBe("10+");
    expect(formatWaitlistCount(25)).toBe("20+");
    expect(formatWaitlistCount(39)).toBe("30+");
    expect(formatWaitlistCount(50)).toBe("50+");
    expect(formatWaitlistCount(89)).toBe("80+");
    expect(formatWaitlistCount(99)).toBe("90+");
  });

  it("rounds down to multiple of 25 for count >= 100", () => {
    expect(formatWaitlistCount(100)).toBe("100+");
    expect(formatWaitlistCount(124)).toBe("100+");
    expect(formatWaitlistCount(125)).toBe("125+");
    expect(formatWaitlistCount(149)).toBe("125+");
    expect(formatWaitlistCount(150)).toBe("150+");
  });
});

describe("useWaitlistCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns count from RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: 42, error: null } as any);

    const { result } = renderHook(() => useWaitlistCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.count).toBe(42);
    });

    expect(mockRpc).toHaveBeenCalledWith("get_waitlist_active_count");
  });

  it("returns null while loading", () => {
    mockRpc.mockReturnValueOnce(new Promise(() => {}) as any);

    const { result } = renderHook(() => useWaitlistCount(), {
      wrapper: createWrapper(),
    });

    expect(result.current.count).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});
