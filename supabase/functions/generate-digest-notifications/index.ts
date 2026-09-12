/**
 * Edge Function: generate-deadline-notifications
 *
 * Story 9.3 + 25.4 + 25.5 — Generates in-app notifications for fiscal deadlines.
 *
 * Two sections:
 * A) Upcoming reminders — 30d, 7d, 3d, today thresholds for unpaid schedules.
 * B) Feedback popups — "Com'è andata?" for deadlines 3-5 days past (Story 25.5).
 *    Delivery channel: popup. Dedup: deadline_feedback + existing notifications.
 *    Only for active users (≥1 receipt). Category: feedback.
 *
 * Invoked on-login (client sends user_id) or batch (no user_id, processes all).
 * Uses service_role client for INSERT into notifications (RLS: only service_role can INSERT).
 *
 * Dedup: batch query — fetches all existing deadline notifications for the user in a
 *   single SELECT, builds in-memory Set of "type:schedule_id" keys, O(1) lookup per candidate.
 * Filters: skips paid schedules for reminders (status = 'paid').
 * GDPR: art. 6.1.b — core service feature, no consent required.
 */
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

// ── Inline helpers (cannot import from src/lib/ in Deno) ──

const BUCKET_LABELS: Record<string, string> = {
  june: "Rata Giugno",
  november: "Rata Novembre",
  inps_q1: "Rata INPS Q1 (Feb)",
  inps_q2: "Rata INPS Q2 (Mag)",
  inps_q3: "Rata INPS Q3 (Ago)",
  inps_q4: "Rata INPS Q4 (Nov)",
  saldo_tax: "Saldo Imposta",
  saldo_inps: "Saldo INPS",
  acconto_tax_1: "I° Acconto Imposta",
  acconto_tax_2: "II° Acconto Imposta",
  acconto_inps_1: "I° Acconto INPS",
  acconto_inps_2: "II° Acconto INPS",
};

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// june/november seguono il MESE della scadenza reale (proroghe per-anno:
// es. 2026 "june" prorogata al 20/07 → "Rata Luglio").
const MONTH_DERIVED_BUCKETS = new Set(["june", "november"]);

