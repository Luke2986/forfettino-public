/**
 * Test per useCalendarConnection.ts
 * Story 48.3 — Google OAuth Flow e Token Storage
 *
 * Copertura:
 * - Query: ritorna connessione attiva o null
 * - connectGoogle(): chiama Edge Function initiate, redirect a URL
 * - handleCallback(): chiama Edge Function callback, invalida queries
 * - Stati: disconnesso, connesso, loading
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock supabase — chain: from().select().eq('user_id').eq('provider').maybeSingle()
const mockMaybeSingle = vi.fn();
const mockEqProvider = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqUserId = vi.fn(() => ({ eq: mockEqProvider }));
const mockSelect = vi.fn(() => ({ eq: mockEqUserId }));
const mockFrom = vi.fn((_table?: unknown) => ({ select: mockSelect }));
const mockInvoke = vi.fn((_name?: unknown, _opts?: unknown) => Promise.resolve({ data: null, error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(args[0]),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(args[0], args[1]),
    },
  },
}));

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
    session: { access_token: "test-token" },
  }),
}));

// Mock useToast — trackable mock toast function
const mockToastFn = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToastFn }),
}));

// Mock window.location
const originalLocation = window.location;

import { useCalendarConnection } from "../useCalendarConnection";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useCalendarConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "", origin: "https://forfettino.lovable.app" },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  describe("Query — connection state", () => {
    it("returns null (disconnected) when no connection exists", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.connection).toBeNull();
      expect(result.current.isConnected).toBe(false);
    });

    it("returns connection data when active connection exists", async () => {
      const mockConnection = {
        id: "conn-1",
        user_id: "user-123",
        provider: "google",
        provider_email: "user@gmail.com",
        access_token: "at-xxx",
        refresh_token: "rt-xxx",
        expires_at: "2026-04-01T00:00:00Z",
        status: "active",
        last_synced_at: null,
        sync_token: null,
        created_at: "2026-03-25T10:00:00Z",
        updated_at: "2026-03-25T10:00:00Z",
      };
      mockMaybeSingle.mockResolvedValue({ data: mockConnection, error: null });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connection?.provider_email).toBe("user@gmail.com");
    });

    it("queries calendar_connections with provider=google", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockFrom).toHaveBeenCalledWith("calendar_connections"));
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEqUserId).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockEqProvider).toHaveBeenCalledWith("provider", "google");
    });
  });

  describe("connectGoogle()", () => {
    it("calls Edge Function with action=initiate and redirects", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      mockInvoke.mockResolvedValue({
        data: { url: "https://accounts.google.com/o/oauth2/v2/auth?..." },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.connectGoogle();
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("google-calendar-auth", {
          body: {
            action: "initiate",
            redirect_uri: "https://forfettino.lovable.app/calendario",
          },
        });
      });

      await waitFor(() => {
        expect(window.location.href).toContain("accounts.google.com");
      });
    });
  });

  describe("connectionStatus", () => {
    it("returns null when no connection", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.connectionStatus).toBeNull();
    });

    it("returns 'active' for active connection", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "conn-1", status: "active", provider_email: "u@g.com" },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.connectionStatus).toBe("active"));
      expect(result.current.isConnected).toBe(true);
    });

    it("returns 'error' and isConnected=false for error connection", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "conn-1", status: "error", provider_email: "u@g.com" },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.connectionStatus).toBe("error"));
      expect(result.current.isConnected).toBe(false);
    });

    it("returns 'revoked' and isConnected=false for revoked connection", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "conn-1", status: "revoked", provider_email: "u@g.com" },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.connectionStatus).toBe("revoked"));
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("disconnectGoogle()", () => {
    it("calls delete on calendar_connections and invalidates queries", async () => {
      const mockDeleteEqUser = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteEqId = vi.fn(() => ({ eq: mockDeleteEqUser }));
      const mockDelete = vi.fn(() => ({ eq: mockDeleteEqId }));
      mockFrom.mockImplementation((table?: unknown) => {
        if (table === "calendar_connections") {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return { select: mockSelect };
      });

      mockMaybeSingle.mockResolvedValue({
        data: { id: "conn-1", status: "active", provider_email: "u@g.com" },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      act(() => {
        result.current.disconnectGoogle();
      });

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
        expect(mockDeleteEqId).toHaveBeenCalledWith("id", "conn-1");
        expect(mockDeleteEqUser).toHaveBeenCalledWith("user_id", "user-123");
      });
    });

    it("shows destructive toast on disconnect error", async () => {
      mockToastFn.mockClear();

      const mockDeleteEqUser = vi.fn().mockResolvedValue({ error: { message: "RLS denied" } });
      const mockDeleteEqId = vi.fn(() => ({ eq: mockDeleteEqUser }));
      const mockDelete = vi.fn(() => ({ eq: mockDeleteEqId }));
      mockFrom.mockImplementation((table?: unknown) => {
        if (table === "calendar_connections") {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return { select: mockSelect };
      });

      mockMaybeSingle.mockResolvedValue({
        data: { id: "conn-1", status: "active", provider_email: "u@g.com" },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      act(() => {
        result.current.disconnectGoogle();
      });

      await waitFor(() => {
        expect(mockToastFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Errore durante la disconnessione",
            variant: "destructive",
          })
        );
      });
    });
  });

  describe("handleCallback()", () => {
    it("calls Edge Function with action=callback and code/state", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, email: "user@gmail.com", connected_at: "2026-03-25T10:00:00Z" },
        error: null,
      });

      const { result } = renderHook(() => useCalendarConnection(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.handleCallback("auth-code-123", "user-123");
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("google-calendar-auth", {
          body: {
            action: "callback",
            code: "auth-code-123",
            state: "user-123",
            redirect_uri: "https://forfettino.lovable.app/calendario",
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isCallbackSuccess).toBe(true);
      });
    });
  });
});
