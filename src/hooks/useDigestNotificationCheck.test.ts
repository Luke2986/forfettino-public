/**
 * useDigestNotificationCheck.test.ts
 *
 * Story 9.5 — Tests for the on-login digest notification check hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ──

const mockInvoke = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { useDigestNotificationCheck, STORAGE_KEY, DEBOUNCE_MS } from "./useDigestNotificationCheck";

const mockUseAuth = vi.mocked(useAuth);

// ── Test wrapper ──

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.invalidateQueries = mockInvalidateQueries;

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// ── Tests ──

describe("useDigestNotificationCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default: authenticated user
    mockUseAuth.mockReturnValue({
      user: { id: "user-abc" } as any,
      session: null,
      loading: false,
      signIn: vi.fn() as any,
      signUp: vi.fn() as any,
      signOut: vi.fn() as any,
      signInWithGoogle: vi.fn() as any,
      sendOtp: vi.fn() as any,
      verifyOtp: vi.fn() as any,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("invokes Edge Function on first render when no previous check", async () => {
    mockInvoke.mockResolvedValue({ data: { generated: 1 }, error: null });

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-digest-notifications",
      { body: { user_id: "user-abc" } },
    );
  });

  it("sets localStorage timestamp after successful invoke", async () => {
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });
    const beforeCall = Date.now();

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    const stored = Number(localStorage.getItem(STORAGE_KEY));
    expect(stored).toBeGreaterThanOrEqual(beforeCall);
    expect(stored).toBeLessThanOrEqual(Date.now());
  });

  it("skips invoke if checked within 24 hours", async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 1000)); // 1 second ago

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invokes if last check was more than 24 hours ago", async () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(oldTimestamp));
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });
  });

  it("does not invoke if user is null", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn() as any,
      signUp: vi.fn() as any,
      signOut: vi.fn() as any,
      signInWithGoogle: vi.fn() as any,
      sendOtp: vi.fn() as any,
      verifyOtp: vi.fn() as any,
    });

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invalidates notification queries on success", async () => {
    mockInvoke.mockResolvedValue({ data: { generated: 2 }, error: null });

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications", "count", "user-abc"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications", "user-abc"],
    });
  });

  it("does not set localStorage on Edge Function error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("Edge function failed") });

    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("handles invoke rejection silently", async () => {
    mockInvoke.mockRejectedValue(new Error("Network error"));

    // Should not throw
    renderHook(() => useDigestNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("exports correct STORAGE_KEY constant", () => {
    expect(STORAGE_KEY).toBe("forfettino:last-digest-check");
  });

  it("exports correct DEBOUNCE_MS constant (24 hours)", () => {
    expect(DEBOUNCE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
