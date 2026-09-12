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

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DELETE-ACCOUNT] ${step}${detailsStr}`);
};

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
    logStep("Authorization header found");

    // Authenticate the requesting user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      logStep("Authentication failed", { error: userError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    logStep("User authenticated", { userId });

    // Service role client for deletion (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // STRATEGY: "cascade-first" — clean non-cascadable data, then deleteUser
    // cascades to all 22+ tables with ON DELETE CASCADE.
    // This avoids the zombie state where profile is deleted but auth user remains.

    // Step 0: Snapshot user info for deletion log (before CASCADE wipes it)
    logStep("Step 0: Snapshotting user info for deletion log");
    const { data: profileSnap } = await supabaseAdmin
      .from("profiles")
      .select("user_code")
      .eq("user_id", userId)
      .maybeSingle();

    const { error: logError } = await supabaseAdmin
      .from("account_deletions")
      .insert({
        user_code: profileSnap?.user_code ?? null,
        user_email: user.email ?? null,
      });
    if (logError) {
      logStep("Warning: failed to log deletion", { error: logError.message });
      // Non-blocking — table may not exist yet
    }

    // Step 1: Delete from tables WITHOUT FK constraint to auth.users
    // (subscriptions has user_id UUID NOT NULL but no REFERENCES — must be explicit)
    logStep("Step 1: Deleting orphan tables (no FK)");
    const orphanTables = ["subscriptions"];
    for (const table of orphanTables) {
      logStep(`Deleting from ${table}`);
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", userId);
      if (error) {
        logStep(`Warning: error deleting from ${table}`, { error: error.message });
      }
    }

    // Step 2: Nullify contribution_rewards.confirmed_by referencing this user
    // This FK has ON DELETE SET NULL (after migration fix), but we nullify
    // defensively in case migration hasn't been applied yet
    logStep("Step 2: Nullifying confirmed_by references");
    const { error: nullifyError } = await supabaseAdmin
      .from("contribution_rewards")
      .update({ confirmed_by: null })
      .eq("confirmed_by", userId);
    if (nullifyError) {
      logStep("Warning: error nullifying confirmed_by", { error: nullifyError.message });
      // Non-blocking — table may not exist or have no matching rows
    }

    // Step 3: Delete the auth user — CASCADE handles all FK tables automatically
    logStep("Step 3: Deleting auth user (cascades to all FK tables)");
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      logStep("Error deleting auth user", { error: deleteUserError.message });
      throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
    }
    logStep("Auth user deleted successfully — all data cascaded");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
