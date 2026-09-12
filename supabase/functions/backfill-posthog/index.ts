// supabase/functions/backfill-posthog/index.ts
//
// Backfill + sync incrementale: Supabase `event_logs` -> PostHog.
//
// PERCHE': gli eventi wizard/onboarding/signup partono PRIMA del consenso
// Cookiebot (PostHog `identified_only`), quindi vengono bloccati a livello
// rete e NON arrivano a PostHog. Pero' `track()` li salva SEMPRE su
// `event_logs` (con user_id). Questa function li ripompa su PostHog server-side.
//
// MAPPING: PostHog fa identify(user.id) => distinct_id PostHog == event_logs.user_id.
//   - event        = event_logs.event_name
//   - distinct_id  = event_logs.user_id
//   - timestamp    = event_logs.created_at
//   - uuid         = event_logs.id   (=> PostHog deduplica: re-run safe)
//   - properties   = event_logs.props + marker { $source: "supabase_backfill" }
//
// SICUREZZA: usa la PROJECT API key PostHog (la stessa phc_ del frontend,
// VITE_POSTHOG_KEY) presa dai secrets. Niente chiavi nel codice.
//
// Invocazione:
//   - incrementale (cron): POST {}  → riparte dal cursore in posthog_backfill_state
//   - one-shot backfill:   POST { "since": "<ISO>" }  → NON tocca il cursore
//   - dry run:             POST { "dryRun": true }    → conta, non invia, non avanza
//
// CURSORE (migration 20260831120000): prima di questa modifica il cron passava
//   since = now() - 1 day ad ogni run, ogni 15 minuti, quindi rispediva la stessa
//   riga fino a 96 volte. La dedup uuid lato PostHog non ha retto e i duplicati
//   sono arrivati (wizard_step_entered 2,9x, signup_completed 2,9x). Ora lo stato
//   e' persistito e avanza solo dopo un invio riuscito.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─────────────────────────── CONFIG ───────────────────────────
// Solo gli eventi MANCANTI/spenti su PostHog: evita di duplicare quelli
// gia' sani lato client (income_created, add_income_*, aha_banner_*, ecc.).
// Metti BACKFILL_ALL = true SOLO se hai prima ripulito i duplicati lato PostHog.
const EVENT_ALLOWLIST = new Set<string>([
  "wizard_step_entered",
  "wizard_step_completed",
  "wizard_step_back",
  "wizard_abandoned",
  "wizard_completed",
  "wizard_draft_resumed",
  "wizard_draft_discarded",
  "signup_completed",
  "onboarding_completato",
  "first_login",
]);
const BACKFILL_ALL = false;
const PAGE_SIZE = 1000;
// Tabella a riga singola con l'avanzamento del sync (migration 20260831120000).
const STATE_TABLE = "posthog_backfill_state";
// Si riparte da cursore - 2 min: una riga puo' essere committata qualche secondo
// dopo il proprio created_at e altrimenti verrebbe saltata. Overlap 2 min invece
// delle 24 ore di prima.
const SAFETY_MARGIN_MS = 2 * 60 * 1000;
// Se la tabella di stato non e' raggiungibile (migration non applicata) si usa
// questa finestra invece di ripartire dal 1970 e rispedire l'intera storia.
const FALLBACK_LOOKBACK_MS = 60 * 60 * 1000;
// Tetto di pagine per run: impedisce a un loop che non avanza di girare all'infinito.
const MAX_PAGES = 200;
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST")
  ?? Deno.env.get("VITE_POSTHOG_HOST")
  ?? "https://eu.i.posthog.com";
// Project API key (phc_...): la stessa di ingestion del frontend (VITE_POSTHOG_KEY).
// NON la Personal API key. E' una key pubblica (gia' nel JS del frontend): solo
// /batch capture, non legge dati. Provo piu' nomi per ridurre setup su Lovable.
const POSTHOG_KEY = Deno.env.get("POSTHOG_PROJECT_KEY")
  ?? Deno.env.get("VITE_POSTHOG_KEY")
  ?? Deno.env.get("POSTHOG_KEY")
  ?? "";

