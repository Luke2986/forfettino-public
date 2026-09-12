import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { renderDeadlineReminderEmail } from "../_shared/email-templates/deadline-reminder.ts";
import {
  REMINDER_THRESHOLDS,
  selectSchedulesInThreshold,
  filterByPrefs,
  filterSendable,
  mapToDeadlineEmailInput,
  type TaxScheduleLike,
  type NotificationPrefs,
} from "../_shared/deadline-email-logic.ts";
import { signUnsubscribeToken } from "../_shared/unsubscribe-token.ts";
import {
  buildCapturePayload,
  buildDeadlineEmailSentProps,
  capturePostHog,
  DEFAULT_POSTHOG_HOST,
} from "../_shared/posthog-server.ts";

// Story 84-3: invia l'email PERSONALIZZATA di promemoria scadenza (importo reale rata),
// onorando le preferenze (master/scadenze/scadenze_email), MAI marketing_consent/newsletter.
// Auth DUALE come send-waitlist-nurture: POST con X-Cron-Secret==CRON_SECRET (cron 84-8)
// OPPURE admin JWT (one-shot 84-4). Idempotente (deadline_email_sent), loggato (email_log),
// dry-runnable, resiliente per-destinatario.

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
      "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function maskEmail(email: string): string {
  return email.replace(/(.).*(@.*)/, "$1***$2");
}

