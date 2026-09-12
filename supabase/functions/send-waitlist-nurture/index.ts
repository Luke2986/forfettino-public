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
      "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const APP_URL = "https://forfettino.it";
const BATCH_LIMIT = 50;

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function htmlResponse(req: Request, html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "text/html; charset=utf-8" },
  });
}

// --- Delta logic ---
// KEEP IN SYNC with src/lib/nurture-delta.ts

type EmailType = "nurture_t14" | "nurture_t7" | "nurture_t48h";

function getEmailTypeForDelta(deltaDays: number): EmailType | null {
  if (deltaDays >= 12.5 && deltaDays <= 15.5) return "nurture_t14";
  if (deltaDays >= 5.5 && deltaDays <= 8.5) return "nurture_t7";
  if (deltaDays >= 1.0 && deltaDays <= 3.0) return "nurture_t48h";
  return null;
}

function todayRome(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

function getDeltaDays(startsAt: string): number {
  // Use Europe/Rome timezone for consistency with Italian users
  const nowRome = new Date(`${todayRome()}T12:00:00`); // noon to avoid DST edge
  const start = new Date(startsAt);
  return (start.getTime() - nowRome.getTime()) / (1000 * 60 * 60 * 24);
}

// --- Email templates ---

function emailWrapper(title: string, body: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
<div style="max-width:480px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;">
  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #e2e8f0;">
    <span style="font-size:24px;font-weight:700;color:#0d9488;">Forfettino</span>
  </div>
  <div style="padding:32px 24px;">
    <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
    ${body}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
    <p style="margin:0 0 4px;"><a href="${unsubscribeUrl}" style="color:#94a3b8;">Non voglio più ricevere queste email</a></p>
    <p style="margin:0;">Resti comunque nella waitlist PRO.</p>
    <p style="margin:8px 0 0;"><a href="${APP_URL}/privacy-policy" style="color:#94a3b8;">Privacy Policy</a></p>
  </div>
</div>
</body>
</html>`;
}

function buildNurtureT14Html(name: string, _referralLink: string, unsubscribeUrl: string): string {
  const body = `
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Ciao ${name},
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Mancano <strong>2 settimane</strong> all'apertura di Forfettino PRO. Ecco cosa troverai:
    </p>
    <ul style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 16px;padding-left:20px;">
      <li>📊 <strong>Export CSV</strong> — scarica i tuoi incassi per il commercialista</li>
      <li>👥 <strong>Report Clienti</strong> — analisi fatturato per cliente con alert concentrazione</li>
      <li>📈 <strong>Benchmark Tariffe</strong> — confronta le tue tariffe con altri freelancer</li>
      <li>✅ <strong>Task Board</strong> — pianifica le attività con Kanban e scadenze</li>
      <li>💰 <strong>Budget Allocazione</strong> — visualizza dove vanno i tuoi soldi</li>
      <li>📅 <strong>Multi-Anno</strong> — storico fiscale completo anno per anno</li>
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/pro-presto" style="display:inline-block;padding:12px 32px;background:#0d9488;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
        Scopri di più
      </a>
    </div>`;
  return emailWrapper("Cosa troverai in Forfettino PRO", body, unsubscribeUrl);
}

function buildNurtureT7Html(name: string, referralLink: string, invitesCount: number, unsubscribeUrl: string): string {
  const invitesText = invitesCount > 0
    ? `Hai già invitato <strong>${invitesCount} ${invitesCount === 1 ? "collega" : "colleghi"}</strong>. Ogni invito ti fa salire in coda!`
    : "Invita un collega per salire in coda e ottenere accesso prioritario.";

  const body = `
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Ciao ${name},
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Manca <strong>1 settimana</strong> all'apertura. Parliamo di prezzo.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Il pricing di Forfettino PRO è stato definito sulla base del feedback reale di freelancer come te (survey Van Westendorp). Sarà accessibile, con opzione <strong>mensile</strong> e <strong>annuale</strong>.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${invitesText}
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${referralLink}" style="display:inline-block;padding:12px 32px;background:#0d9488;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
        Invita un collega
      </a>
    </div>`;
  return emailWrapper("Parliamo di prezzo", body, unsubscribeUrl);
}

function buildNurtureT48hHtml(name: string, referralLink: string, hasBoost: boolean, unsubscribeUrl: string): string {
  const earlyAccessNote = hasBoost
    ? `<p style="color:#0d9488;font-size:15px;line-height:1.6;margin:0 0 16px;font-weight:600;">
        🎯 Hai accesso early grazie ai tuoi inviti — sarai tra i primi a entrare!
      </p>`
    : "";

  const body = `
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Ciao ${name},
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      <strong>Ci siamo.</strong> Tra 48 ore si aprono le porte di Forfettino PRO.
    </p>
    ${earlyAccessNote}
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      I posti sono limitati. Tieni d'occhio la tua email — riceverai il link per accedere non appena si apre la finestra.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Segna la data in calendario per non perdertelo!
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/pro-presto" style="display:inline-block;padding:12px 32px;background:#0d9488;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
        Scopri i dettagli
      </a>
    </div>`;
  return emailWrapper("Ci siamo — tra 48 ore", body, unsubscribeUrl);
}

function getSubjectForType(emailType: EmailType): string {
  switch (emailType) {
    case "nurture_t14": return "Cosa troverai in Forfettino PRO";
    case "nurture_t7": return "Parliamo di prezzo — Forfettino PRO";
    case "nurture_t48h": return "Ci siamo — tra 48 ore si apre Forfettino PRO";
  }
}

// --- Unsubscribe handler ---

async function handleUnsubscribe(req: Request, token: string, serviceClient: ReturnType<typeof createClient>): Promise<Response> {
  if (!token || typeof token !== "string" || token.length < 8) {
    return htmlResponse(req, `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head><body style="font-family:system-ui;text-align:center;padding:40px;">
      <h1 style="color:#ef4444;">Link non valido</h1>
      <p>Il link di disiscrizione non è valido.</p>
    </body></html>`, 400);
  }

  const { data, error } = await serviceClient.rpc("unsubscribe_waitlist_nurture", { p_token: token });

  if (error) {
    console.error("Unsubscribe RPC error:", error);
    return htmlResponse(req, `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head><body style="font-family:system-ui;text-align:center;padding:40px;">
      <h1 style="color:#ef4444;">Errore</h1>
      <p>Si è verificato un errore. Riprova più tardi.</p>
    </body></html>`, 500);
  }

  return htmlResponse(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head><body style="font-family:system-ui;text-align:center;padding:40px;">
    <div style="max-width:400px;margin:0 auto;">
      <h1 style="color:#0d9488;">✅ Disiscrizione confermata</h1>
      <p style="color:#475569;font-size:15px;line-height:1.6;">
        Non riceverai più email sulla waitlist PRO.<br>
        <strong>Resti comunque in lista</strong> — quando apriremo le porte, potrai accedere normalmente.
      </p>
      <p style="margin-top:24px;"><a href="${APP_URL}" style="color:#0d9488;">Torna a Forfettino</a></p>
    </div>
  </body></html>`);
}

