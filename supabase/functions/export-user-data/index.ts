import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";

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

const QUERY_TIMEOUT_MS = 25_000; // 25s per-table timeout (AC: 30s total budget)

// Tombstone UUID used by cleanup_expired_data() to anonymize old survey rows.
// Rows with this user_id are excluded from personal data exports (GDPR Art. 20).
const TOMBSTONE_USER_ID = "00000000-0000-0000-0000-000000000000";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[EXPORT-USER-DATA] ${step}${detailsStr}`);
};

/** Race a promise against a timeout. Returns the result or a timeout error. */
function withTimeout(promise: PromiseLike<any>, ms: number, label: string): Promise<any> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Authenticate the requesting user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Authentication failed");
    }
    const userId = user.id;
    logStep("User authenticated", { userId });

    // Use service role for data access
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Query all user tables in parallel with per-table timeout and error handling
    const tables = [
      { key: "profiles", query: () => serviceClient.from("profiles").select("*").eq("user_id", userId).maybeSingle() },
      { key: "fiscal_year_settings", query: () => serviceClient.from("fiscal_year_settings").select("*").eq("user_id", userId) },
      { key: "receipts", query: () => serviceClient.from("receipts").select("*").eq("user_id", userId) },
      { key: "schedule_events", query: () => serviceClient.from("schedule_events").select("*").eq("user_id", userId) },
      { key: "notifications", query: () => serviceClient.from("notifications").select("*").eq("user_id", userId) },
      { key: "notification_preferences", query: () => serviceClient.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle() },
      { key: "user_notification_settings", query: () => serviceClient.from("user_notification_settings").select("*").eq("user_id", userId).maybeSingle() },
      // Note: anonymized rows (user_id = TOMBSTONE_USER_ID) are automatically excluded
      // by the .eq("user_id", userId) filter — no real user will match the tombstone UUID.
      { key: "survey_responses", query: () => serviceClient.from("survey_responses").select("*").eq("user_id", userId) },
      { key: "user_contributions", query: () => serviceClient.from("user_contributions").select("*").eq("user_id", userId).maybeSingle() },
      { key: "event_logs", query: () => serviceClient.from("event_logs").select("*").eq("user_id", userId) },
      { key: "referrals", query: () => serviceClient.from("referrals").select("*").eq("referrer_id", userId) },
    ];

    logStep("Querying tables", { count: tables.length });

    const results = await Promise.allSettled(
      tables.map(async ({ key, query }) => {
        try {
          const { data, error } = await withTimeout(query(), QUERY_TIMEOUT_MS, key);
          if (error) {
            logStep(`Table ${key} error`, { message: error.message });
            return { key, data: null, error: `Tabella non accessibile: ${error.message}` };
          }
          return { key, data, error: null };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logStep(`Table ${key} exception`, { message: msg });
          return { key, data: null, error: `Tabella non accessibile: ${msg}` };
        }
      })
    );

    // Assemble export object
    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      user_email: user.email,
    };

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { key, data, error } = result.value;
        exportData[key] = error ? { error } : data;
      } else {
        // Promise rejected — shouldn't happen with our catch, but just in case
        exportData["unknown_error"] = result.reason?.toString();
      }
    }

    logStep("Export assembled", { keys: Object.keys(exportData).length });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="forfettino-data-export-${dateStr}.json"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("Error", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
