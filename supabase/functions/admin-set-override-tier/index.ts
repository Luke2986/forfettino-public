import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: verify JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Missing authorization header" }, 401);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    // ── Admin check ──
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return jsonResponse(req, { error: "Forbidden: Admin access required" }, 403);
    }

    // ── Parse body ──
    const { userId, tier } = await req.json() as { userId: string; tier: string | null };

    if (!userId || typeof userId !== "string") {
      return jsonResponse(req, { error: "userId is required" }, 400);
    }

    // Validate tier value
    const validTiers = ["pro", "beta_tester", null];
    if (!validTiers.includes(tier)) {
      return jsonResponse(req, { error: `Invalid tier: ${tier}. Must be 'pro', 'beta_tester', or null` }, 400);
    }

    // ── Update with service role (bypasses RLS) ──
    // Il read-back non e' cosmetico: il trigger protect_admin_override_tier puo'
    // bloccare (EXCEPTION) o annullare silenziosamente la scrittura. Senza verifica
    // la funzione risponderebbe 200 su un update mai avvenuto.
    const { data: updatedRows, error: updateError } = await serviceClient
      .from("profiles")
      .update({ admin_override_tier: tier })
      .eq("user_id", userId)
      .select("user_id, admin_override_tier");

    if (updateError) {
      console.error(`Failed to update override tier for ${userId}:`, updateError);
      return jsonResponse(req, { error: updateError.message }, 500);
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error(`No profile row found for user ${userId}`);
      return jsonResponse(req, { error: `Nessun profilo trovato per l'utente ${userId}` }, 404);
    }

    if (updatedRows[0].admin_override_tier !== tier) {
      console.error(
        `Override tier write reverted for ${userId}: expected ${tier ?? "null"}, got ${updatedRows[0].admin_override_tier ?? "null"}`,
      );
      return jsonResponse(req, {
        error:
          "Scrittura annullata dal database (trigger protect_admin_override_tier). Il livello NON e' stato modificato.",
      }, 500);
    }

    console.log(`Admin ${user.id} set override tier for ${userId} to ${tier ?? "null"}`);
    return jsonResponse(req, { success: true });
  } catch (error) {
    console.error("admin-set-override-tier error:", error);
    return jsonResponse(req,
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
    );
  }
});