// --- Main cron handler ---

interface WaitlistRecipient {
  waitlist_id: string;
  email: string;
  display_name: string | null;
  referral_token: string;
  invites_count: number;
  queue_position_boost: number;
}

async function handleCronTrigger(req: Request, serviceClient: ReturnType<typeof createClient>, resendApiKey: string, functionUrl: string) {
  // Find active launch windows with future starts_at
  const { data: windows, error: winError } = await serviceClient
    .from("launch_windows")
    .select("id, starts_at")
    .eq("is_active", true)
    .gt("starts_at", new Date().toISOString());

  if (winError) {
    console.error("Error fetching launch windows:", winError);
    return jsonResponse(req, { error: "Failed to fetch launch windows" }, 500);
  }

  if (!windows || windows.length === 0) {
    return jsonResponse(req, { sent: 0, message: "No active future launch windows" });
  }

  let totalSent = 0;
  let totalSkippedDedup = 0;
  let totalSkippedUnsubscribed = 0;
  let totalErrors = 0;
  const windowResults: Record<string, { email_type: string; sent: number }> = {};

  for (const win of windows) {
    const deltaDays = getDeltaDays(win.starts_at);
    const emailType = getEmailTypeForDelta(deltaDays);

    if (!emailType) {
      continue; // Not within any nurture window
    }

    // Count unsubscribed members for reporting
    const { count: unsubCount } = await serviceClient
      .from("pro_waitlist")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null)
      .not("unsubscribed_at", "is", null);

    totalSkippedUnsubscribed += unsubCount ?? 0;

    // Get active waitlist members (not revoked, not unsubscribed, with referral_token)
    const { data: waitlistMembers, error: wlError } = await serviceClient
      .from("pro_waitlist")
      .select("id, email, referral_token, invites_count, queue_position_boost, user_id")
      .is("revoked_at", null)
      .is("unsubscribed_at", null)
      .not("referral_token", "is", null)
      .limit(BATCH_LIMIT + 50); // fetch extra to account for dedup filtering

    if (wlError) {
      console.error("Error fetching waitlist members:", wlError);
      totalErrors++;
      continue;
    }

    if (!waitlistMembers || waitlistMembers.length === 0) {
      continue;
    }

    // Get already-sent records for dedup
    const { data: alreadySent } = await serviceClient
      .from("waitlist_email_sent")
      .select("waitlist_id")
      .eq("window_id", win.id)
      .eq("email_type", emailType);

    const sentSet = new Set((alreadySent || []).map((r: { waitlist_id: string }) => r.waitlist_id));

    // Filter out already sent
    const eligibleMembers = waitlistMembers.filter(
      (m: { id: string }) => !sentSet.has(m.id)
    );

    totalSkippedDedup += waitlistMembers.length - eligibleMembers.length;

    // Batch limit
    const batch = eligibleMembers.slice(0, BATCH_LIMIT);

    if (batch.length === 0) {
      continue;
    }

    // Fetch display names from profiles
    const userIds = batch.map((m: { user_id: string }) => m.user_id);
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name])
    );

    // Send emails
    let windowSent = 0;
    for (const member of batch) {
      const displayName = profileMap.get(member.user_id) || "Ciao";
      const referralLink = `${APP_URL}/pro-presto?wl=${member.referral_token}`;
      const unsubscribeUrl = `${functionUrl}?action=unsubscribe&token=${member.referral_token}`;

      let html: string;
      const subject = getSubjectForType(emailType);

      switch (emailType) {
        case "nurture_t14":
          html = buildNurtureT14Html(displayName, referralLink, unsubscribeUrl);
          break;
        case "nurture_t7":
          html = buildNurtureT7Html(displayName, referralLink, member.invites_count, unsubscribeUrl);
          break;
        case "nurture_t48h":
          html = buildNurtureT48hHtml(displayName, referralLink, member.queue_position_boost >= 2, unsubscribeUrl);
          break;
      }

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Forfettino <noreply@forfettino.it>",
            to: member.email,
            subject,
            html,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });

        const resendData = await resendResponse.json();

        if (resendResponse.ok) {
          // Record sent email for dedup
          await serviceClient
            .from("waitlist_email_sent")
            .insert({
              waitlist_id: member.id,
              email_type: emailType,
              window_id: win.id,
              resend_id: resendData.id || null,
            });

          windowSent++;
          totalSent++;
        } else {
          console.error(`Resend error for ${member.email.replace(/(.).*(@.*)/, "$1***$2")}:`, resendData);
          totalErrors++;
        }
      } catch (err) {
        console.error(`Send error for ${member.email.replace(/(.).*(@.*)/, "$1***$2")}:`, err);
        totalErrors++;
      }
    }

    if (eligibleMembers.length > BATCH_LIMIT) {
      console.log(`batch_partial, remaining: ${eligibleMembers.length - BATCH_LIMIT}`);
    }

    windowResults[win.id] = { email_type: emailType, sent: windowSent };
  }

  return jsonResponse(req, {
    sent: totalSent,
    skipped_dedup: totalSkippedDedup,
    skipped_unsubscribed: totalSkippedUnsubscribed,
    errors: totalErrors,
    windows: windowResults,
  });
}

// --- Entry point ---

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse(req, { error: "Service not configured" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);

  // GET: one-click unsubscribe from email link
  if (req.method === "GET" && url.searchParams.get("action") === "unsubscribe") {
    const token = url.searchParams.get("token") || "";
    return handleUnsubscribe(req, token, serviceClient);
  }

  // POST: cron trigger for batch send
  if (req.method === "POST") {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const requestSecret = req.headers.get("X-Cron-Secret");
    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return jsonResponse(req, { error: "CRON_SECRET not configured" }, 500);
    }
    if (requestSecret !== cronSecret) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return jsonResponse(req, { error: "RESEND_API_KEY not configured" }, 500);
    }

    const functionUrl = `${supabaseUrl}/functions/v1/send-waitlist-nurture`;
    return handleCronTrigger(req, serviceClient, resendApiKey, functionUrl);
  }

  return jsonResponse(req, { error: "Method not allowed" }, 405);
});