/** Today nel fuso Europe/Rome come "YYYY-MM-DD". */
function todayRome(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

/** today + n giorni → "YYYY-MM-DD" (timezone-safe, parse local-time). */
function addDaysISO(todayISO: string, n: number): string {
  const d = new Date(`${todayISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface RequestBody {
  dryRun?: boolean;
  thresholds?: number[];
  userIds?: string[];
  todayISO?: string;
  /**
   * 84-10: bypassa il filtro per-utente delle soglie (`reminder_thresholds`). Lo settano
   * SOLO gli invii admin espliciti (one-shot 84-4 + self-test 84-11) che passano soglie
   * arbitrarie per coprire/diagnosticare una rata specifica. Il cron 84-8 (body `{}`) lo
   * lascia assente → il filtro per-utente si applica. La guard di canale resta sempre attiva.
   */
  ignoreUserThresholds?: boolean;
}

interface AuthResult {
  ok: boolean;
  via?: "cron" | "admin";
  adminUserId?: string;
  status?: number;
  error?: string;
}

async function authenticate(
  req: Request,
  serviceClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
): Promise<AuthResult> {
  // Via cron: X-Cron-Secret == CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const requestSecret = req.headers.get("X-Cron-Secret");
  if (requestSecret) {
    if (!cronSecret) return { ok: false, status: 500, error: "CRON_SECRET not configured" };
    if (requestSecret === cronSecret) return { ok: true, via: "cron" };
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  // Via admin JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, status: 401, error: "Missing authorization" };

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const tokenJwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await anonClient.auth.getUser(tokenJwt);
  if (userError || !user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: isAdmin, error: roleError } = await serviceClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError) return { ok: false, status: 500, error: "Failed to verify admin status" };
  if (!isAdmin) return { ok: false, status: 403, error: "Forbidden: admin access required" };

  return { ok: true, via: "admin", adminUserId: user.id };
}

interface PrefsLoad {
  prefs: Map<string, NotificationPrefs>;
  ok: boolean;
}

/**
 * Carica le preferenze per gli utenti dati. `ok=false` segnala che la QUERY è
 * FALLITA (non che gli utenti non hanno riga) → il chiamante fa fail-closed (M1):
 * su un canale email di servizio con opt-out, un errore di lettura del consenso
 * NON deve tradursi in invio. Utente senza riga (query OK) → DEFAULT_PREFS a valle.
 */
async function loadPrefsMap(
  serviceClient: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<PrefsLoad> {
  const map = new Map<string, NotificationPrefs>();
  if (userIds.length === 0) return { prefs: map, ok: true };
  const { data, error } = await serviceClient
    .from("user_notification_settings")
    .select("user_id, master_enabled, scadenze_enabled, scadenze_email_enabled, reminder_thresholds")
    .in("user_id", userIds);
  if (error) {
    console.error("Error loading notification settings:", error);
    return { prefs: map, ok: false }; // M1: consenso ignoto → fail-closed
  }
  for (const row of data ?? []) {
    // 84-10: `reminder_thresholds` è NOT NULL DEFAULT '{30,7,3,0}', ma fallback difensivo
    // al superset cron se null/assente (riga pre-migration mai aggiornata).
    const rawThresholds = row.reminder_thresholds as number[] | null;
    map.set(row.user_id as string, {
      master_enabled: row.master_enabled as boolean,
      scadenze_enabled: row.scadenze_enabled as boolean,
      scadenze_email_enabled: row.scadenze_email_enabled as boolean,
      reminder_thresholds:
        Array.isArray(rawThresholds) && rawThresholds.length > 0
          ? rawThresholds
          : [30, 7, 3, 0],
    });
  }
  return { prefs: map, ok: true };
}

/**
 * Esegue `worker` su `items` con concorrenza limitata a `limit` (pool a slot fissi),
 * preservando l'ordine dei risultati. Evita N+1 sequenziale e il timeout della Edge
 * Function quando una scadenza di massa (30/06, 30/11) porta l'intera coorte in una
 * sola invocazione (M2). Un worker che lancia NON interrompe gli altri slot.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runSlot() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const slots = Array.from({ length: Math.min(limit, items.length) }, () => runSlot());
  await Promise.all(slots);
  return results;
}

// Concorrenza del batch: bilancia wall-clock EF vs rate-limit Resend/auth.admin.
const SEND_CONCURRENCY = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const unsubSecret = Deno.env.get("UNSUBSCRIBE_SECRET");
  // 84-6: PostHog server-side capture (deadline_email_sent). Key PUBBLICA-per-design
  // (phc_…, già nel bundle client) passata come secret Deno. Se assente → skip silenzioso:
  // l'invio email NON deve MAI dipendere da PostHog.
  const posthogKey = Deno.env.get("POSTHOG_PROJECT_KEY");
  const posthogHost = Deno.env.get("POSTHOG_HOST") || DEFAULT_POSTHOG_HOST;

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(req, { error: "Service not configured" }, 500);
  }
  if (!unsubSecret) {
    return jsonResponse(req, { error: "UNSUBSCRIBE_SECRET not configured" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // ── Auth duale ──
  const auth = await authenticate(req, serviceClient, supabaseUrl, anonKey);
  if (!auth.ok) return jsonResponse(req, { error: auth.error }, auth.status ?? 401);

  // ── Body ──
  let body: RequestBody = {};
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const dryRun = body.dryRun === true;
  const ignoreUserThresholds = body.ignoreUserThresholds === true;
  const thresholds =
    Array.isArray(body.thresholds) && body.thresholds.length > 0
      ? body.thresholds.filter((n) => Number.isInteger(n))
      : [...REMINDER_THRESHOLDS];
  const todayISO = body.todayISO && /^\d{4}-\d{2}-\d{2}$/.test(body.todayISO)
    ? body.todayISO
    : todayRome();
  const userFilter = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : null;

  // ── Query rate non pagate in soglia ──
  const targetDates = [...new Set(thresholds.map((t) => addDaysISO(todayISO, t)))];

  let q = serviceClient
    .from("tax_schedule")
    .select("id, user_id, bucket, due_date, status, total_expected, total_paid")
    .neq("status", "paid")
    .in("due_date", targetDates);
  if (userFilter && userFilter.length > 0) q = q.in("user_id", userFilter);

  const { data: rows, error: schedErr } = await q;
  if (schedErr) {
    console.error("Error querying tax_schedule:", schedErr);
    return jsonResponse(req, { error: "Failed to query schedules" }, 500);
  }

  const candidates = selectSchedulesInThreshold(
    (rows ?? []) as TaxScheduleLike[],
    todayISO,
    thresholds,
  );

  if (candidates.length === 0) {
    return jsonResponse(req, {
      dryRun,
      today: todayISO,
      thresholds,
      candidates: 0,
      sent: 0,
      message: "Nessuna rata non pagata in soglia",
    });
  }

  // ── Preferenze (fail-closed su errore query — M1) ──
  const uniqueUserIds = [...new Set(candidates.map((c) => c.schedule.user_id))];
  const { prefs: prefsMap, ok: prefsOk } = await loadPrefsMap(serviceClient, uniqueUserIds);
  if (!prefsOk) {
    // Consenso non leggibile → non inviamo nulla (mai fail-open su email di servizio).
    return jsonResponse(req, { error: "Failed to load notification preferences" }, 500);
  }
  const { eligible, skippedPrefs } = filterByPrefs(candidates, prefsMap, prefsOk, ignoreUserThresholds);
  const allowedUserIds = [...new Set(eligible.map((c) => c.schedule.user_id))];

  // ── Email (auth.users) + first_name/analytics_consent (profiles), concorrente (M2) ──
  const emailMap = new Map<string, string>();
  const nameMap = new Map<string, string | undefined>();
  // 84-6: consenso analytics per-utente. `deadline_email_sent` è keyed by user.id (PII) →
  // emesso SOLO se analytics_consent === true (gating AC#4). Riusa la select profiles esistente.
  const consentMap = new Map<string, boolean>();
  await mapWithConcurrency(allowedUserIds, SEND_CONCURRENCY, async (uid) => {
    const { data: u, error: uErr } = await serviceClient.auth.admin.getUserById(uid);
    if (!uErr && u?.user?.email) emailMap.set(uid, u.user.email);
  });
  if (allowedUserIds.length > 0) {
    const { data: profs } = await serviceClient
      .from("profiles")
      .select("user_id, first_name, analytics_consent")
      .in("user_id", allowedUserIds);
    for (const p of profs ?? []) {
      nameMap.set(p.user_id as string, (p.first_name as string | null) ?? undefined);
      consentMap.set(p.user_id as string, (p.analytics_consent as boolean | null) === true);
    }
  }

  // ── Dedup pre-invio ──
  // NB idempotenza: la guard è SELECT→send→INSERT (TOCTOU). È corretta SOLO con un
  // singolo runner: il cron 84-8 deve restare a invocazione singola giornaliera (no
  // fan-out concorrente sullo stesso intervallo), altrimenti due run possono inviare
  // entrambi prima dell'INSERT (il UNIQUE blocca la 2ª riga, non la 2ª email).
  const scheduleIds = [...new Set(eligible.map((c) => c.schedule.id))];
  const dedupSet = new Set<string>();
  if (scheduleIds.length > 0) {
    const { data: sent } = await serviceClient
      .from("deadline_email_sent")
      .select("user_id, tax_schedule_id, threshold")
      .in("tax_schedule_id", scheduleIds);
    for (const r of sent ?? []) {
      dedupSet.add(`${r.user_id}:${r.tax_schedule_id}:${r.threshold}`);
    }
  }

  // Lavoro effettivo: eligibili, con email, non già inviati.
  const work = filterSendable(eligible, new Set(emailMap.keys()), dedupSet);

  // ── DRY-RUN: preview, nessun invio/dedup/log ──
  if (dryRun) {
    const sample = work[0]
      ? (() => {
          const uid = work[0].schedule.user_id;
          const input = mapToDeadlineEmailInput({
            schedule: work[0].schedule,
            threshold: work[0].threshold,
            todayISO,
            recipientName: nameMap.get(uid),
            appUrl: APP_URL,
            unsubscribeUrl: `${supabaseUrl}/functions/v1/unsubscribe-scadenze?token=PREVIEW`,
          });
          const rendered = renderDeadlineReminderEmail(input);
          return {
            to: maskEmail(emailMap.get(uid)!),
            subject: rendered.subject,
            htmlLength: rendered.html.length,
            textPreview: rendered.text.slice(0, 200),
          };
        })()
      : null;

    return jsonResponse(req, {
      dryRun: true,
      today: todayISO,
      thresholds,
      candidates: candidates.length,
      eligible: eligible.length,
      skipped_prefs: skippedPrefs,
      recipients: work.length,
      recipientsPreview: work.slice(0, 20).map((c) => ({
        to: maskEmail(emailMap.get(c.schedule.user_id)!),
        bucket: c.schedule.bucket,
        threshold: c.threshold,
        amountEuro: c.schedule.total_expected,
      })),
      sample,
    });
  }

  // ── INVIO REALE ──
  if (!resendApiKey) {
    return jsonResponse(req, { error: "RESEND_API_KEY not configured" }, 500);
  }

  const batchId = crypto.randomUUID();

  // Invio concorrente (M2): pool a slot fissi invece di loop sequenziale. Ogni worker
  // è isolato (try/catch) → l'errore su un destinatario non interrompe gli altri (AC#9).
  const outcomes = await mapWithConcurrency(work, SEND_CONCURRENCY, async (c) => {
    const uid = c.schedule.user_id;
    const email = emailMap.get(uid)!;
    let subject = "";
    try {
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe-scadenze?token=${await signUnsubscribeToken(uid, unsubSecret)}`;
      const input = mapToDeadlineEmailInput({
        schedule: c.schedule,
        threshold: c.threshold,
        todayISO,
        recipientName: nameMap.get(uid),
        appUrl: APP_URL,
        unsubscribeUrl,
      });
      const rendered = renderDeadlineReminderEmail(input);
      subject = rendered.subject;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Forfettino <noreply@forfettino.it>",
          to: email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          // Resend API: tags è array di {name, value} (value ASCII a-z0-9_-).
          tags: [
            { name: "category", value: "deadline_reminder" },
            { name: "user_id", value: uid },
            { name: "threshold", value: String(c.threshold) },
          ],
        }),
      });

      const resendData = await resendResponse.json();

      if (resendResponse.ok) {
        // Dedup SOLO dopo invio OK (un fallimento non "brucia" la soglia).
        const { error: dedupErr } = await serviceClient.from("deadline_email_sent").insert({
          user_id: uid,
          tax_schedule_id: c.schedule.id,
          threshold: c.threshold,
          resend_message_id: resendData.id ?? null,
        });
        // L1: se l'insert dedup fallisce, l'email è già partita ma la guard non è scritta
        // → il prossimo run potrebbe duplicare. Logghiamo per renderlo osservabile.
        if (dedupErr) {
          console.error(`Dedup insert failed for ${maskEmail(email)} (possibile duplicato al prossimo run):`, dedupErr);
        }
        // Log invio. sent_by = user_id destinatario (email di servizio, nessun admin-attore
        // per il cron — vedi story §email_log opzione A).
        const { error: logErr } = await serviceClient.from("email_log").insert({
          recipient_email: email,
          subject: rendered.subject,
          resend_message_id: resendData.id ?? null,
          status: "sent",
          batch_id: batchId,
          sent_by: uid,
        });
        if (logErr) console.error(`email_log insert failed for ${maskEmail(email)}:`, logErr);

        // 84-6: evento PostHog `deadline_email_sent` — DOPO invio OK + dedup/log, SOLO se
        // analytics_consent === true (gating AC#4) e key presente. Best-effort/fire-and-forget:
        // capturePostHog non rigetta MAI (try/catch totale), quindi l'await non può rompere il
        // batch né l'invio (l'email è già partita a questo punto). Skip silenzioso altrimenti.
        if (posthogKey && consentMap.get(uid) === true) {
          const campaign = `scadenza_${c.schedule.bucket}_${c.threshold}`;
          await capturePostHog(
            buildCapturePayload({
              apiKey: posthogKey,
              event: "deadline_email_sent",
              distinctId: uid,
              properties: buildDeadlineEmailSentProps({
                campaign,
                bucket: c.schedule.bucket,
                threshold: c.threshold,
                daysUntil: c.threshold, // threshold == daysUntil della soglia (per costruzione)
                batchId,
              }),
              timestamp: new Date().toISOString(),
            }),
            posthogHost,
          );
        }
        return "sent" as const;
      } else {
        console.error(`Resend error for ${maskEmail(email)}:`, resendData);
        const { error: logErr } = await serviceClient.from("email_log").insert({
          recipient_email: email,
          subject,
          status: "failed",
          error_message: resendData?.message ?? `Resend API error (${resendResponse.status})`,
          batch_id: batchId,
          sent_by: uid,
        });
        if (logErr) console.error(`email_log insert failed for ${maskEmail(email)}:`, logErr);
        return "failed" as const;
      }
    } catch (err) {
      console.error(`Send error for ${maskEmail(email)}:`, err);
      try {
        await serviceClient.from("email_log").insert({
          recipient_email: email,
          subject: subject || "(scadenza)",
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
          batch_id: batchId,
          sent_by: uid,
        });
      } catch (_logErr) {
        // logging best-effort: non interrompere il batch
      }
      return "failed" as const;
    }
  });

  const sent = outcomes.filter((o) => o === "sent").length;
  const failed = outcomes.filter((o) => o === "failed").length;

  return jsonResponse(req, {
    dryRun: false,
    today: todayISO,
    thresholds,
    batchId,
    candidates: candidates.length,
    eligible: eligible.length,
    skipped_prefs: skippedPrefs,
    sent,
    failed,
  });
});
