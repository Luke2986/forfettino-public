import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
  console.log(`[GENERATE-BACKUP-CODES] ${step}${detailsStr}`);
};

/**
 * Generate 10 random alphanumeric 8-char codes.
 * Uses crypto.getRandomValues for secure randomness.
 */
function generateCodes(count = 10, length = 8): string[] {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I,O,0,1 to avoid confusion
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    let code = "";
    for (let j = 0; j < length; j++) {
      code += chars[randomBytes[j] % chars.length];
    }
    codes.push(code);
  }
  return codes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Authenticate user
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

    // Service role client for DB writes
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Find the user's verified TOTP factor (needed for AAL2 elevation via backup codes)
    const { data: factorsData, error: factorsError } = await anonClient.auth.mfa.listFactors();
    if (factorsError) {
      logStep("Error listing factors", { error: factorsError.message });
      throw new Error("Could not retrieve MFA factors");
    }
    const verifiedFactor = factorsData?.totp?.find((f: { status: string }) => f.status === "verified");
    if (!verifiedFactor) {
      throw new Error("No verified TOTP factor found. Enroll MFA first.");
    }
    const factorId = verifiedFactor.id;
    logStep("Found verified factor", { factorId });

    // Generate 10 new codes
    const plainCodes = generateCodes(10, 8);
    logStep("Generated codes", { count: plainCodes.length });

    // Hash each code with bcrypt
    const hashedCodes = await Promise.all(
      plainCodes.map(async (code) => ({
        user_id: user.id,
        factor_id: factorId,
        hashed_code: await hash(code),
      }))
    );

    // Atomic: delete old codes and insert new ones using rpc or sequential with error handling
    const { error: deleteError } = await serviceClient
      .from("mfa_backup_codes")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      logStep("Error deleting old codes", { error: deleteError.message });
      throw new Error(`Failed to clear old backup codes: ${deleteError.message}`);
    }

    // Insert hashed codes
    const { error: insertError } = await serviceClient
      .from("mfa_backup_codes")
      .insert(hashedCodes);

    if (insertError) {
      logStep("Error inserting codes", { error: insertError.message });
      throw new Error(`Failed to save backup codes: ${insertError.message}`);
    }

    logStep("Backup codes saved successfully", { count: hashedCodes.length });

    // Return plain codes (shown to user ONCE ONLY)
    return new Response(JSON.stringify({ codes: plainCodes }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
