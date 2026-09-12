import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  console.log(`[VERIFY-BACKUP-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Authenticate user (they have AAL1 session from password login)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse input code
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      throw new Error("Missing or invalid backup code");
    }

    logStep("Code received", { length: code.length });

    // Service role client for DB access (RPCs are SECURITY DEFINER but we need service_role for lockout)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Step 1: Pre-check lockout (NO increment — fixes off-by-one)
    const { data: lockoutData, error: lockoutError } = await serviceClient.rpc(
      "check_lockout",
      { p_user_id: user.id }
    );

    if (lockoutError) {
      logStep("Lockout check error", { error: lockoutError.message });
      throw new Error("Failed to check lockout status");
    }

    if (lockoutData?.locked) {
      logStep("User is locked out", { locked_until: lockoutData.locked_until });
      return new Response(JSON.stringify({
        valid: false,
        locked: true,
        locked_until: lockoutData.locked_until,
        error: "Troppi tentativi. Account temporaneamente bloccato.",
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Step 2: Atomic backup code verification via RPC (no TOCTOU)
    const { data: verifyData, error: verifyError } = await serviceClient.rpc(
      "verify_and_consume_backup_code",
      { p_user_id: user.id, p_plain_code: code }
    );

    if (verifyError) {
      logStep("Verify RPC error", { error: verifyError.message });
      throw new Error("Failed to verify backup code");
    }

    if (verifyData?.valid) {
      // Step 3: Reset lockout on success
      await serviceClient.rpc("reset_lockout", { p_user_id: user.id });

      logStep("Backup code verified successfully");

      return new Response(JSON.stringify({
        valid: true,
        backupVerified: true,
        factorId: verifyData.factor_id,
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Step 4: Failed — increment AFTER verification (fixes off-by-one: all 5 attempts get verified)
    const { data: failData } = await serviceClient.rpc(
      "record_failed_attempt",
      { p_user_id: user.id }
    );

    const remainingAttempts = Math.max(0, 5 - (failData?.attempts || 0));
    logStep("No matching backup code found", { remainingAttempts });

    // If this failure triggered lockout, return 429
    if (failData?.locked) {
      return new Response(JSON.stringify({
        valid: false,
        locked: true,
        locked_until: failData.locked_until,
        error: "Troppi tentativi. Account temporaneamente bloccato.",
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 429,
      });
    }

    return new Response(JSON.stringify({
      valid: false,
      error: "Codice di backup non valido.",
      remaining_attempts: remainingAttempts,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Errore interno del server." }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
