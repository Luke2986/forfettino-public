/**
 * digest-insights.ts
 *
 * Pure functions for generating digest/insight notification payloads.
 * Used client-side for testing; the Edge Function replicates this logic in Deno.
 *
 * Story 9.5 — Digest Periodico In-App e Insights Automatici (FR49)
 *
 * IMPORTANT: Logic replicated in
 *   supabase/functions/generate-digest-notifications/index.ts
 * — if you change here, change there too.
 */

// ── Types ──

export type DigestTriggerType =
  | "monthly_summary"
  | "inactivity_15d"
  | "threshold_50"
  | "threshold_75"
  | "threshold_100";

export interface DigestContext {
  receipts: { gross_amount: number; receipt_date: string }[];
  todayISO: string; // "YYYY-MM-DD"
  lastReceiptDate: string | null;
  fiscalYear: number;
  nextDeadlineDays: number | null;
  nextDeadlineLabel: string | null;
}

export interface DigestTrigger {
  type: DigestTriggerType;
  dedupKey: string;
}

export interface MonthlyComparison {
  currentMonth: string; // "YYYY-MM"
  currentMonthCount: number;
  currentMonthTotal: number; // euro (from DB numeric)
  prevMonthCount: number;
  prevMonthTotal: number;
  variationPercent: number | null; // null if prev=0
}

export interface ThresholdProgress {
  totalYTD: number;
  threshold: number; // 85000
  percent: number; // 0-100+
  milestones: { reached: boolean; value: 50 | 75 | 100 }[];
}

export interface DigestNotificationPayload {
  type: string;
  category: "insights";
  title: string;
  body: string;
  action_url: string;
  action_label: string;
  metadata: Record<string, unknown>;
}

// ── Constants ──

export const THRESHOLD_LIMIT = 85_000; // €85.000 regime forfettario
export const INACTIVITY_DAYS_THRESHOLD = 15;
export const MONTHLY_TRIGGER_DAY_MAX = 3; // primi 3 giorni del mese

/** Maps trigger types → notification DB type */
export const TRIGGER_TO_NOTIF_TYPE: Record<DigestTriggerType, string> = {
  monthly_summary: "digest_mensile",
  inactivity_15d: "digest_mensile",
  threshold_50: "digest_mensile",
  threshold_75: "digest_mensile",
  threshold_100: "digest_mensile",
};

// ── Helper: safe month extraction ──

/** Extract "YYYY-MM" from a "YYYY-MM-DD" date string. */
export function extractMonth(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** Extract day-of-month from a "YYYY-MM-DD" date string. */
function extractDay(dateISO: string): number {
  return parseInt(dateISO.slice(8, 10), 10);
}

/** Get the previous month as "YYYY-MM" given a "YYYY-MM" string. */
export function prevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

// ── Formatting (Deno-safe versions for testing; Edge Function has its own) ──

function formatEuroSimple(amount: number): string {
  // Use Intl if available (works in Node/browsers), fallback for edge cases
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  } catch {
    return `€${amount.toFixed(2)}`;
  }
}

// ── Core functions ──

/**
 * Calculate days of inactivity since last receipt.
 * Returns Infinity if lastReceiptDate is null (never registered).
 */
