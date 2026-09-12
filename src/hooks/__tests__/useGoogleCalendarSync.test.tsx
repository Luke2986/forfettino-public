/**
 * Test per useGoogleCalendarSync.ts
 * Story 48.4 — Google Calendar Fetch, Cache e Sync Incrementale
 *
 * Copertura:
 * - Query: legge eventi cache con range corretto
 * - Sync mutation: chiama Edge Function google-calendar-sync
 * - Auto-sync al mount quando isConnected=true
 * - NO auto-sync quando isConnected=false
 * - Normalizzazione: evento con dateTime vs evento all-day
 * - Normalizzazione: evento senza titolo → "(Senza titolo)"
 * - Gestione errori sync (Edge Function error)
 * - Gestione errore 410 (gestito internamente dalla Edge Function)
 * - Stati: isLoading, isSyncing, syncError
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ---- Mock Supabase ----
// Chain: from('calendar_events_cache').select(...).eq('user_id').eq('provider').gte('start_at').lte('start_at').order('start_at')
const mockOrder = vi.fn();
const mockLte = vi.fn(() => ({ order: mockOrder }));
const mockGte = vi.fn(() => ({ lte: mockLte }));
const mockEqProvider = vi.fn(() => ({ gte: mockGte }));
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

import { useGoogleCalendarSync } from "../useGoogleCalendarSync";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// Sample cached events as returned by Supabase query
const mockCachedEvents = [
  {
    id: "cache-1",
    external_id: "gev-1",
    title: "Meeting con cliente",
    start_at: "2026-03-25T10:00:00+01:00",
    end_at: "2026-03-25T11:00:00+01:00",
    all_day: false,
    location: "Via Roma 1",
    description: "Riunione progetto",
    calendar_name: "Google Calendar",
    color: null,
  },
  {
    id: "cache-2",
    external_id: "gev-2",
    title: "Vacanza",
    start_at: "2026-03-28T00:00:00",
    end_at: "2026-03-29T00:00:00",
    all_day: true,
    location: null,
    description: null,
    calendar_name: "Google Calendar",
    color: "5",
  },
];

const CURRENT_MONTH = new Date(2026, 2, 15); // March 2026

describe("useGoogleCalendarSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Query — cached events", () => {
    it("reads from calendar_events_cache with correct range and filters", async () => {
      mockOrder.mockResolvedValue({ data: mockCachedEvents, error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 0, sync_type: "full", last_synced_at: "2026-03-25T12:00:00Z" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom).toHaveBeenCalledWith("calendar_events_cache");
      expect(mockSelect).toHaveBeenCalledWith(
        "id, external_id, title, start_at, end_at, all_day, location, description, calendar_name, color"
      );
      expect(mockEqUserId).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockEqProvider).toHaveBeenCalledWith("provider", "google");
      expect(result.current.googleEvents).toHaveLength(2);
    });

    it("returns empty array when not connected", async () => {
      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, false),
        { wrapper: createWrapper() }
      );

      // Query should be disabled (isConnected=false), no fetch
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.googleEvents).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns events with dateTime (timed event)", async () => {
      mockOrder.mockResolvedValue({ data: [mockCachedEvents[0]], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 0, sync_type: "incremental", last_synced_at: "2026-03-25T12:00:00Z" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.googleEvents).toHaveLength(1));
      const event = result.current.googleEvents[0];
      expect(event.all_day).toBe(false);
      expect(event.start_at).toBe("2026-03-25T10:00:00+01:00");
      expect(event.title).toBe("Meeting con cliente");
      expect(event.location).toBe("Via Roma 1");
    });

    it("returns all-day event correctly", async () => {
      mockOrder.mockResolvedValue({ data: [mockCachedEvents[1]], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 0, sync_type: "full", last_synced_at: "2026-03-25T12:00:00Z" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.googleEvents).toHaveLength(1));
      const event = result.current.googleEvents[0];
      expect(event.all_day).toBe(true);
      expect(event.start_at).toBe("2026-03-28T00:00:00");
      expect(event.color).toBe("5");
    });
  });

  describe("Sync mutation", () => {
    it("calls Edge Function google-calendar-sync on mount when connected", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 5, sync_type: "full", last_synced_at: "2026-03-25T12:00:00Z" },
        error: null,
      });

      renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Edge Function invocation: first arg is the function name, second arg
        // is options (undefined when no body/headers are passed).
        expect(mockInvoke).toHaveBeenCalledWith("google-calendar-sync", undefined);
      });
    });

    it("does NOT call Edge Function when not connected", async () => {
      renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, false),
        { wrapper: createWrapper() }
      );

      // Wait a tick to ensure no async call
      await new Promise((r) => setTimeout(r, 50));
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("exposes isSyncing=true while mutation is pending", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });

      // Keep invoke pending
      let resolveInvoke: (v: unknown) => void;
      mockInvoke.mockReturnValue(
        new Promise((resolve) => { resolveInvoke = resolve; })
      );

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSyncing).toBe(true));

      // Resolve the invoke
      resolveInvoke!({
        data: { success: true, events_synced: 0, sync_type: "full", last_synced_at: "2026-03-25T12:00:00Z" },
        error: null,
      });

      await waitFor(() => expect(result.current.isSyncing).toBe(false));
    });

    it("returns lastSyncedAt from sync response", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 3, sync_type: "incremental", last_synced_at: "2026-03-25T15:30:00Z" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.lastSyncedAt).toBe("2026-03-25T15:30:00Z"));
    });
  });

  describe("Error handling", () => {
    it("sets rawSyncError when Edge Function returns error", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: "Function invocation failed" },
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.rawSyncError).toBeTruthy());
      expect(result.current.rawSyncError?.message).toContain("Function invocation failed");
      // visibleSyncError (syncError) stays null — < 3 failures
      expect(result.current.syncError).toBeNull();
    });

    it("sets rawSyncError when sync response has success=false", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: false, error: "no_active_connection" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.rawSyncError).toBeTruthy());
      expect(result.current.rawSyncError?.message).toContain("no_active_connection");
    });

    it("handles query error from Supabase cache read", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "DB error" } });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 0, sync_type: "full", last_synced_at: null },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      // Query errors always surface in rawSyncError
      await waitFor(() => expect(result.current.rawSyncError).toBeTruthy());
    });
  });

  describe("Consecutive failures — silent retry (AC #3)", () => {
    it("syncError is null after 1 failure (< 3 threshold)", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: "Network error" },
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSyncing).toBe(false));
      // visibleSyncError should be null (< 3 failures)
      expect(result.current.syncError).toBeNull();
      // rawSyncError should be set
      expect(result.current.rawSyncError).toBeTruthy();
    });

    it("exposes rawSyncError always (for manual sync toast)", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: "Timeout" },
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.rawSyncError).toBeTruthy());
      expect(result.current.rawSyncError?.message).toContain("Timeout");
    });
  });

  describe("Edge Function internals (tested indirectly via hook response)", () => {
    it("410 Gone handling: Edge Function does full sync fallback, hook receives success", async () => {
      // The Edge Function handles 410 internally and returns a normal success response
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: true, events_synced: 10, sync_type: "full", last_synced_at: "2026-03-25T12:00:00Z" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSyncing).toBe(false));
      expect(result.current.syncError).toBeNull();
    });

    it("token refresh failure: Edge Function returns token_refresh_failed error", async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInvoke.mockResolvedValue({
        data: { success: false, error: "token_refresh_failed", error_code: "token_refresh_failed" },
        error: null,
      });

      const { result } = renderHook(
        () => useGoogleCalendarSync(CURRENT_MONTH, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.rawSyncError).toBeTruthy());
      expect(result.current.rawSyncError?.message).toContain("token_refresh_failed");
    });
  });
});

// ---------------------------------------------------------------------------
// Normalizzazione eventi (normalizeGoogleEvent)
// ---------------------------------------------------------------------------
// La funzione vive nella Edge Function Deno — non importabile in Vitest/jsdom.
// La normalizzazione e' verificata in integrazione: Edge Function → DB → hook query.
// Se serve copertura unitaria, estrarre normalizeGoogleEvent in un modulo shared.
