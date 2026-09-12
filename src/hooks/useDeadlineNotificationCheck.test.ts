/**
 * useDeadlineNotificationCheck.test.ts
 *
 * Story 9.3 — Tests for the on-login deadline notification check hook.
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
import { useDeadlineNotificationCheck } from "./useDeadlineNotificationCheck";

const mockUseAuth = vi.mocked(useAuth);

const STORAGE_KEY = "forfettino:last-notification-check";

// ── Test wrapper ──

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Spy on invalidateQueries
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

describe("useDeadlineNotificationCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default: authenticated user
    mockUseAuth.mockReturnValue({
      user: { id: "user-123" } as any,
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

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Wait for async effect
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-deadline-notifications",
      { body: { user_id: "user-123" } },
    );
  });

  it("sets localStorage timestamp after successful invoke", async () => {
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });
    const beforeCall = Date.now();

    renderHook(() => useDeadlineNotificationCheck(), {
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
    // Set recent check timestamp
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 1000)); // 1 second ago

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Give async a chance to run
    await new Promise((r) => setTimeout(r, 50));

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invokes if last check was more than 24 hours ago", async () => {
    // Set old check timestamp (25 hours ago)
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(oldTimestamp));
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });

    renderHook(() => useDeadlineNotificationCheck(), {
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

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invalidates notification queries on success", async () => {
    mockInvoke.mockResolvedValue({ data: { generated: 2 }, error: null });

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications", "count", "user-123"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications", "user-123"],
    });
  });

  it("does not set localStorage on Edge Function error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("Edge function failed") });

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Wait for the async effect to complete
    await new Promise((r) => setTimeout(r, 100));

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("handles invoke rejection silently", async () => {
    mockInvoke.mockRejectedValue(new Error("Network error"));

    // Should not throw
    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 100));

    // No crash, no localStorage update
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
