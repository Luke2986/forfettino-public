import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe-token.ts";

// Story 84-3 (AC#11): disiscrizione REALE one-click dal canale email scadenze.
// - GET  (click umano)         → verifica token → flip → pagina HTML di conferma.
// - POST (mailer RFC 8058)     → stesso token nel querystring, body List-Unsubscribe=One-Click
//                                → stesso flip → 200. (send-email/nurture hanno header
//                                cosmetico GET-only/SPA: qui il POST è onorato davvero.)
// Token firmato HMAC (opaco, no PII in chiaro), verificato server-side con UNSUBSCRIBE_SECRET.
// Il flip avviene via RPC unsubscribe_scadenze(p_user_id) (service_role), idempotente.

const ALLOWED_ORIGINS = [
  "https://forfettino.lovable.app",
  "https://forfettino.it",
  "http://localhost:5173",
  "http://localhost:8080",
];

const APP_URL = "https://forfettino.it";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function htmlResponse(req: Request, html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "text/html; charset=utf-8" },
  });
}

function page(title: string, body: string, color: string): string {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:40px 20px;background:#f8fafc;">
  <div style="max-width:420px;margin:0 auto;">
    <h1 style="color:${color};font-size:22px;">${title}</h1>
    ${body}
    <p style="margin-top:24px;"><a href="${APP_URL}" style="color:#0d9488;">Torna a Forfettino</a></p>
  </div>
</body></html>`;
}

const invalidPage = (req: Request) =>
  htmlResponse(
    req,
    page("Link non valido", `<p style="color:#475569;">Il link di disiscrizione non è valido o è scaduto.</p>`, "#ef4444"),
    400,
  );

const errorPage = (req: Request) =>
  htmlResponse(
    req,
    page("Errore", `<p style="color:#475569;">Si è verificato un errore. Riprova più tardi.</p>`, "#ef4444"),
    500,
  );

const confirmPage = (req: Request) =>
  htmlResponse(
    req,
    page(
      "✅ Disiscrizione confermata",
      `<p style="color:#475569;font-size:15px;line-height:1.6;">Non riceverai più email di promemoria sulle tue scadenze fiscali.<br>
      Continuerai a vedere le scadenze <strong>in app</strong>: puoi riattivare le email quando vuoi dalle Impostazioni.</p>`,
      "#0d9488",
    ),
  );

async function processUnsubscribe(
  req: Request,
  token: string,
  serviceClient: ReturnType<typeof createClient>,
  secret: string,
): Promise<Response> {
  const userId = await verifyUnsubscribeToken(token, secret);
  if (!userId) return invalidPage(req);

  const { error } = await serviceClient.rpc("unsubscribe_scadenze", { p_user_id: userId });
  if (error) {
    console.error("unsubscribe_scadenze RPC error:", error);
    return errorPage(req);
  }
  // Idempotente: anche se già disiscritto (RPC ritorna false), confermiamo comunque.
  return confirmPage(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return errorPage(req);
  }
  if (!secret) {
    console.error("UNSUBSCRIBE_SECRET not configured");
    return errorPage(req);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  // GET (click umano) e POST (mailer One-Click RFC 8058): stesso token, stesso flip.
  if (req.method === "GET" || req.method === "POST") {
    return processUnsubscribe(req, token, serviceClient, secret);
  }

  return htmlResponse(req, page("Metodo non consentito", "", "#ef4444"), 405);
});
