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

const MAX_RECIPIENTS = 10;

interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface RecipientResult {
  email: string;
  status: "sent" | "skipped" | "error";
  id?: string;
  error?: string;
}

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return jsonResponse(req, { error: "Email service not configured" }, 500);
    }

    // ── Auth: verify JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Missing authorization header" }, 401);
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
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    // ── Admin role check ──
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await serviceClient.rpc(
      "has_role",
      { _user_id: user.id, _role: "admin" },
    );

    if (roleError) {
      console.error("Role check error:", roleError);
      return jsonResponse(req, { error: "Failed to verify admin status" }, 500);
    }

    if (!isAdmin) {
      return jsonResponse(req, { error: "Forbidden: Admin access required" }, 403);
    }

    // ── Parse and validate payload ──
    const payload: SendEmailPayload = await req.json();

    if (!payload.to || (typeof payload.to !== "string" && !Array.isArray(payload.to))) {
      return jsonResponse(req, { error: "to is required (string or array of strings)" }, 400);
    }

    if (!payload.subject || typeof payload.subject !== "string" || payload.subject.trim().length === 0) {
      return jsonResponse(req, { error: "subject is required" }, 400);
    }

    if (!payload.html || typeof payload.html !== "string" || payload.html.trim().length === 0) {
      return jsonResponse(req, { error: "html is required" }, 400);
    }

    // Normalize `to` to array
    const recipientEmails: string[] = Array.isArray(payload.to)
      ? payload.to.map((e) => (typeof e === "string" ? e.trim().toLowerCase() : "")).filter(Boolean)
      : [payload.to.trim().toLowerCase()];

    if (recipientEmails.length === 0) {
      return jsonResponse(req, { error: "At least one recipient is required" }, 400);
    }

    // ── Batch guard ──
    if (recipientEmails.length > MAX_RECIPIENTS) {
      return jsonResponse(
        req,
        { error: `Max ${MAX_RECIPIENTS} recipients per invocation` },
        400,
      );
    }

    const subject = payload.subject.trim().slice(0, 200);
    const rawHtmlBody = payload.html.trim().slice(0, 50_000);
    const textBody = payload.text?.trim().slice(0, 50_000) || undefined;

    console.log(`Admin ${user.id} sending email: "${subject}" to ${recipientEmails.length} recipient(s)`);

    // ── GDPR footer: appended to every email ──
    const APP_URL = "https://forfettino.it";
    const gdprFooter = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;">
  <p style="margin:0 0 8px 0;">Ricevi questa email perch&eacute; hai attivato le comunicazioni marketing su <a href="${APP_URL}" style="color:#0d9488;text-decoration:underline;">Forfettino</a>.</p>
  <p style="margin:0 0 4px 0;">
    <a href="${APP_URL}/impostazioni" style="color:#0d9488;text-decoration:underline;">Gestisci preferenze email</a> &middot;
    <a href="${APP_URL}/privacy-policy" style="color:#0d9488;text-decoration:underline;">Privacy Policy</a>
  </p>
  <p style="margin:8px 0 0 0;font-size:11px;color:#94a3b8;">Per disiscriverti, disattiva &ldquo;Email di marketing&rdquo; nelle <a href="${APP_URL}/impostazioni" style="color:#94a3b8;text-decoration:underline;">Impostazioni &gt; Privacy e Dati &gt; Consensi</a>.</p>
</div>`;

    const htmlBody = rawHtmlBody + gdprFooter;

    // ── Consent check: filter only users with marketing_email_consent = true ──
    // Look up profiles by email (auth.users email → profiles via user_id)
    // We need to join auth email → filter by consent
    const { data: consentedProfiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("marketing_email_consent", true)
      .eq("is_internal", false);

    if (profilesError) {
      console.error("Failed to query profiles:", profilesError);
      return jsonResponse(req, { error: "Failed to check recipient consent" }, 500);
    }

    // Get emails for consented users from auth.users
    const consentedUserIds = new Set((consentedProfiles ?? []).map((p: any) => p.user_id));

    // Build set of consented user emails by cross-referencing auth.users
    const consentedEmailSet = new Set<string>();

    // Fetch auth users page by page to find emails for consented user_ids
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: pageData, error: usersError } = await serviceClient.auth.admin.listUsers({ page, perPage });
      if (usersError) {
        console.error("Failed to list users:", usersError);
        return jsonResponse(req, { error: "Failed to verify recipient consent" }, 500);
      }
      const users = pageData?.users ?? [];
      for (const u of users) {
        if (consentedUserIds.has(u.id) && u.email) {
          consentedEmailSet.add(u.email.toLowerCase());
        }
      }
      if (users.length < perPage) break;
      page++;
    }

    // ── Send emails to each consented recipient ──
    const results: RecipientResult[] = [];

    for (const email of recipientEmails) {
      // Check consent
      if (!consentedEmailSet.has(email)) {
        results.push({ email, status: "skipped", error: "No email consent" });
        continue;
      }

      // Send via Resend API
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Forfettino <noreply@forfettino.it>",
            to: email,
            subject,
            html: htmlBody,
            ...(textBody ? { text: textBody } : {}),
            headers: {
              "List-Unsubscribe": `<${APP_URL}/impostazioni>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });

        const resendData = await resendResponse.json();

        if (!resendResponse.ok) {
          console.error(`Resend error for ${email.replace(/(.).*(@.*)/, "$1***$2")}:`, resendData);
          results.push({
            email,
            status: "error",
            error: resendData.message || `Resend API error (${resendResponse.status})`,
          });
          continue;
        }

        results.push({ email, status: "sent", id: resendData.id });
      } catch (sendErr) {
        console.error(`Failed to send to ${email.replace(/(.).*(@.*)/, "$1***$2")}:`, sendErr);
        results.push({ email, status: "error", error: "Network error sending email" });
      }
    }

    const summary = {
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    console.log(`Email batch complete: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.errors} errors`);

    return jsonResponse(req, { success: true, results, summary });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