function bucketToLabel(bucket: string, dueDate?: string | null): string {
  if (dueDate && MONTH_DERIVED_BUCKETS.has(bucket)) {
    const safe = dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`;
    const month = MONTHS_IT[new Date(safe).getMonth()];
    if (month) return `Rata ${month}`;
  }
  return BUCKET_LABELS[bucket] ?? "Scadenza Fiscale";
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Calculate days between two YYYY-MM-DD dates (no time component). */
function daysUntilFromDate(dueDate: string, todayISO: string): number {
  const due = new Date(dueDate + "T00:00:00");
  const now = new Date(todayISO + "T00:00:00");
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Get today as YYYY-MM-DD string in Europe/Rome timezone (CET/CEST).
 *  Using Italian timezone ensures deadline matching aligns with the user's
 *  local calendar day, avoiding the UTC midnight gap (00:00-02:00 CET). */
function todayISO(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD natively
  return formatter.format(new Date());
}

/** Get a YYYY-MM-DD string for today + offsetDays in Europe/Rome timezone. */
function dateOffsetISO(offsetDays: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

// ── Thresholds ──

/** Days-before-due thresholds that trigger a reminder notification.
 *  The query window is derived automatically from Math.max(...REMINDER_THRESHOLDS).
 *  To add a new threshold: add the number here, add the type below, add the entry in DAYS_TO_TYPE. */
const REMINDER_THRESHOLDS = [30, 7, 3, 0] as const;

/** Upper bound for the schedule query window in days (today → today+MAX_WINDOW_DAYS).
 *  Derived from thresholds so it stays consistent automatically. */
const MAX_WINDOW_DAYS = Math.max(...REMINDER_THRESHOLDS);

type NotificationType =
  | "deadline_reminder_30d"
  | "deadline_reminder_7d"
  | "deadline_reminder_3d"
  | "deadline_today";

const DAYS_TO_TYPE: Record<number, NotificationType> = {
  30: "deadline_reminder_30d",
  7: "deadline_reminder_7d",
  3: "deadline_reminder_3d",
  0: "deadline_today",
};

// ── Types ──

interface ScheduleRow {
  id: string;
  user_id: string;
  bucket: string;
  due_date: string;
  total_expected: number;
  status: string;
}

interface NotificationInsert {
  user_id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  action_url: string;
  action_label: string;
  metadata: Record<string, unknown>;
  delivery_channel?: string;
}

// ── Preference enforcement ──

/**
 * Default per categoria quando nessuna riga in DB (lazy creation pattern).
 * IMPORTANT: Deve restare allineato con NOTIFICATION_SETTINGS_DEFAULTS in
 * src/hooks/useNotificationSettings.ts — se cambi qui, cambia anche lì.
 */
const CATEGORY_DEFAULTS: Record<string, boolean> = {
  scadenze: true,
  insights: true,
  aggiornamenti: false,
  feedback: true,
  admin_messages: true,
};

/** Mappa preferenze utente: categoria → enabled + master switch. */
type UserPreferencesMap = Record<string, boolean>;

/**
 * Carica le preferenze notifiche di un utente.
 * Story 25.3: reads from user_notification_settings first (new table),
 * falls back to notification_preferences (old table) if no row exists.
 * Includes master_enabled for global kill switch (FR77).
 *
 * TODO(DRY): This function is duplicated in generate-digest-notifications and
 * send-admin-announcement. Extract to supabase/functions/_shared/notification-prefs.ts
 * when Lovable deploy supports shared modules.
 */
async function loadUserPreferences(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<UserPreferencesMap> {
  // 1. Try new table first (Story 25.3)
  const { data: newSettings, error: newError } = await serviceClient
    .from("user_notification_settings")
    .select("master_enabled, scadenze_enabled, insights_enabled, aggiornamenti_enabled, admin_messages_enabled, feedback_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!newError && newSettings) {
    return {
      master_enabled: newSettings.master_enabled,
      scadenze: newSettings.scadenze_enabled,
      insights: newSettings.insights_enabled,
      aggiornamenti: newSettings.aggiornamenti_enabled,
      admin_messages: newSettings.admin_messages_enabled,
      feedback: newSettings.feedback_enabled,
    };
  }

  // 2. Fallback to old table (notification_preferences)
  const prefs: UserPreferencesMap = { ...CATEGORY_DEFAULTS, master_enabled: true };

  const { data, error } = await serviceClient
    .from("notification_preferences")
    .select("category, enabled")
    .eq("user_id", userId);

  if (error) {
    console.error("Preference batch load error:", error);
    // Fail-open with defaults on DB error
    return prefs;
  }

  for (const row of data ?? []) {
    if (row.category in prefs) {
      prefs[row.category] = row.enabled;
    }
  }

  return prefs;
}

/**
 * Check in-memory se una categoria è abilitata per l'utente.
 * Usa la mappa precaricata da loadUserPreferences().
 */
function isCategoryEnabled(prefs: UserPreferencesMap, category: string): boolean {
  return prefs[category] ?? CATEGORY_DEFAULTS[category] ?? false;
}

// ── Main handler ──

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Service client for DB operations (bypass RLS for INSERT)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body — optional user_id for anti-tampering check
    let targetUserId = user.id;
    try {
      const body = await req.json();
      if (body.user_id) {
        // Anti-tampering: ensure requested user_id matches JWT
        if (body.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: "Forbidden: user_id mismatch" }),
            { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
          );
        }
        targetUserId = body.user_id;
      }
    } catch {
      // No body or invalid JSON — proceed with JWT user
    }

    const today = todayISO();

    // Step 1: Batch-load user notification preferences (single query, no N+1)
    const userPrefs = await loadUserPreferences(serviceClient, targetUserId);

    // FR77: master switch off → skip entirely
    if (userPrefs.master_enabled === false) {
      return new Response(
        JSON.stringify({ generated: 0, feedback_generated: 0, message: "Notifications disabled by user (master switch off)" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const toInsert: NotificationInsert[] = [];
    let skippedDedup = 0;
    let schedulesChecked = 0;

    // ── Section A: Upcoming deadline reminders ──

    if (isCategoryEnabled(userPrefs, "scadenze")) {
      const maxDate = dateOffsetISO(MAX_WINDOW_DAYS); // today + 30

      // A1: Fetch upcoming unpaid schedules (today → today+30)
      const { data: schedules, error: schedError } = await serviceClient
        .from("tax_schedule")
        .select("id, user_id, bucket, due_date, total_expected, status")
        .eq("user_id", targetUserId)
        .neq("status", "paid")
        .gte("due_date", today)
        .lte("due_date", maxDate)
        .order("due_date");

      if (schedError) {
        console.error("Schedule query error:", schedError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch schedules" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      schedulesChecked = schedules?.length ?? 0;

      if (schedules && schedules.length > 0) {
        // A2: Batch dedup — single query for ALL existing deadline notifications
        const dedupTypes: NotificationType[] = Object.values(DAYS_TO_TYPE);

        const { data: existingDeadlineNotifs, error: dedupError } = await serviceClient
          .from("notifications")
          .select("type, metadata")
          .eq("user_id", targetUserId)
          .in("type", dedupTypes);

        if (dedupError) {
          console.error("Dedup query error:", dedupError);
          return new Response(
            JSON.stringify({ error: "Failed to load existing notifications for dedup" }),
            { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
          );
        }

        const sentKeys = new Set<string>(
          (existingDeadlineNotifs ?? [])
            .filter((n: { metadata: Record<string, unknown> | null }) => n.metadata?.schedule_id)
            .map(
              (n: { type: string; metadata: Record<string, unknown> }) =>
                `${n.type}:${n.metadata.schedule_id}`,
            ),
        );

        // A3: Filter to threshold matches, check dedup in-memory, build payloads
        for (const schedule of schedules as ScheduleRow[]) {
          const days = daysUntilFromDate(schedule.due_date, today);

          if (!REMINDER_THRESHOLDS.includes(days as typeof REMINDER_THRESHOLDS[number])) {
            continue;
          }

          const notifType = DAYS_TO_TYPE[days];
          if (!notifType) continue;

          // Dedup check — O(1) Set lookup
          const dedupKey = `${notifType}:${schedule.id}`;
          if (sentKeys.has(dedupKey)) {
            skippedDedup++;
            continue;
          }

          const label = bucketToLabel(schedule.bucket, schedule.due_date);
          const importo = formatEuro(Number(schedule.total_expected));

          let title: string;
          let body: string;

          if (days === 0) {
            title = `Oggi: ${label}`;
            body = `Oggi scade ${label} di ${importo}`;
          } else {
            title = `Tra ${days} giorni: ${label}`;
            body = `Scadenza ${label} di ${importo} il ${formatDateShort(schedule.due_date)}`;
          }

          toInsert.push({
            user_id: targetUserId,
            type: notifType,
            category: "scadenze",
            title,
            body,
            action_url: "/scadenziario",
            action_label: "Vai allo Scadenziario",
            metadata: {
              schedule_id: schedule.id,
              days_until: days,
              due_date: schedule.due_date,
              amount: Number(schedule.total_expected),
            },
          });
        }
      }
    }

    // ── Section B: Feedback popup generation (Story 25.5) ──
    // Generates feedback_request popups for deadlines that passed 3-5 days ago.
    // Only for active users (≥1 receipt). Dedup against deadline_feedback + notifications.

    let feedbackGenerated = 0;

    if (isCategoryEnabled(userPrefs, "feedback")) {
      // B1: Check user has at least 1 receipt (active user filter)
      const { count: receiptCount, error: receiptError } = await serviceClient
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId);

      if (receiptError) {
        console.error("Receipt count error:", receiptError);
      }

      if (!receiptError && (receiptCount ?? 0) > 0) {
        // B2: Fetch past-due schedules (3 to 5 days ago, any status)
        const feedbackMinDate = dateOffsetISO(-5);
        const feedbackMaxDate = dateOffsetISO(-3);

        const { data: pastSchedules, error: pastError } = await serviceClient
          .from("tax_schedule")
          .select("id, user_id, bucket, due_date, total_expected, status")
          .eq("user_id", targetUserId)
          .gte("due_date", feedbackMinDate)
          .lte("due_date", feedbackMaxDate)
          .order("due_date");

        if (pastError) {
          console.error("Past schedule query error:", pastError);
        } else if (pastSchedules && pastSchedules.length > 0) {
          const pastIds = pastSchedules.map((s: ScheduleRow) => s.id);

          // B3: Dedup — check deadline_feedback for already-answered
          const { data: existingFeedback } = await serviceClient
            .from("deadline_feedback")
            .select("schedule_event_id")
            .eq("user_id", targetUserId)
            .in("schedule_event_id", pastIds);

          const feedbackGivenSet = new Set(
            (existingFeedback ?? []).map(
              (f: { schedule_event_id: string }) => f.schedule_event_id,
            ),
          );

          // B3b: Dedup — check existing feedback_request notifications
          const { data: existingFeedbackNotifs } = await serviceClient
            .from("notifications")
            .select("metadata")
            .eq("user_id", targetUserId)
            .eq("type", "feedback_request");

          const feedbackNotifSet = new Set(
            (existingFeedbackNotifs ?? [])
              .filter((n: { metadata: Record<string, unknown> | null }) => n.metadata?.schedule_id)
              .map((n: { metadata: Record<string, unknown> }) => String(n.metadata.schedule_id)),
          );

          // B4: Build feedback popup notifications
          const feedbackToInsert: NotificationInsert[] = [];

          for (const schedule of pastSchedules as ScheduleRow[]) {
            // Skip if feedback already given
            if (feedbackGivenSet.has(schedule.id)) continue;
            // Skip if notification already sent
            if (feedbackNotifSet.has(schedule.id)) continue;

            const label = bucketToLabel(schedule.bucket, schedule.due_date);

            feedbackToInsert.push({
              user_id: targetUserId,
              type: "feedback_request",
              category: "feedback",
              delivery_channel: "popup",
              title: `Com'è andata? ${label}`,
              body: `La scadenza ${label} è passata. Raccontaci com'è andata.`,
              action_url: "/scadenziario",
              action_label: "Vai allo Scadenziario",
              metadata: {
                schedule_id: schedule.id,
                bucket_label: label,
                due_date: schedule.due_date,
                days_past: Math.abs(daysUntilFromDate(schedule.due_date, today)),
              },
            });
          }

          // Add to combined insert batch
          toInsert.push(...feedbackToInsert);
          feedbackGenerated = feedbackToInsert.length;
        }
      }
    }

    // ── Step 4: Combined batch insert ──
    let insertedCount = 0;
    if (toInsert.length > 0) {
      const { error: insertError, data: inserted } = await serviceClient
        .from("notifications")
        .insert(toInsert)
        .select("id");

      if (insertError) {
        console.error("Notification insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to insert notifications" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      insertedCount = inserted?.length ?? 0;
    }

    const reminderCount = insertedCount - feedbackGenerated;

    console.log(
      `[generate-deadline-notifications] User ${targetUserId}: checked ${schedulesChecked} schedules, ` +
      `generated ${reminderCount} reminders + ${feedbackGenerated} feedback popups, skipped ${skippedDedup} dedup`,
    );

    return new Response(
      JSON.stringify({
        generated: reminderCount,
        feedback_generated: feedbackGenerated,
        checked: schedulesChecked,
        skipped_dedup: skippedDedup,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-deadline-notifications error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
