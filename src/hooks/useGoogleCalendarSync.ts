import { useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * A Google Calendar event from the cache table.
 */
export interface GoogleCalendarEvent {
  id: string;
  external_id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
  calendar_name: string | null;
  color: string | null;
}

const QUERY_KEY = "google_calendar_events";

/**
 * Hook for syncing and reading Google Calendar events from the cache.
 *
 * Pattern: optimistic cache read + background sync.
 * 1. At mount, reads existing cached events immediately (no flash).
 * 2. In parallel, triggers Edge Function sync (if connected).
 * 3. On sync completion, invalidates the query to refresh UI.
 */
export function useGoogleCalendarSync(
  currentMonth: Date,
  isConnected: boolean
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncTriggered = useRef(false);
  // Tracks failures within a single page session. Resets on re-mount (by design:
  // each page visit triggers a fresh auto-sync, so persistent cross-visit counting
  // is unnecessary — the threshold protects against rapid manual retry spam).
  const consecutiveFailures = useRef(0);

  // Range: current month -1 to +1 (same buffer as useCalendarEvents)
  const rangeStart = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1
  );
  const rangeEnd = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 2,
    0 // last day of month+1
  );

  const rangeStartISO = rangeStart.toISOString();
  const rangeEndISO = rangeEnd.toISOString();

  // Query: read cached events from calendar_events_cache
  const {
    data: googleEvents = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: [QUERY_KEY, user?.id, rangeStartISO, rangeEndISO],
    queryFn: async (): Promise<GoogleCalendarEvent[]> => {
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .from("calendar_events_cache")
        .select(
          "id, external_id, title, start_at, end_at, all_day, location, description, calendar_name, color"
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .gte("start_at", rangeStartISO)
        .lte("start_at", rangeEndISO)
        .order("start_at");

      if (error) throw error;
      return (data as GoogleCalendarEvent[]) ?? [];
    },
    enabled: !!user && isConnected,
  });

  // Mutation: trigger Edge Function sync
  const syncMutation = useMutation({
    mutationFn: async () => {
      console.log("[GCAL-DEBUG] Triggering sync Edge Function...");
      const res = await supabase.functions.invoke("google-calendar-sync");
      console.log("[GCAL-DEBUG] Sync response:", { error: res.error, data: res.data });
      if (res.error) throw new Error(res.error.message);

      const body = res.data as {
        success?: boolean;
        error?: string;
        events_synced?: number;
        sync_type?: string;
        last_synced_at?: string;
      };

      if (!body.success) {
        throw new Error(body.error || "Sync failed");
      }

      return body;
    },
    onSuccess: (data) => {
      consecutiveFailures.current = 0;
      console.log("[GCAL-DEBUG] Sync SUCCESS:", data);
      // Refresh cached events query + connection query (for last_synced_at)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["calendar_connection_google"] });
    },
    onError: (err) => {
      consecutiveFailures.current += 1;
      console.error("[GCAL-DEBUG] Sync FAILED (attempt", consecutiveFailures.current, "):", err);
    },
  });

  // Reset sync guard when disconnected (allows re-sync after reconnection)
  useEffect(() => {
    if (!isConnected) {
      syncTriggered.current = false;
    }
  }, [isConnected]);

  // Auto-sync on mount when connected (once per connection cycle)
  useEffect(() => {
    console.log("[GCAL-DEBUG] Auto-sync check:", { isConnected, syncTriggered: syncTriggered.current });
    if (isConnected && !syncTriggered.current) {
      console.log("[GCAL-DEBUG] Auto-sync TRIGGERING...");
      syncTriggered.current = true;
      syncMutation.mutate();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only expose sync error to UI after 3+ consecutive failures (AC #3)
  const rawSyncError = queryError || syncMutation.error;
  const visibleSyncError =
    consecutiveFailures.current >= 3 ? rawSyncError : null;

  return {
    googleEvents,
    isLoading,
    isSyncing: syncMutation.isPending,
    triggerSync: () => syncMutation.mutate(),
    lastSyncedAt: syncMutation.data?.last_synced_at ?? null,
    syncError: visibleSyncError,
    /** Raw error regardless of retry count — used for manual sync toast */
    rawSyncError,
  };
}
