import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://forfettino.lovable.app",
  "https://forfettino.it",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[google-calendar-sync] ${step}${detailsStr}`);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonResponse(data: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  provider_email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  status: string;
  last_synced_at: string | null;
  sync_token: string | null;
}

interface GoogleCalendarApiEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  organizer?: { displayName?: string };
  colorId?: string;
}

interface GoogleEventsResponse {
  items?: GoogleCalendarApiEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------
async function refreshAccessToken(
  connection: CalendarConnection,
  // deno-lint-ignore no-explicit-any
  serviceClient: any
): Promise<string> {
  logStep("Checking token expiry", { expires_at: connection.expires_at });

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  if (expiresAt > now + FIVE_MINUTES) {
    // Token still valid
    return connection.access_token;
  }

  logStep("Token expired or expiring soon, refreshing");

  if (!connection.refresh_token) {
    throw new Error("no_refresh_token");
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    logStep("Token refresh failed", { status: response.status, body: errBody });

    // Distinguish revoked (user revoked access on Google) vs transient error
    const isRevoked =
      (response.status === 400 || response.status === 401 || response.status === 403) &&
      (errBody.includes("invalid_grant") ||
        errBody.includes("Token has been expired or revoked") ||
        errBody.includes("Token has been revoked"));

    const newStatus = isRevoked ? "revoked" : "error";
    logStep("Marking connection status", { newStatus, httpStatus: response.status });

    await serviceClient
      .from("calendar_connections")
      .update({ status: newStatus })
      .eq("id", connection.id);

    throw new Error(isRevoked ? "token_revoked" : "token_refresh_failed");
  }

  const tokenData = await response.json();
  const newAccessToken = tokenData.access_token as string;
  const expiresIn = (tokenData.expires_in as number) ?? 3600;

  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Update tokens in DB
  await serviceClient
    .from("calendar_connections")
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt,
    })
    .eq("id", connection.id);

  logStep("Token refreshed successfully", { newExpiresAt });
  return newAccessToken;
}

// ---------------------------------------------------------------------------
// Normalize Google Event -> cache row
// ---------------------------------------------------------------------------
function normalizeGoogleEvent(
  event: GoogleCalendarApiEvent,
  connectionId: string,
  userId: string
) {
  const isAllDay = !!event.start?.date;
  return {
    connection_id: connectionId,
    user_id: userId,
    provider: "google",
    external_id: event.id,
    title: event.summary || "(Senza titolo)",
    start_at: isAllDay
      ? `${event.start!.date}T00:00:00`
      : event.start?.dateTime || null,
    end_at: isAllDay
      ? event.end?.date ? `${event.end.date}T00:00:00` : null
      : event.end?.dateTime || null,
    all_day: isAllDay,
    location: event.location || null,
    description: event.description?.slice(0, 500) || null,
    calendar_name: event.organizer?.displayName || "Google Calendar",
    color: event.colorId || null,
    raw_data: event,
  };
}

// ---------------------------------------------------------------------------
// Fetch events from Google (with pagination)
// ---------------------------------------------------------------------------
async function fetchGoogleEvents(
  accessToken: string,
  syncToken: string | null
): Promise<{ events: GoogleCalendarApiEvent[]; nextSyncToken: string | null }> {
  const allEvents: GoogleCalendarApiEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  const baseUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const headers = { Authorization: `Bearer ${accessToken}` };

  do {
    const params = new URLSearchParams();

    if (syncToken) {
      // Incremental sync: only syncToken (NO timeMin/timeMax/orderBy)
      params.set("syncToken", syncToken);
    } else {
      // Full sync: time range = start of current month to end of month +3
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), 1);
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0); // last day of month+3
      params.set("timeMin", timeMin.toISOString());
      params.set("timeMax", timeMax.toISOString());
      params.set("singleEvents", "true");
      params.set("orderBy", "startTime");
      params.set("maxResults", "250");
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${baseUrl}?${params.toString()}`;
    logStep("Fetching Google Calendar events", { syncToken: !!syncToken, pageToken: !!pageToken });

    const response = await fetch(url, { headers });

    if (response.status === 410) {
      // syncToken expired — caller must handle full sync fallback
      throw new Error("SYNC_TOKEN_EXPIRED");
    }

    if (!response.ok) {
      const errBody = await response.text();
      logStep("Google API error", { status: response.status, body: errBody });
      throw new Error(`Google API error: ${response.status}`);
    }

    const data: GoogleEventsResponse = await response.json();
    if (data.items) {
      allEvents.push(...data.items);
    }

    pageToken = data.nextPageToken;
    if (data.nextSyncToken) {
      nextSyncToken = data.nextSyncToken;
    }
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

