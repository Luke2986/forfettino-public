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

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

/**
 * Extract the real client IP from request headers.
 * Supabase Edge Functions run behind a CDN/proxy, so we check
 * forwarded headers in priority order.
 */
function getClientIp(req: Request): string | null {
  // x-forwarded-for may contain comma-separated list: "client, proxy1, proxy2"
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return null;
}

const MONTHLY_REFERRAL_CAP = 10;

Deno.serve(async (req) => {
  // CORS preflight
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
      return jsonResponse(req, { error: "missing_auth" }, 401);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }

    const inviteeUserId = user.id;

    // ── Parse body ──
    const body = await req.json().catch(() => ({}));
    const referrerCode = typeof body.referrer_code === "string"
      ? body.referrer_code.trim()
      : "";

    if (!referrerCode) {
      return jsonResponse(req, { error: "missing_referrer_code" }, 400);
    }

    // ── Capture client IP ──
    const clientIp = getClientIp(req);

    // ── Service client for privileged DB operations ──
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ── 1. Find referrer by user_code ──
    const { data: referrerProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("user_code", referrerCode)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }

    if (!referrerProfile) {
      // Invalid code — silently OK (don't leak whether codes exist)
      return jsonResponse(req, { ok: true, skipped: "invalid_code" });
    }

    const referrerUserId = referrerProfile.user_id;

    // ── 2. Block self-referral ──
    if (referrerUserId === inviteeUserId) {
      return jsonResponse(req, { ok: true, skipped: "self_referral" });
    }

    // ── 3. Block duplicate invitee (already referred by someone) ──
    const { data: existingInvitee } = await serviceClient
      .from("referrals")
      .select("id")
      .eq("invitee_user_id", inviteeUserId)
      .limit(1)
      .maybeSingle();

    if (existingInvitee) {
      return jsonResponse(req, { ok: true, skipped: "already_referred" });
    }

    // ── 4. IP anti-abuse: same IP = max 1 referral per 90 days ──
    if (clientIp) {
      const ninetyDaysAgo = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: ipMatch } = await serviceClient
        .from("referrals")
        .select("id")
        .eq("ip_address", clientIp)
        .gte("created_at", ninetyDaysAgo)
        .limit(1)
        .maybeSingle();

      if (ipMatch) {
        return jsonResponse(req, { ok: true, skipped: "ip_blocked" });
      }
    }

    // ── 5. Monthly cap: max MONTHLY_REFERRAL_CAP referrals per referrer per month ──
    // NOTE: This check + insert below is not atomic. Under extreme concurrency,
    // two requests at count=9 could both pass, yielding 11 rows. The SQL trigger
    // on onboarding is the safety net that limits actual point awards to 10.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count: monthlyCount, error: countError } = await serviceClient
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", referrerUserId)
      .in("status", ["pending", "confirmed"])
      .gte("created_at", monthStart.toISOString());

    if (countError) {
      console.error("Monthly cap count error:", countError);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }

    if ((monthlyCount ?? 0) >= MONTHLY_REFERRAL_CAP) {
      return jsonResponse(req, { ok: true, skipped: "monthly_cap_reached" });
    }

    // ── 6. Insert referral row (pending — confirmed on onboarding) ──
    const { error: insertError } = await serviceClient
      .from("referrals")
      .insert({
        referrer_user_id: referrerUserId,
        referrer_code: referrerCode,
        invitee_user_id: inviteeUserId,
        ip_address: clientIp,
        status: "pending",
      });

    if (insertError) {
      // Duplicate insert — the invitee uniqueness check above should prevent this,
      // but log and skip gracefully if a race condition occurs
      console.error("Referral insert error:", insertError);
      return jsonResponse(req, { ok: true, skipped: "insert_failed" });
    }

    return jsonResponse(req, { ok: true });
  } catch (err) {
    console.error("process-referral error:", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