export function calcInactivityDays(
  lastReceiptDate: string | null,
  today: string,
): number {
  if (!lastReceiptDate) return Infinity;
  const last = new Date(lastReceiptDate + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  return Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate monthly comparison between two months.
 * Filters receipts by month string ("YYYY-MM") extracted from receipt_date.
 */
export function calcMonthlyComparison(
  receipts: { gross_amount: number; receipt_date: string }[],
  currentMonth: string,
  prevMonthStr: string,
): MonthlyComparison {
  let currentCount = 0;
  let currentTotal = 0;
  let prevCount = 0;
  let prevTotal = 0;

  for (const r of receipts) {
    const m = extractMonth(r.receipt_date);
    if (m === currentMonth) {
      currentCount++;
      currentTotal += Number(r.gross_amount);
    } else if (m === prevMonthStr) {
      prevCount++;
      prevTotal += Number(r.gross_amount);
    }
  }

  const variationPercent =
    prevTotal === 0
      ? null
      : Math.round(((currentTotal - prevTotal) / prevTotal) * 100);

  return {
    currentMonth,
    currentMonthCount: currentCount,
    currentMonthTotal: currentTotal,
    prevMonthCount: prevCount,
    prevMonthTotal: prevTotal,
    variationPercent,
  };
}

/**
 * Calculate progress toward the €85.000 threshold.
 */
export function calcThresholdProgress(totalYTD: number): ThresholdProgress {
  const percent = totalYTD <= 0 ? 0 : Math.round((totalYTD / THRESHOLD_LIMIT) * 100);

  return {
    totalYTD,
    threshold: THRESHOLD_LIMIT,
    percent,
    milestones: [
      { value: 50, reached: percent >= 50 },
      { value: 75, reached: percent >= 75 },
      { value: 100, reached: percent >= 100 },
    ],
  };
}

/**
 * Evaluate which digest triggers are active given the current context.
 * Returns a list of triggers (may be empty).
 */
export function evaluateDigestTriggers(
  context: DigestContext,
): DigestTrigger[] {
  const triggers: DigestTrigger[] = [];
  const { todayISO, receipts, lastReceiptDate } = context;
  const todayMonth = extractMonth(todayISO);
  const todayDay = extractDay(todayISO);

  // ── Monthly summary trigger (first 3 days of month) ──
  if (todayDay <= MONTHLY_TRIGGER_DAY_MAX) {
    const reportMonth = prevMonth(todayMonth);
    triggers.push({
      type: "monthly_summary",
      dedupKey: reportMonth, // e.g. "2026-01"
    });
  }

  // ── Inactivity trigger (15+ days) ──
  const inactivityDays = calcInactivityDays(lastReceiptDate, todayISO);
  if (inactivityDays >= INACTIVITY_DAYS_THRESHOLD) {
    triggers.push({
      type: "inactivity_15d",
      dedupKey: todayMonth, // max 1 per month
    });
  }

  // ── Threshold triggers (50%, 75%, 100% of €85k) ──
  // Filter to current fiscal year only (receipts may include prev year for monthly summary)
  const currentYearPrefix = `${context.fiscalYear}-`;
  const currentYearReceipts = receipts.filter((r) => r.receipt_date.startsWith(currentYearPrefix));
  const totalYTD = currentYearReceipts.reduce((sum, r) => sum + Number(r.gross_amount), 0);
  const progress = calcThresholdProgress(totalYTD);

  for (const milestone of progress.milestones) {
    if (milestone.reached) {
      const triggerType = `threshold_${milestone.value}` as DigestTriggerType;
      triggers.push({
        type: triggerType,
        dedupKey: `${context.fiscalYear}:${milestone.value}`, // "2026:50" — max 1 per fiscal year
      });
    }
  }

  return triggers;
}

/**
 * Build the notification title for a given trigger.
 */
export function buildDigestTitle(
  trigger: DigestTrigger,
  context: DigestContext,
): string {
  const { receipts, todayISO, lastReceiptDate } = context;

  switch (trigger.type) {
    case "monthly_summary": {
      // Report month = month before today
      const reportMonth = trigger.dedupKey; // "YYYY-MM"
      const monthReceipts = receipts.filter(
        (r) => extractMonth(r.receipt_date) === reportMonth,
      );
      const count = monthReceipts.length;
      const total = monthReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      const monthName = monthLabel(reportMonth);

      if (count === 0) return `${monthName}: nessun incasso registrato`;
      return `${monthName}: ${count} incass${count === 1 ? "o" : "i"} per ${formatEuroSimple(total)}`;
    }

    case "inactivity_15d": {
      const days = calcInactivityDays(lastReceiptDate, todayISO);
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

/**
 * Build the notification body for a given trigger.
 */
export function buildDigestBody(
  trigger: DigestTrigger,
  context: DigestContext,
): string {
  const { receipts, nextDeadlineDays, nextDeadlineLabel, fiscalYear } = context;

  const deadlinePart =
    nextDeadlineDays != null && nextDeadlineLabel
      ? `Prossima scadenza tra ${nextDeadlineDays} giorni.`
      : "";

  // Filter to current fiscal year for YTD calculations
  const currentYearPrefix = `${fiscalYear}-`;
  const currentYearReceipts = receipts.filter((r) => r.receipt_date.startsWith(currentYearPrefix));

  switch (trigger.type) {
    case "monthly_summary": {
      const reportMonth = trigger.dedupKey;
      const prev = prevMonth(reportMonth);
      const comparison = calcMonthlyComparison(receipts, reportMonth, prev);

      if (comparison.currentMonthCount === 0) {
        return `Puoi registrare i tuoi incassi in qualsiasi momento dalla dashboard. ${deadlinePart}`.trim();
      }

      const parts: string[] = [];
      if (comparison.variationPercent !== null) {
        const sign = comparison.variationPercent >= 0 ? "+" : "";
        parts.push(
          `Rispetto a ${monthLabel(prev)}: ${sign}${comparison.variationPercent}%.`,
        );
      } else if (comparison.currentMonthCount > 0) {
        parts.push("Primo mese con incassi registrati.");
      }
      // AC #2: include totale YTD e % soglia raggiunta
      const totalYTD = currentYearReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      const pctSoglia = totalYTD <= 0 ? 0 : Math.round((totalYTD / THRESHOLD_LIMIT) * 100);
      parts.push(`Totale YTD: ${formatEuroSimple(totalYTD)} (${pctSoglia}% soglia).`);
      if (deadlinePart) parts.push(deadlinePart);
      return parts.join(" ");
    }

    case "inactivity_15d":
      return `Tutto ok? Puoi registrare i tuoi incassi quando vuoi. ${deadlinePart}`.trim();

    case "threshold_50": {
      const total = currentYearReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      return `I tuoi incassi YTD: ${formatEuroSimple(total)}. Soglia regime forfettario: ${formatEuroSimple(THRESHOLD_LIMIT)}.`;
    }

    case "threshold_75": {
      const total = currentYearReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      return `I tuoi incassi YTD: ${formatEuroSimple(total)}. Monitora con attenzione la soglia ${formatEuroSimple(THRESHOLD_LIMIT)}.`;
    }

    case "threshold_100": {
      const total = currentYearReceipts.reduce((s, r) => s + Number(r.gross_amount), 0);
      return `I tuoi incassi YTD: ${formatEuroSimple(total)}. Verifica col tuo commercialista l'impatto sull'anno prossimo.`;
    }

    default:
      return "";
  }
}

/**
 * Build a complete notification payload for a trigger.
 */
export function buildDigestPayload(
  trigger: DigestTrigger,
  context: DigestContext,
): DigestNotificationPayload {
  return {
    type: TRIGGER_TO_NOTIF_TYPE[trigger.type],
    category: "insights",
    title: buildDigestTitle(trigger, context),
    body: buildDigestBody(trigger, context),
    action_url: "/dashboard",
    action_label: "Vedi Dashboard",
    metadata: {
      trigger_type: trigger.type,
      period: trigger.dedupKey,
      fiscal_year: context.fiscalYear,
      generated_at: context.todayISO,
    },
  };
}

// ── Helpers ──

/** Italian month name from "YYYY-MM" string. */
function monthLabel(yearMonth: string): string {
  const monthNames = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];
  const m = parseInt(yearMonth.split("-")[1], 10);
  return monthNames[m - 1] ?? yearMonth;
}