// ---------------------------------------------------------------------------
// Sync Logic
// ---------------------------------------------------------------------------
async function performSync(
  connection: CalendarConnection,
  accessToken: string,
  // deno-lint-ignore no-explicit-any
  serviceClient: any
): Promise<{ syncType: "full" | "incremental"; eventsSynced: number }> {
  let syncToken = connection.sync_token;
  let syncType: "full" | "incremental" = syncToken ? "incremental" : "full";

  let result: { events: GoogleCalendarApiEvent[]; nextSyncToken: string | null };

  try {
    result = await fetchGoogleEvents(accessToken, syncToken);
  } catch (err) {
    if (err instanceof Error && err.message === "SYNC_TOKEN_EXPIRED") {
      logStep("SyncToken expired (410 Gone), falling back to full sync");

      // Clear cache and sync_token
      await serviceClient
        .from("calendar_events_cache")
        .delete()
        .eq("connection_id", connection.id);

      await serviceClient
        .from("calendar_connections")
        .update({ sync_token: null })
        .eq("id", connection.id);

      // Retry as full sync
      syncType = "full";
      result = await fetchGoogleEvents(accessToken, null);
    } else {
      throw err;
    }
  }

  const { events, nextSyncToken } = result;
  logStep(`${syncType} sync fetched events`, { count: events.length });

  // Process events: separate cancelled from active
  const cancelledIds: string[] = [];
  const upsertRows: ReturnType<typeof normalizeGoogleEvent>[] = [];

  for (const event of events) {
    if (event.status === "cancelled") {
      cancelledIds.push(event.id);
    } else {
      upsertRows.push(normalizeGoogleEvent(event, connection.id, connection.user_id));
    }
  }

  // Delete cancelled events
  if (cancelledIds.length > 0) {
    logStep("Deleting cancelled events", { count: cancelledIds.length });
    await serviceClient
      .from("calendar_events_cache")
      .delete()
      .eq("connection_id", connection.id)
      .in("external_id", cancelledIds);
  }

  // Upsert active events
  if (upsertRows.length > 0) {
    logStep("Upserting events", { count: upsertRows.length });
    const { error: upsertError } = await serviceClient
      .from("calendar_events_cache")
      .upsert(upsertRows, { onConflict: "connection_id,external_id" });

    if (upsertError) {
      logStep("Upsert error", { error: upsertError.message });
      throw new Error(`Failed to upsert events: ${upsertError.message}`);
    }
  }

  // Save new syncToken and update last_synced_at
  const updatePayload: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
  };
  if (nextSyncToken) {
    updatePayload.sync_token = nextSyncToken;
  }

  await serviceClient
    .from("calendar_connections")
    .update(updatePayload)
    .eq("id", connection.id);

  logStep("Sync complete", { syncType, eventsSynced: upsertRows.length + cancelledIds.length });

  return { syncType, eventsSynced: upsertRows.length + cancelledIds.length };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" },
    });
  }

  try {
    logStep("Function invoked", { method: req.method });

    // 1. Authenticate user (anon client with JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header provided" }, 401, corsHeaders);
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData.user) {
      logStep("Authentication failed", { error: userError?.message });
      return jsonResponse({ error: "Authentication failed" }, 401, corsHeaders);
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // 2. Service role client for DB operations (bypass RLS)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Load active Google connection
    const { data: connData, error: connError } = await serviceClient
      .from("calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("status", "active")
      .single();

    if (connError || !connData) {
      logStep("No active connection found", { error: connError?.message });
      return jsonResponse({ error: "no_active_connection" }, 404, corsHeaders);
    }

    const connection = connData as CalendarConnection;
    logStep("Connection loaded", {
      connectionId: connection.id,
      hasSyncToken: !!connection.sync_token,
    });

    // 4. Refresh token if needed
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(connection, serviceClient);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("Token refresh error", { error: msg });
      const errorCode = msg === "token_revoked" ? "token_revoked" : "token_refresh_failed";
      return jsonResponse({ success: false, error: msg, error_code: errorCode }, 401, corsHeaders);
    }

    // 5. Perform sync (full or incremental)
    const { syncType, eventsSynced } = await performSync(connection, accessToken, serviceClient);

    // 6. Get updated last_synced_at
    const { data: updatedConn } = await serviceClient
      .from("calendar_connections")
      .select("last_synced_at")
      .eq("id", connection.id)
      .single();

    return jsonResponse(
      {
        success: true,
        events_synced: eventsSynced,
        sync_type: syncType,
        last_synced_at: (updatedConn as { last_synced_at: string } | null)?.last_synced_at || null,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // Token errors are handled by the inner try/catch (line 413) and never reach here.
    // This catch handles only sync-phase errors (Google API, DB upsert, etc.).
    return jsonResponse(
      { success: false, error: errorMessage, error_code: "sync_error" },
      500,
      corsHeaders
    );
  }
});
