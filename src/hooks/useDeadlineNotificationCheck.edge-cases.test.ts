/**
 * useDeadlineNotificationCheck.edge-cases.test.ts
 *
 * Story 9.3 TEA — Additional edge-case tests for the on-login notification check hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks (MUST be before imports that use them) ──

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
const DEBOUNCE_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// ── Helpers ──

function setDefaultAuthUser(userId = "user-edge-1") {
  mockUseAuth.mockReturnValue({
    user: { id: userId } as any,
    session: null,
    loading: false,
    signIn: vi.fn() as any,
    signUp: vi.fn() as any,
    signOut: vi.fn() as any,
    signInWithGoogle: vi.fn() as any,
    sendOtp: vi.fn() as any,
    verifyOtp: vi.fn() as any,
  });
}

// ── Tests ──

describe("useDeadlineNotificationCheck — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setDefaultAuthUser();
    // Safe default so any unexpected invoke call doesn't crash on .then()
    mockInvoke.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── P0: Debounce boundary at exactly 24h ──

  it("invokes when last check was exactly 24 hours ago", async () => {
    // Freeze time to eliminate race between test setup and hook execution
    const frozenNow = new Date("2026-06-15T12:00:00").getTime();
    vi.useFakeTimers({ now: frozenNow });

    // Exactly 24h ago: now - lastCheck === DEBOUNCE_MS, so NOT < DEBOUNCE_MS → should invoke
    localStorage.setItem(STORAGE_KEY, String(frozenNow - DEBOUNCE_MS));
    // mockInvoke safe default set in beforeEach — no override needed here

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Flush microtasks / timers
    await vi.advanceTimersByTimeAsync(0);

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-deadline-notifications",
      { body: { user_id: "user-edge-1" } },
    );
  });

  // ── P0: Debounce just under 24h ──

  it("skips invoke when last check was 24h minus 1ms ago", async () => {
    // Freeze time to eliminate race between test setup and hook execution
    const frozenNow = new Date("2026-06-15T12:00:00").getTime();
    vi.useFakeTimers({ now: frozenNow });

    // 1ms under 24h: now - lastCheck === DEBOUNCE_MS - 1 < DEBOUNCE_MS → should skip
    localStorage.setItem(STORAGE_KEY, String(frozenNow - (DEBOUNCE_MS - 1)));

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Flush microtasks / timers
    await vi.advanceTimersByTimeAsync(50);

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  // ── P1: localStorage with corrupted (non-numeric) value ──

  it("invokes when localStorage has corrupted value", async () => {
    // Number("not-a-number") → NaN; now - NaN → NaN; NaN < DEBOUNCE_MS → false → proceeds
    localStorage.setItem(STORAGE_KEY, "not-a-number");
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });
  });

  // ── P1: localStorage with empty string ──

  it("invokes when localStorage has empty string", async () => {
    // Number("") → 0; now - 0 is huge → NOT < DEBOUNCE_MS → proceeds
    localStorage.setItem(STORAGE_KEY, "");
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });
  });

  // ── P1: User with empty string ID ──

  it("does not crash if user id is empty string (tech-debt: no guard for empty ID)", async () => {
    // user is { id: "" } → truthy, so !user is false → proceeds to invoke with user_id: ""
    // TECH-DEBT: The hook doesn't guard against empty string IDs. The Edge Function
    // will reject this via JWT mismatch (anti-tampering), but the client wastes a call.
    // Consider adding `if (!user?.id) return;` in the hook.
    setDefaultAuthUser("");
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-deadline-notifications",
      { body: { user_id: "" } },
    );
  });

  // ── P1: Verify console.error on Edge Function error ──

  it("logs error to console on Edge Function error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const edgeError = new Error("rate-limit exceeded");
    mockInvoke.mockResolvedValue({ data: null, error: edgeError });

    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[useDeadlineNotificationCheck] Edge Function error:",
      edgeError,
    );
    // consoleSpy restored by afterEach → vi.restoreAllMocks()
  });

  // ── P2: Sequential mount→unmount→remount respects localStorage debounce ──

  it("skips invoke on remount after localStorage was set by first mount", async () => {
    // NOTE: This tests sequential renders (unmount then remount), NOT truly
    // concurrent renders. Two components mounted simultaneously before the
    // first .then() resolves could both pass the debounce check — that race
    // is acceptable because only one Edge Function call matters (dedup server-side).
    mockInvoke.mockResolvedValue({ data: { generated: 0 }, error: null });

    // First render — will invoke and set localStorage on success
    const { unmount } = renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Wait for the first invoke to complete and localStorage to be set
    await vi.waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    unmount();

    // Second render — localStorage is now set within 24h window, should skip
    renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Give async a chance to run
    await new Promise((r) => setTimeout(r, 50));

    // Only the first render should have invoked
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  // ── P2: Invoke is not called while auth is loading ──

  it("invokes after auth transitions from loading to loaded", async () => {
    // Start with loading state — user is null
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signIn: vi.fn() as any,
      signUp: vi.fn() as any,
      signOut: vi.fn() as any,
      signInWithGoogle: vi.fn() as any,
      sendOtp: vi.fn() as any,
      verifyOtp: vi.fn() as any,
    });

    const { rerender } = renderHook(() => useDeadlineNotificationCheck(), {
      wrapper: createWrapper(),
    });

    // Give async a chance to run — should NOT invoke
    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalled();

    // Simulate auth loaded — user now present
    setDefaultAuthUser("user-transition-1");
    rerender();

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledOnce();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "generate-deadline-notifications",
      { body: { user_id: "user-transition-1" } },
    );
  });

  it("does not invoke while auth is loading", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
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

    // Give async a chance to run
    await new Promise((r) => setTimeout(r, 50));

    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
