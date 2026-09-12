import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: mockSignOut,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock("@/lib/posthog", () => ({
  posthog: { identify: vi.fn(), reset: vi.fn() },
  isPosthogReady: false,
}));

import { AuthProvider, useAuth } from "./useAuth";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AuthProvider, null, children);

describe("useAuth signOut — sessionStorage cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("removes was_password_login and backup_mfa_verified from sessionStorage BEFORE calling supabase signOut", async () => {
    sessionStorage.setItem("was_password_login", "true");
    sessionStorage.setItem("backup_mfa_verified", "true");

    // Verify order: sessionStorage must be cleared BEFORE supabase.auth.signOut()
    mockSignOut.mockImplementation(() => {
      expect(sessionStorage.getItem("was_password_login")).toBeNull();
      expect(sessionStorage.getItem("backup_mfa_verified")).toBeNull();
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("calls supabase.auth.signOut even if sessionStorage items don't exist", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
