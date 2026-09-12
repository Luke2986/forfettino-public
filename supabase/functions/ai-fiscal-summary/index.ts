import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// --- Rate limiting (in-memory sliding window) ---
const RATE_LIMIT_MAX = 10; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

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

interface FiscalSummaryRequest {
  incassiYTD: number;
  taxableAmount: number;
  taxAmount: number;
  inpsTotale: number;
  totalWithholding: number;
  spendable: number;
  bufferAmount: number;
  sogliaPercentuale: number;
  currentYear: number;
  upcomingDeadlines: Array<{
    bucket: string;
    dueDate: string;
    remaining: number;
  }>;
  fiscalPeakYearTotal: number;
}

const SYSTEM_PROMPT = `Sei un assistente fiscale italiano esperto in regime forfettario.
Riassumi la situazione fiscale dell'utente in 3-4 frasi semplici e chiare.
Usa un tono amichevole ma professionale. Usa il "tu".
Se ci sono scadenze imminenti, menzionale brevemente.
Non dare consigli di investimento o suggerimenti su come evitare le tasse.
Rispondi SOLO in italiano. Non usare markdown, solo testo semplice.`;

function buildUserPrompt(data: FiscalSummaryRequest): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  let prompt = `Ecco la mia situazione fiscale ${data.currentYear}:
- Incassi totali: ${fmt(data.incassiYTD)}
- Imponibile: ${fmt(data.taxableAmount)}
- Imposta sostitutiva: ${fmt(data.taxAmount)}
- INPS totale: ${fmt(data.inpsTotale)}
- Totale da accantonare (tasse + INPS): ${fmt(data.totalWithholding)}
- Netto spendibile: ${fmt(data.spendable)}
- Buffer di sicurezza: ${fmt(data.bufferAmount)}
- Soglia 85k forfettario: ${data.sogliaPercentuale.toFixed(0)}% utilizzato`;

  if (data.upcomingDeadlines.length > 0) {
    prompt += "\n- Prossime scadenze:";
    for (const d of data.upcomingDeadlines) {
      prompt += `\n  - ${d.bucket} il ${d.dueDate}: ${fmt(d.remaining)} da pagare`;
    }
  }

  if (data.fiscalPeakYearTotal > 0) {
    prompt += `\n- Proiezione obblighi anno prossimo: ${fmt(data.fiscalPeakYearTotal)}`;
  }

  prompt += "\n\nFai un breve riepilogo della mia situazione.";
  return prompt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Rate limit per user
    if (isRateLimited(user.id)) {
      return new Response(
        JSON.stringify({ error: "Troppe richieste. Riprova tra poco." }),
        {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Verify PRO subscription server-side
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Check admin_override_tier first, then subscriptions table
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("admin_override_tier")
      .eq("user_id", user.id)
      .single();

    const overrideTier = profile?.admin_override_tier;
    let isPro = overrideTier === "pro";

    if (!isPro && overrideTier !== "free") {
      // No override — check actual Stripe subscription
      const { data: sub } = await serviceClient
        .from("subscriptions")
        .select("tier")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      isPro = sub?.tier === "pro";
    }

    if (!isPro) {
      return new Response(
        JSON.stringify({ error: "Questa funzionalità è riservata agli utenti PRO" }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const body: FiscalSummaryRequest = await req.json();

    // Build prompts
    const userPrompt = buildUserPrompt(body);

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        {
          status: 502,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const geminiData = await geminiResponse.json();
    const summary =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!summary) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        {
          status: 502,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ summary }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("ai-fiscal-summary error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
});
