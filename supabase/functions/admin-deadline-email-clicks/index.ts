// Story 84-9: EF admin-gated — tasso click REALE delle email scadenza da PostHog.
//
// Blueprint: admin-stats/index.ts (CORS allowlist, getUser da JWT via anon client, check admin
// via user_roles select con service client — NON la sola RLS). La chiave PostHog è server-side,
// MAI esposta al client.
//
// Interroga la PostHog Query API (HogQL): POST {POSTHOG_QUERY_HOST}/api/projects/{id}/query/
// con Authorization: Bearer {POSTHOG_PERSONAL_API_KEY} (read-scoped). Conta
// deadline_email_clicked / deadline_email_sent (84-6) → { clicks, sends, click_rate, by_threshold, trend }.
//
// ⚠️ HOST: app host eu.posthog.com (Query API) ≠ ingestion eu.i.posthog.com (capture 84-6).
// ⚠️ KEY: Personal API Key read-scoped NUOVA, NON l'ingestion key (write-only).
// ⚠️ RESILIENZA: errore PostHog (401/timeout/5xx) → 502 + log; il blocco click in UI mostra
//    errore locale, le KPI recapito (da email_events) restano. Il click NON è critico.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildClickMetricsHogQL,
  parseClickMetricsResponse,
} from "../_shared/posthog-query-logic.ts";

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

// App host della Query API (NON l'ingestion). Override via secret se mai cambiasse.
const DEFAULT_QUERY_HOST = "https://eu.posthog.com";
const DEFAULT_PROJECT_ID = "141843"; // org Forfettino, EU

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: utente da JWT ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return json({ error: "Unauthorized" }, 401);
    }

    // ── Check admin via user_roles (service client) ──────────────────────
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleRows, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);
    if (roleError) {
      console.error("Role check error:", roleError);
      return json({ error: "Failed to verify admin status" }, 500);
    }
    if (!roleRows || roleRows.length === 0) {
      console.log(`User ${user.id} attempted admin access without admin role`);
      return json({ error: "Forbidden: Admin access required" }, 403);
    }

    // ── Input: finestra temporale (since ISO o null per "tutto") ─────────
    let since: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.since === "string") since = body.since;
    } catch {
      // body assente/non-JSON → since resta null (tutta la storia)
    }

    // ── PostHog Query API (HogQL) ────────────────────────────────────────
    const posthogKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY");
    if (!posthogKey) {
      console.error("POSTHOG_PERSONAL_API_KEY non configurata");
      return json({ error: "PostHog non configurato" }, 502);
    }
    const queryHost = (Deno.env.get("POSTHOG_QUERY_HOST") || DEFAULT_QUERY_HOST).replace(/\/+$/, "");
    const projectId = Deno.env.get("POSTHOG_PROJECT_ID") || DEFAULT_PROJECT_ID;
    const hogql = buildClickMetricsHogQL(since);

    let phResponse: unknown;
    try {
      const res = await fetch(`${queryHost}/api/projects/${projectId}/query/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${posthogKey}`,
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`PostHog query non-ok ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
        return json({ error: `PostHog query failed (${res.status})` }, 502);
      }
      phResponse = await res.json();
    } catch (err) {
      console.error("PostHog query fetch failed:", err instanceof Error ? err.message : err);
      return json({ error: "PostHog query error" }, 502);
    }

    const metrics = parseClickMetricsResponse(phResponse);
    console.log(`Admin ${user.id} click metrics: ${metrics.clicks} click / ${metrics.sends} sent`);
    return json(metrics);
  } catch (error) {
    console.error("admin-deadline-email-clicks error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
    );
  }
});
