/**
 * deadline-notifications.ts
 *
 * Pure functions for generating deadline notification payloads.
 * Used client-side for testing; the Edge Function replicates this logic in Deno.
 *
 * Story 9.3 — Generazione Automatica Notifiche Scadenze Fiscali
 */

// ── Types ──

export interface ScheduleInput {
  id: string;
  user_id: string;
  bucket: string;
  due_date: string; // "YYYY-MM-DD"
  total_expected: number; // euro (NOT centesimi)
  status: string; // "open" | "partial" | "paid"
}

export interface NotificationPayload {
  user_id: string;
  type: "deadline_reminder_7d" | "deadline_reminder_3d" | "deadline_today";
  category: "scadenze";
  title: string;
  body: string;
  action_url: string;
  action_label: string;
  metadata: {
    schedule_id: string;
    days_until: number;
    due_date: string;
    amount: number;
  };
}

export type NotificationType = NotificationPayload["type"];

// ── Thresholds ──

/** Supported reminder thresholds in days */
export const REMINDER_THRESHOLDS = [7, 3, 0] as const;

/** Maps days-until → notification type */
const DAYS_TO_TYPE: Record<number, NotificationType> = {
  7: "deadline_reminder_7d",
  3: "deadline_reminder_3d",
  0: "deadline_today",
};

// ── Bucket labels (mirrors schedule-helpers.ts BUCKET_LABELS for Deno independence) ──

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

// Buckets il cui label segue il mese della scadenza reale (proroghe per-anno
// spostano la data — es. 2026: "june" prorogata al 20/07 → "Rata Luglio").
const MONTH_DERIVED_BUCKETS = new Set(["june", "november"]);

export function bucketToLabel(bucket: string, dueDate?: string | null): string {
  if (dueDate && MONTH_DERIVED_BUCKETS.has(bucket)) {
    const safe = dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`;
    const month = MONTHS_IT[new Date(safe).getMonth()];
    if (month) return `Rata ${month}`;
  }
  return BUCKET_LABELS[bucket] ?? "Scadenza Fiscale";
}

// ── Formatting ──

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Core: days calculation ──

/**
 * Calculate days until a deadline from a reference date.
 * Both dates are treated as date-only (no time component).
 * Returns an integer: 0 = today, positive = future, negative = past.
 */
export function daysUntilFromDate(
  dueDate: string,
  today: string,
): number {
  // Parse as local dates to avoid timezone issues
  const due = new Date(dueDate + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Core: notification generation ──

/**
 * Build a notification payload for a schedule + threshold.
 * Returns null if daysUntil doesn't match any threshold.
 */
export function buildNotificationPayload(
  schedule: ScheduleInput,
  daysUntil: number,
): NotificationPayload | null {
  const notifType = DAYS_TO_TYPE[daysUntil];
  if (!notifType) return null;

  const label = bucketToLabel(schedule.bucket, schedule.due_date);
  const importo = formatEuro(schedule.total_expected);

  let title: string;
  let body: string;

  if (daysUntil === 0) {
    title = `Oggi: ${label}`;
    body = `Oggi scade ${label} di ${importo}`;
  } else {
    title = `Tra ${daysUntil} giorni: ${label}`;
    body = `Scadenza ${label} di ${importo} il ${formatDateShort(schedule.due_date)}`;
  }

  return {
    user_id: schedule.user_id,
    type: notifType,
    category: "scadenze",
    title,
    body,
    action_url: "/scadenziario",
    action_label: "Vai allo Scadenziario",
    metadata: {
      schedule_id: schedule.id,
      days_until: daysUntil,
      due_date: schedule.due_date,
      amount: schedule.total_expected,
    },
  };
}

/**
 * Given a list of upcoming schedules and today's date,
 * produce all notification payloads (without dedup check).
 *
 * Filters:
 * - Ignores paid schedules (status === "paid")
 * - Only includes schedules matching thresholds [7, 3, 0]
 */
export function generateNotificationPayloads(
  schedules: ScheduleInput[],
  todayISO: string,
): NotificationPayload[] {
  const payloads: NotificationPayload[] = [];

  for (const schedule of schedules) {
    // AC #5: skip paid schedules
    if (schedule.status === "paid") continue;

    const days = daysUntilFromDate(schedule.due_date, todayISO);

    // Only generate for exact thresholds
    if (!REMINDER_THRESHOLDS.includes(days as typeof REMINDER_THRESHOLDS[number])) {
      continue;
    }

    const payload = buildNotificationPayload(schedule, days);
    if (payload) {
      payloads.push(payload);
    }
  }

  return payloads;
}

/**
 * Build a dedup key for a notification: unique per user + schedule + type.
 */
export function dedupKey(
  userId: string,
  scheduleId: string,
  type: NotificationType,
): string {
  return `${userId}:${scheduleId}:${type}`;
}
