/**
 * spendible-sentiment.ts
 *
 * Pure functions for deriving sentiment and trend indicators
 * for the SpendibileHero dashboard component.
 *
 * Epic 13 — Dashboard Redesign 3-Zone Layout
 *
 * NO React / Supabase deps — fully testable in isolation.
 */

// ── Types ──

export type SpendibileSentiment = "positive" | "warning" | "critical";

export interface SpendibileTrend {
  direction: "up" | "down" | "flat";
  /** Month-over-month percentage change. null if previous month had 0 receipts. */
  percent: number | null;
  /** Human-readable label, e.g. "vs mese scorso" */
  label: string;
}

// ── Sentiment ──

/**
 * Derive the sentiment indicator for the spendibile hero card.
 *
 * - `critical`: spendibile <= 0
 * - `warning`:  spendibile/incassi ratio < 15% OR unpaid obligations exceed spendibile
 * - `positive`: healthy margin
 */
export function deriveSpendibileSentiment(
  spendable: number,
  incassiYTD: number,
  unpaidCurrentYearTotal: number,
): SpendibileSentiment {
  if (spendable <= 0) return "critical";
  const ratio = spendable / Math.max(incassiYTD, 1);
  if (ratio < 0.15 || unpaidCurrentYearTotal > spendable) return "warning";
  return "positive";
}

/** Visual mapping for sentiment display. */
export const SENTIMENT_CONFIG: Record<
  SpendibileSentiment,
  { colorClass: string; dotClass: string; message: string }
> = {
  positive: {
    colorClass: "text-teal-700",
    dotClass: "bg-teal-500",
    message: "Situazione sana",
  },
  warning: {
    colorClass: "text-amber-700",
    dotClass: "bg-amber-500",
    message: "Attenzione: margine basso",
  },
  critical: {
    colorClass: "text-red-700",
    dotClass: "bg-red-500",
    message: "Spendibile azzerato",
  },
};

// ── Trend ──

interface ReceiptForTrend {
  receipt_date: string; // "YYYY-MM-DD"
  gross_amount: number;
}

/**
 * Derive month-over-month trend from receipt data.
 *
 * Compares gross receipts of `currentMonth` vs the previous month.
 * Returns `null` if:
 *   - currentMonth is January (month index 0) — no previous month in same fiscal year
 *   - both months have 0 receipts — no meaningful trend
 *
 * @param receipts All receipts for the fiscal year
 * @param currentMonth 0-based month index (0 = January)
 */
export function deriveSpendibileTrend(
  receipts: ReceiptForTrend[],
  currentMonth: number,
): SpendibileTrend | null {
  // No previous month to compare against within the same year
  if (currentMonth <= 0) return null;

  const currentMonthStr = String(currentMonth + 1).padStart(2, "0");
  const prevMonthStr = String(currentMonth).padStart(2, "0");

  let currentTotal = 0;
  let prevTotal = 0;

  for (const r of receipts) {
    // Extract month from "YYYY-MM-DD" — safe slice
    const monthPart = r.receipt_date.slice(5, 7);
    const amount = Number(r.gross_amount) || 0;
    if (monthPart === currentMonthStr) {
      currentTotal += amount;
    } else if (monthPart === prevMonthStr) {
      prevTotal += amount;
    }
  }

  // Both months empty — no meaningful trend
  if (currentTotal === 0 && prevTotal === 0) return null;

  if (prevTotal === 0) {
    // Had nothing last month, now have something — clear uptrend but no %
    return {
      direction: "up",
      percent: null,
      label: "vs mese scorso",
    };
  }

  const change = ((currentTotal - prevTotal) / prevTotal) * 100;
  const rounded = Math.round(change);

  let direction: "up" | "down" | "flat";
  if (rounded > 0) direction = "up";
  else if (rounded < 0) direction = "down";
  else direction = "flat";

  return {
    direction,
    percent: rounded,
    label: "vs mese scorso",
  };
}
