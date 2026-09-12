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

const APP_URL = "https://forfettino.it";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_LEAD_MAGNETS = new Set(["guida_protezione", "scadenziario_2026", "simulatore_acconti_2026"]);

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function buildConfirmationEmail(confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
<div style="max-width:480px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;">
  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #e2e8f0;">
    <span style="font-size:24px;font-weight:700;color:#0d9488;">Forfettino</span>
  </div>
  <div style="padding:32px 24px;">
    <h1 style="font-size:20px;margin:0 0 16px;">Conferma la tua email</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Clicca il bottone qui sotto per confermare la tua iscrizione e scaricare il contenuto.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block;padding:12px 32px;background:#0d9488;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
        Conferma email e scarica
      </a>
    </div>
    <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;">
      Se il bottone non funziona, copia e incolla questo link nel browser:<br>
      <a href="${confirmUrl}" style="color:#0d9488;word-break:break-all;">${confirmUrl}</a>
    </p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
    <p style="margin:0 0 4px;">Non hai richiesto questa email? Puoi ignorarla.</p>
    <p style="margin:0;"><a href="${APP_URL}/privacy-policy" style="color:#94a3b8;">Privacy Policy</a></p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error("Missing required env vars");
      return jsonResponse(req, { error: "Service not configured" }, 500);
    }

    // NO auth required — this function is public (called by anonymous visitors)

    // Parse and validate payload
    const { email, lead_magnet } = await req.json();

    if (!email || typeof email !== "string") {
      return jsonResponse(req, { error: "email is required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 320) {
      return jsonResponse(req, { error: "Invalid email" }, 400);
    }

    // Allowlist lead_magnet — reject unknown values (prevents URL injection)
    const safeLm = typeof lead_magnet === "string" && ALLOWED_LEAD_MAGNETS.has(lead_magnet)
      ? lead_magnet
      : null;

    // Query DB for pending subscription token via service_role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriber, error: dbError } = await serviceClient
      .from("newsletter_subscribers")
      .select("double_opt_in_token, created_at")
      .eq("email", normalizedEmail)
      .is("confirmed_at", null)
      .is("unsubscribed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      console.error("DB query error:", dbError);
      return jsonResponse(req, { error: "Database error" }, 500);
    }

    if (!subscriber || !subscriber.double_opt_in_token) {
      // Always return success to prevent email enumeration
      console.log(`No pending subscription for ${normalizedEmail.replace(/(.).*(@.*)/, "$1***$2")} — no-op`);
      return jsonResponse(req, { success: true });
    }

    // Build confirmation URL with encoded token and allowlisted lead_magnet
    const token = subscriber.double_opt_in_token;
    const confirmUrl = `${APP_URL}/conferma-email?token=${encodeURIComponent(token)}${safeLm ? "&lm=" + safeLm : ""}`;

    // Send email via Resend API
    const htmlBody = buildConfirmationEmail(confirmUrl);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Forfettino <noreply@forfettino.it>",
        to: normalizedEmail,
        subject: "Conferma la tua iscrizione a Forfettino",
        html: htmlBody,
        headers: {
          "List-Unsubscribe": `<${APP_URL}/>`,
        },
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      return jsonResponse(
        { success: false, error: resendData.message || "Failed to send email" },
        500,
      );
    }

    console.log(`Confirmation email sent to ${normalizedEmail.replace(/(.).*(@.*)/, "$1***$2")} (resend id: ${resendData.id})`);
    return jsonResponse(req, { success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
