import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ---------------------------------------------------------------------------
// CORS — validated origins (matches google-calendar-sync)
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

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[google-calendar-auth] ${step}${detailsStr}`);
};

/** Allowed redirect URI patterns (exact origin + path). */
const ALLOWED_REDIRECT_ORIGINS = [
  "https://forfettino.lovable.app",
  "https://forfettino.it",
  "http://localhost:5173",
  "http://localhost:8080",
];

function validateRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    const origin = parsed.origin;
    const path = parsed.pathname;
    return (
      ALLOWED_REDIRECT_ORIGINS.includes(origin) && path === "/calendario"
    );
  } catch {
    return false;
  }
}

function jsonResponse(data: unknown, status = 200, corsHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(corsHeaders ?? {}), "Content-Type": "application/json" },
  });
}

/**
 * Authenticate the request and return the user.
 * Uses anon client with user's JWT to verify identity.
 */
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("No authorization header provided");

  const token = authHeader.replace("Bearer ", "");
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser(token);
  if (userError) throw new Error(`Authentication error: ${userError.message}`);

  const user = userData.user;
  if (!user) throw new Error("User not authenticated");
  return user;
}

/**
 * Action: initiate
 * Generates the Google OAuth authorization URL with all required parameters.
 */
function handleInitiate(userId: string, redirectUri: string, corsHeaders: Record<string, string>): Response {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");

  const scopes = [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    // CSRF protection — verified at callback against authenticated user_id.
    // NOTE: user_id is exposed in the URL (info leak). Acceptable for MVP;
    // TODO: replace with HMAC(user_id + secret + ts) for production hardening.
    state: userId,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  logStep("OAuth URL generated", { redirectUri, userId });

  return jsonResponse({ url: authUrl }, 200, corsHeaders);
}

/**
 * Action: callback
 * Exchanges the authorization code for tokens, fetches user email,
 * and upserts into calendar_connections.
 */
async function handleCallback(
  userId: string,
  code: string,
  redirectUri: string,
  state: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // CSRF check: state must match authenticated user_id
  if (state !== userId) {
    logStep("CSRF validation failed", { state, userId });
    return jsonResponse({ error: "State mismatch — possible CSRF attack" }, 403, corsHeaders);
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  // 1. Exchange code for tokens
  logStep("Exchanging code for tokens");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    logStep("Token exchange failed", { status: tokenRes.status, body: errBody });
    return jsonResponse({ error: "Token exchange failed" }, 502, corsHeaders);
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  if (!access_token) {
    logStep("No access_token in response", tokenData);
    return jsonResponse({ error: "No access token received" }, 502, corsHeaders);
  }

  logStep("Tokens received", {
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
    expiresIn: expires_in,
  });

  // 2. Fetch user email from Google
  logStep("Fetching provider email");
  const userInfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!userInfoRes.ok) {
    logStep("UserInfo fetch failed", { status: userInfoRes.status });
    return jsonResponse({ error: "Failed to fetch Google user info" }, 502, corsHeaders);
  }

  const userInfo = await userInfoRes.json();
  const email = userInfo.email as string;
  logStep("Provider email fetched", { email });

  // 3. Calculate expires_at
  const expiresAt = new Date(
    Date.now() + (expires_in ?? 3600) * 1000
  ).toISOString();

  // 4. UPSERT into calendar_connections (service role client — bypass RLS)
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { error: upsertError } = await serviceClient
    .from("calendar_connections")
    .upsert(
      {
        user_id: userId,
        provider: "google",
        provider_email: email,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expiresAt,
        status: "active",
        last_synced_at: null, // reset — sync in Story 48.4
        sync_token: null, // reset — full sync needed
      },
      { onConflict: "user_id,provider" }
    );

  if (upsertError) {
    logStep("UPSERT failed", { error: upsertError.message });
    return jsonResponse({ error: "Failed to save connection" }, 500, corsHeaders);
  }

  // Clean up stale cached events — the full sync after reconnection will repopulate
  const { error: cacheCleanupError } = await serviceClient
    .from("calendar_events_cache")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");

  if (cacheCleanupError) {
    logStep("Cache cleanup warning (non-fatal)", { error: cacheCleanupError.message });
  }

  logStep("Connection saved successfully", { userId, email });

  return jsonResponse({
    success: true,
    email,
    connected_at: new Date().toISOString(),
  }, 200, corsHeaders);
}

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

    // Authenticate user
    const user = await authenticateUser(req);
    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { action, code, redirect_uri, state } = await req.json();
    logStep("Request parsed", { action });

    if (!redirect_uri) {
      return jsonResponse({ error: "redirect_uri is required" }, 400, corsHeaders);
    }
    if (!validateRedirectUri(redirect_uri)) {
      logStep("Invalid redirect_uri rejected", { redirect_uri });
      return jsonResponse({ error: "Invalid redirect_uri" }, 400, corsHeaders);
    }

    switch (action) {
      case "initiate":
        return handleInitiate(user.id, redirect_uri, corsHeaders);

      case "callback":
        if (!code || !state) {
          return jsonResponse(
            { error: "code and state are required for callback" },
            400,
            corsHeaders
          );
        }
        return await handleCallback(user.id, code, redirect_uri, state, corsHeaders);

      default:
        return jsonResponse(
          { error: `Unknown action: ${action}` },
          400,
          corsHeaders
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return jsonResponse({ error: errorMessage }, 500, corsHeaders);
  }
});
