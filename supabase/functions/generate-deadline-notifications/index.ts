/**
 * Edge Function: generate-digest-notifications
 *
 * Story 9.5 — Generates in-app digest/insight notifications.
 *
 * Invoked on-login (client sends user_id). Debounced 24h client-side.
 * Uses service_role client for INSERT into notifications (RLS: only service_role can INSERT).
 *
 * Trigger types:
 *   - monthly_summary: first 3 days of month → recap of previous month
 *   - inactivity_15d: 15+ days since last receipt
 *   - threshold_50/75/100: % of €85k soglia forfettaria reached
 *
 * All notifications use type="digest_mensile" (existing CHECK constraint).
 * Differentiated via metadata.trigger_type for dedup.
 *
 * Dedup: query-based — skips if notification already exists for (user_id, type, trigger_type+period).
 * Preferences: checks `insights` category via notification_preferences (respects toggle).
 * GDPR: legittimo interesse per insights (utente può disattivare in preferenze).
 *
 * IMPORTANT: Logic replicated from src/lib/digest-insights.ts
 * — if you change there, change here too.
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

// ── Constants (KEEP ALIGNED with src/lib/digest-insights.ts) ──

const THRESHOLD_LIMIT = 85_000;
const INACTIVITY_DAYS_THRESHOLD = 15;
const MONTHLY_TRIGGER_DAY_MAX = 3;

type DigestTriggerType =
  | "monthly_summary"
  | "inactivity_15d"
  | "threshold_50"
  | "threshold_75"
  | "threshold_100";

interface DigestTrigger {
  type: DigestTriggerType;
  dedupKey: string;
}

// ── Inline helpers (cannot import from src/lib/ in Deno) ──

function todayISO(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function extractMonth(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function extractDay(dateISO: string): number {
  return parseInt(dateISO.slice(8, 10), 10);
}

function prevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabel(yearMonth: string): string {
  const m = parseInt(yearMonth.split("-")[1], 10);
  return MONTH_NAMES[m - 1] ?? yearMonth;
}

function calcInactivityDays(lastReceiptDate: string | null, today: string): number {
  if (!lastReceiptDate) return Infinity;
  const last = new Date(lastReceiptDate + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  return Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Preference enforcement ──
// KEEP ALIGNED with src/hooks/useNotificationSettings.ts NOTIFICATION_SETTINGS_DEFAULTS

const CATEGORY_DEFAULTS: Record<string, boolean> = {
  scadenze: true,
  insights: true,
  aggiornamenti: false,
  feedback: true,
  admin_messages: true,
};

type UserPreferencesMap = Record<string, boolean>;

/**
 * Story 25.3: reads from user_notification_settings first (new table),
 * falls back to notification_preferences (old table) if no row exists.
 *
 * TODO(DRY): This function is duplicated in generate-deadline-notifications and
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
    return prefs;
  }

  for (const row of data ?? []) {
    if (row.category in prefs) {
      prefs[row.category] = row.enabled;
    }
  }

  return prefs;
}

function isCategoryEnabled(prefs: UserPreferencesMap, category: string): boolean {
  return prefs[category] ?? CATEGORY_DEFAULTS[category] ?? false;
}

// ── Trigger evaluation ──

interface ReceiptRow {
  gross_amount: number;
  receipt_date: string;
}

function evaluateTriggers(
  today: string,
  receipts: ReceiptRow[],
  lastReceiptDate: string | null,
  currentYear: number,
): DigestTrigger[] {
  const triggers: DigestTrigger[] = [];
  const todayMonth = extractMonth(today);
  const todayDay = extractDay(today);

  // Monthly summary (first 3 days)
  if (todayDay <= MONTHLY_TRIGGER_DAY_MAX) {
    const reportMonth = prevMonth(todayMonth);
    triggers.push({ type: "monthly_summary", dedupKey: reportMonth });
  }

  // Inactivity (15+ days)
  const inactivityDays = calcInactivityDays(lastReceiptDate, today);
  if (inactivityDays >= INACTIVITY_DAYS_THRESHOLD) {
    triggers.push({ type: "inactivity_15d", dedupKey: todayMonth });
  }

  // Threshold milestones (only current-year receipts, not prev-year included for monthly summary)
  const currentYearPrefix = `${currentYear}-`;
  const currentYearReceipts = receipts.filter((r) => r.receipt_date.startsWith(currentYearPrefix));
  const totalYTD = currentYearReceipts.reduce((sum, r) => sum + Number(r.gross_amount), 0);
  const percent = totalYTD <= 0 ? 0 : Math.round((totalYTD / THRESHOLD_LIMIT) * 100);

  const milestones: Array<{ value: 50 | 75 | 100; triggerType: DigestTriggerType }> = [
    { value: 50, triggerType: "threshold_50" },
    { value: 75, triggerType: "threshold_75" },
    { value: 100, triggerType: "threshold_100" },
  ];

  for (const m of milestones) {
    if (percent >= m.value) {
      triggers.push({ type: m.triggerType, dedupKey: `${currentYear}:${m.value}` });
    }
  }

  return triggers;
}

// ── Payload building ──

interface NotificationInsert {
  user_id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  action_url: string;
  action_label: string;
  metadata: Record<string, unknown>;
}

function buildPayload(
  userId: string,
  trigger: DigestTrigger,
  receipts: ReceiptRow[],
  today: string,
  lastReceiptDate: string | null,
  nextDeadlineDays: number | null,
  nextDeadlineLabel: string | null,
  fiscalYear: number,
): NotificationInsert {
  // For threshold triggers, filter to current fiscal year only (receipts may include prev year for monthly summary)
  const isThreshold = trigger.type.startsWith("threshold_");
  const effectiveReceipts = isThreshold
    ? receipts.filter((r) => r.receipt_date.startsWith(`${fiscalYear}-`))
    : receipts;
  const title = buildTitle(trigger, effectiveReceipts, today, lastReceiptDate);
  const body = buildBody(trigger, effectiveReceipts, today, nextDeadlineDays, nextDeadlineLabel, receipts, fiscalYear);

  return {
    user_id: userId,
    type: "digest_mensile",
    category: "insights",
    title,
    body,
    action_url: "/dashboard",
    action_label: "Vedi Dashboard",
    metadata: {
      trigger_type: trigger.type,
      period: trigger.dedupKey,
      fiscal_year: fiscalYear,
      generated_at: today,
    },
  };
}

function buildTitle(
  trigger: DigestTrigger,
  receipts: ReceiptRow[],
  today: string,
  lastReceiptDate: string | null,
): string {
  switch (trigger.type) {
    case "monthly_summary": {
      const reportMonth = trigger.dedupKey;
      const monthReceipts = receipts.filter(
        (r) => extractMonth(r.receipt_date) === reportMonth,
      );
      const count = monthReceipts.length;
      const total = monthReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      const name = monthLabel(reportMonth);
      if (count === 0) return `${name}: nessun incasso registrato`;
      return `${name}: ${count} incass${count === 1 ? "o" : "i"} per ${formatEuro(total)}`;
    }
    case "inactivity_15d": {
      const days = calcInactivityDays(lastReceiptDate, today);
      const displayDays = days === Infinity ? "molto tempo" : `${days} giorni`;
      return `Non registri incassi da ${displayDays}`;
    }
    case "threshold_50":
      return "Hai raggiunto il 50% della soglia forfettaria";
    case "threshold_75":
      return "Attenzione: 75% della soglia forfettaria";
    case "threshold_100":
      return "Superata la soglia \u20AC85.000";
    default:
      return "Aggiornamento Forfettino";
  }
}

function buildBody(
  trigger: DigestTrigger,
  receipts: ReceiptRow[],
  today: string,
  nextDeadlineDays: number | null,
  nextDeadlineLabel: string | null,
  allReceipts: ReceiptRow[],
  fiscalYear: number,
): string {
  const deadlinePart =
    nextDeadlineDays != null && nextDeadlineLabel
      ? `Prossima scadenza tra ${nextDeadlineDays} giorni.`
      : "";

  // Current-year receipts for YTD calculations
  const currentYearPrefix = `${fiscalYear}-`;
  const currentYearReceipts = allReceipts.filter((r) => r.receipt_date.startsWith(currentYearPrefix));

  switch (trigger.type) {
    case "monthly_summary": {
      const reportMonth = trigger.dedupKey;
      const prev = prevMonth(reportMonth);
      const currentReceipts = receipts.filter(
        (r) => extractMonth(r.receipt_date) === reportMonth,
      );
      const prevReceipts = receipts.filter(
        (r) => extractMonth(r.receipt_date) === prev,
      );
      const currentTotal = currentReceipts.reduce(
        (s, r) => s + Number(r.gross_amount), 0,
      );
      const prevTotal = prevReceipts.reduce(
        (s, r) => s + Number(r.gross_amount), 0,
      );

      if (currentReceipts.length === 0) {
        return `Puoi registrare i tuoi incassi in qualsiasi momento dalla dashboard. ${deadlinePart}`.trim();
      }

      const parts: string[] = [];
      if (prevTotal > 0) {
        const variation = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
        const sign = variation >= 0 ? "+" : "";
        parts.push(`Rispetto a ${monthLabel(prev)}: ${sign}${variation}%.`);
      } else if (currentReceipts.length > 0) {
        parts.push("Primo mese con incassi registrati.");
      }
      // AC #2: include totale YTD e % soglia raggiunta
      const totalYTD = currentYearReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      const pctSoglia = totalYTD <= 0 ? 0 : Math.round((totalYTD / THRESHOLD_LIMIT) * 100);
      parts.push(`Totale YTD: ${formatEuro(totalYTD)} (${pctSoglia}% soglia).`);
      if (deadlinePart) parts.push(deadlinePart);
      return parts.join(" ");
    }
    case "inactivity_15d":
      return `Tutto ok? Puoi registrare i tuoi incassi quando vuoi. ${deadlinePart}`.trim();
    case "threshold_50": {
      const total = receipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      return `I tuoi incassi YTD: ${formatEuro(total)}. Soglia regime forfettario: ${formatEuro(THRESHOLD_LIMIT)}.`;
    }
    case "threshold_75": {
      const total = receipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      return `I tuoi incassi YTD: ${formatEuro(total)}. Monitora con attenzione la soglia ${formatEuro(THRESHOLD_LIMIT)}.`;
    }
    case "threshold_100": {
      const total = receipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      return `I tuoi incassi YTD: ${formatEuro(total)}. Verifica col tuo commercialista l'impatto sull'anno prossimo.`;
    }
    default:
      return "";
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Anti-tampering: validate body user_id matches JWT
    let targetUserId = user.id;
    try {
      const body = await req.json();
      if (body.user_id) {
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

    // Step 1: Check notification preferences (batch load)
    const userPrefs = await loadUserPreferences(serviceClient, targetUserId);

    // FR77: master switch off → skip entirely
    if (userPrefs.master_enabled === false) {
      return new Response(
        JSON.stringify({ generated: 0, skipped_prefs: 1, skipped_dedup: 0, message: "Notifications disabled by user (master switch off)" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (!isCategoryEnabled(userPrefs, "insights")) {
      return new Response(
        JSON.stringify({ generated: 0, skipped_prefs: 1, skipped_dedup: 0 }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const today = todayISO();
    const todayMonth = extractMonth(today);
    const currentYear = parseInt(today.slice(0, 4), 10);

    // Step 2: Fetch receipts for current fiscal year
    // Also fetch previous year if today is Jan 1-3 (monthly_summary needs Dec receipts)
    const todayDay = extractDay(today);
    const todayMonthNum = parseInt(today.slice(5, 7), 10);
    const needsPrevYear = todayDay <= MONTHLY_TRIGGER_DAY_MAX && todayMonthNum === 1;

    const { data: receipts, error: receiptsError } = await serviceClient
      .from("receipts")
      .select("gross_amount, receipt_date")
      .eq("user_id", targetUserId)
      .in("fiscal_year", needsPrevYear ? [currentYear, currentYear - 1] : [currentYear]);

    if (receiptsError) {
      console.error("Receipts query error:", receiptsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch receipts" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const receiptList = (receipts ?? []) as ReceiptRow[];

    // Fetch last receipt date across ALL fiscal years (for inactivity check)
    // Separate from receipt list which may be limited to current year
    const { data: lastRow } = await serviceClient
      .from("receipts")
      .select("receipt_date")
      .eq("user_id", targetUserId)
      .order("receipt_date", { ascending: false })
      .limit(1);
    const lastReceiptDate = lastRow?.[0]?.receipt_date ?? null;

    // Step 3: Fetch next unpaid deadline (for body text)
    const { data: nextSchedule } = await serviceClient
      .from("tax_schedule")
      .select("due_date, bucket")
      .eq("user_id", targetUserId)
      .eq("fiscal_year", currentYear)
      .neq("status", "paid")
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(1);

    let nextDeadlineDays: number | null = null;
    let nextDeadlineLabel: string | null = null;
    if (nextSchedule && nextSchedule.length > 0) {
      const dueDt = new Date(nextSchedule[0].due_date + "T00:00:00");
      const todayDt = new Date(today + "T00:00:00");
      nextDeadlineDays = Math.round(
        (dueDt.getTime() - todayDt.getTime()) / (1000 * 60 * 60 * 24),
      );
      nextDeadlineLabel = nextSchedule[0].bucket ?? null;
    }

    // Step 4: Evaluate triggers
    const triggers = evaluateTriggers(today, receiptList, lastReceiptDate, currentYear);

    if (triggers.length === 0) {
      return new Response(
        JSON.stringify({ generated: 0, skipped_prefs: 0, skipped_dedup: 0 }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Step 5: Batch dedup check + build payloads
    // Single query: fetch all existing digest notifications for this user (avoids N+1)
    const { data: existingDigests } = await serviceClient
      .from("notifications")
      .select("metadata")
      .eq("user_id", targetUserId)
      .eq("type", "digest_mensile");

    const existingKeys = new Set(
      (existingDigests ?? []).map(
        (n: { metadata: Record<string, unknown> }) =>
          `${n.metadata?.trigger_type}:${n.metadata?.period}`,
      ),
    );

    const toInsert: NotificationInsert[] = [];
    let skippedDedup = 0;

    for (const trigger of triggers) {
      if (existingKeys.has(`${trigger.type}:${trigger.dedupKey}`)) {
        skippedDedup++;
        continue;
      }

      toInsert.push(
        buildPayload(
          targetUserId,
          trigger,
          receiptList,
          today,
          lastReceiptDate,
          nextDeadlineDays,
          nextDeadlineLabel,
          currentYear,
        ),
      );
    }

    // Step 6: Batch insert
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

    console.log(
      `[generate-digest-notifications] User ${targetUserId}: evaluated ${triggers.length} triggers, generated ${insertedCount}, skipped ${skippedDedup} dedup`,
    );

    return new Response(
      JSON.stringify({
        generated: insertedCount,
        skipped_prefs: 0,
        skipped_dedup: skippedDedup,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-digest-notifications error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
