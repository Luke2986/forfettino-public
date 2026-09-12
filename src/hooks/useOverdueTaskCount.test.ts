/**
 * Test per useOverdueTaskCount hook
 * Story 61.3 — Badge sidebar task scaduti
 *
 * Copertura: hook shape, count con dati, count zero, disabled per non-admin
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ===== Mocks =====

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

let mockCount = 0;
let mockError: Error | null = null;

const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    neq: vi.fn(() => ({
      lte: vi.fn(() =>
        Promise.resolve({
          count: mockCount,
          error: mockError,
        })
      ),
    })),
  })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useOverdueTaskCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount = 0;
    mockError = null;
  });

  it("returns { overdueCount, isLoading } shape", async () => {
    const { useOverdueTaskCount } = await import("./useOverdueTaskCount");
    const { result } = renderHook(() => useOverdueTaskCount(true), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty("overdueCount");
    expect(result.current).toHaveProperty("isLoading");
    expect(typeof result.current.overdueCount).toBe("number");
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("returns overdueCount from Supabase count query", async () => {
    mockCount = 3;
    const { useOverdueTaskCount } = await import("./useOverdueTaskCount");
    const { result } = renderHook(() => useOverdueTaskCount(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overdueCount).toBe(3);
  });

  it("returns 0 when no overdue tasks", async () => {
    mockCount = 0;
    const { useOverdueTaskCount } = await import("./useOverdueTaskCount");
    const { result } = renderHook(() => useOverdueTaskCount(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overdueCount).toBe(0);
  });

  it("does not query when isAdmin is false", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { useOverdueTaskCount } = await import("./useOverdueTaskCount");
    const fromSpy = vi.mocked(supabase.from);
    fromSpy.mockClear();

    const { result } = renderHook(() => useOverdueTaskCount(false), {
      wrapper: createWrapper(),
    });

    // Should remain at default 0, not loading (query disabled)
    expect(result.current.overdueCount).toBe(0);
    // Supabase should NOT have been called
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
