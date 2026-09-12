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
import { useNextLaunchWindow } from "./useNextLaunchWindow";

const mockRpc = vi.mocked(supabase.rpc);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useNextLaunchWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Date when RPC returns a timestamp", async () => {
    const ts = "2026-05-15T10:00:00+00:00";
    mockRpc.mockResolvedValueOnce({ data: ts, error: null } as any);

    const { result } = renderHook(() => useNextLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.startsAt).toBeInstanceOf(Date);
    });

    expect(result.current.startsAt!.toISOString()).toBe("2026-05-15T10:00:00.000Z");
  });

  it("returns null when RPC returns null (no active window)", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as any);

    const { result } = renderHook(() => useNextLaunchWindow(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.startsAt).toBeNull();
  });
});