// GDPR — DECISIONE DA CONFERMARE:
// pompare eventi identificati su PostHog server-side bypassa il gate Cookiebot.
// Se hai una colonna di consenso (es. profiles.analytics_consent), filtra qui.
// Default: nessun filtro (Luca = titolare del dato, prodotto proprio). Cambia se serve.
const CONSENT_FILTER = false; // true => richiede join con profiles.analytics_consent

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Gate a secret condiviso OBBLIGATORIO (fail-closed, stesso pattern di
  // send-deadline-reminder-email / send-waitlist-nurture): questa function gira in
  // service_role e legge event_logs bypassando RLS, quindi NON deve mai essere
  // invocabile senza secret. Se CRON_SECRET non e' configurato => 500 (fail-closed),
  // non porta pubblica. Le invocazioni manuali devono passare l'header X-Cron-Secret.
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  if (!CRON_SECRET) {
    return json({ error: "CRON_SECRET not configured" }, 500);
  }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    if (!POSTHOG_KEY) {
      return json({ error: "POSTHOG_PROJECT_KEY secret mancante" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dryRun === true;
    const manualSince: string | undefined = body?.since;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role: bypassa RLS
    );

    // ── Risoluzione del cursore ────────────────────────────────────────────
    // `since` esplicito = backfill manuale one-shot: legge da li' e NON tocca
    // lo stato persistito. Senza `since` si riparte dal cursore salvato.
    let storedCursor: string | null = null;
    let stateAvailable = false;
    let cursor: string;

    if (manualSince) {
      cursor = manualSince;
    } else {
      const { data: state, error: stateError } = await supabase
        .from(STATE_TABLE)
        .select("cursor")
        .eq("id", 1)
        .maybeSingle();

      if (stateError || !state?.cursor) {
        // Fail-safe: mai ripartire dal 1970, rispedirebbe tutta la storia.
        cursor = new Date(Date.now() - FALLBACK_LOOKBACK_MS).toISOString();
      } else {
        stateAvailable = true;
        storedCursor = state.cursor;
        cursor = new Date(Date.parse(state.cursor) - SAFETY_MARGIN_MS).toISOString();
      }
    }

    const cursor_start = cursor; // solo per la risposta diagnostica
    let totalRead = 0;
    let totalSent = 0;
    let pages = 0;
    // Avanza solo in avanti: il margine di sicurezza non deve far arretrare il
    // cursore salvato ad ogni run (altrimenti deriva indietro di 2 min per volta).
    let maxProcessed = storedCursor ?? cursor;
    let lastTs = cursor;

    // Salva l'avanzamento solo per il sync incrementale, solo in avanti e solo
    // dopo invii riusciti. Un backfill manuale (`since`) e un dry run non toccano
    // lo stato.
    const persistCursor = async () => {
      if (dryRun || manualSince || !stateAvailable) return;
      if (!(Date.parse(maxProcessed) > Date.parse(storedCursor!))) return;
      await supabase
        .from(STATE_TABLE)
        .update({ cursor: maxProcessed, updated_at: new Date().toISOString() })
        .eq("id", 1);
    };

    // Pagina per created_at crescente. MAX_PAGES e il guard sull'avanzamento
    // evitano un loop infinito se una pagina intera condivide lo stesso timestamp.
    while (pages < MAX_PAGES) {
      pages++;
      let q = supabase
        .from("event_logs")
        .select("id, user_id, event_name, props, created_at")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);

      if (!BACKFILL_ALL) {
        q = q.in("event_name", [...EVENT_ALLOWLIST]);
      }
      if (CONSENT_FILTER) {
        // Esempio: filtra agli utenti consenzienti. Adatta al tuo schema.
        // q = q.in("user_id", consentedUserIds)
      }

      const { data: rows, error } = await q;
      if (error) return json({ error: error.message, stage: "select" }, 500);
      if (!rows || rows.length === 0) break;

      totalRead += rows.length;

      const batch = rows
        .filter((r) => BACKFILL_ALL || EVENT_ALLOWLIST.has(r.event_name))
        .map((r) => ({
          event: r.event_name,
          distinct_id: r.user_id,
          timestamp: r.created_at,
          uuid: r.id, // idempotenza: PostHog deduplica su uuid
          properties: {
            ...(r.props ?? {}),
            $source: "supabase_backfill",
          },
        }));

      if (!dryRun && batch.length > 0) {
        const res = await fetch(`${POSTHOG_HOST}/batch/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: POSTHOG_KEY,
            // Solo per i backfill manuali di storia vecchia. Sul path incrementale
            // gli eventi hanno pochi minuti: mandarli come "historical" li instrada
            // sulla pipeline di migrazione, dove la dedup per uuid non si applica.
            ...(manualSince ? { historical_migration: true } : {}),
            batch,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          // Persiste quanto gia' spedito con successo prima di arrendersi, cosi'
          // il retry non ripete le pagine andate a buon fine.
          await persistCursor();
          return json({ error: `PostHog ${res.status}: ${txt}`, sentBefore: totalSent }, 502);
        }
        totalSent += batch.length;
      }

      lastTs = rows[rows.length - 1].created_at;
      if (!dryRun && Date.parse(lastTs) > Date.parse(maxProcessed)) {
        maxProcessed = lastTs;
      }
      if (lastTs === cursor) break; // pagina intera con lo stesso timestamp: niente progresso
      cursor = lastTs;
      if (rows.length < PAGE_SIZE) break; // ultima pagina
    }

    await persistCursor();

    return json({
      ok: true,
      dryRun,
      backfillAll: BACKFILL_ALL,
      mode: manualSince ? "manual" : "incremental",
      // false = tabella di stato non raggiungibile: si e' usata la finestra di
      // fallback e il cursore NON e' stato salvato. Va indagato.
      state_available: stateAvailable,
      cursor_from: cursor_start,
      cursor_to: (!dryRun && !manualSince && stateAvailable) ? maxProcessed : storedCursor,
      pages,
      truncated: pages >= MAX_PAGES,
      rows_read: totalRead,
      events_sent: totalSent,
      last_timestamp: lastTs,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
