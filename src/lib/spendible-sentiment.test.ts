import { describe, it, expect } from "vitest";
import {
  deriveSpendibileSentiment,
  deriveSpendibileTrend,
  SENTIMENT_CONFIG,
} from "./spendible-sentiment";

// ── deriveSpendibileSentiment ──

describe("deriveSpendibileSentiment", () => {
  it('returns "critical" when spendable is 0', () => {
    expect(deriveSpendibileSentiment(0, 10000, 0)).toBe("critical");
  });

  it('returns "critical" when spendable is negative', () => {
    expect(deriveSpendibileSentiment(-500, 10000, 0)).toBe("critical");
  });

  it('returns "warning" when ratio < 15%', () => {
    // 1000 / 10000 = 10% < 15%
    expect(deriveSpendibileSentiment(1000, 10000, 0)).toBe("warning");
  });

  it('returns "warning" when unpaid obligations exceed spendable', () => {
    // Spendable 5000 but unpaid 6000
    expect(deriveSpendibileSentiment(5000, 20000, 6000)).toBe("warning");
  });

  it('returns "positive" when margin is healthy', () => {
    // 5000 / 10000 = 50% > 15% and no unpaid exceeding
    expect(deriveSpendibileSentiment(5000, 10000, 0)).toBe("positive");
  });

  it('returns "positive" at exactly 15% ratio', () => {
    // 1500 / 10000 = 15% — boundary (not strictly less than)
    expect(deriveSpendibileSentiment(1500, 10000, 0)).toBe("positive");
  });

  it('returns "positive" when unpaid equals spendable (not exceeding)', () => {
    expect(deriveSpendibileSentiment(5000, 20000, 5000)).toBe("positive");
  });

  it("handles zero incassi gracefully (no division by zero)", () => {
    // spendable > 0 but incassiYTD = 0 → ratio = spendable / 1 = very high
    expect(deriveSpendibileSentiment(100, 0, 0)).toBe("positive");
  });

  it('returns "critical" with zero spendable even when incassi are zero', () => {
    expect(deriveSpendibileSentiment(0, 0, 0)).toBe("critical");
  });
});

// ── SENTIMENT_CONFIG ──

describe("SENTIMENT_CONFIG", () => {
  it("has config for all three sentiments", () => {
    expect(SENTIMENT_CONFIG.positive.message).toBe("Situazione sana");
    expect(SENTIMENT_CONFIG.warning.message).toBe("Attenzione: margine basso");
    expect(SENTIMENT_CONFIG.critical.message).toBe("Spendibile azzerato");
  });

  it("each config has colorClass, dotClass, and message", () => {
    for (const key of ["positive", "warning", "critical"] as const) {
      expect(SENTIMENT_CONFIG[key].colorClass).toBeTruthy();
      expect(SENTIMENT_CONFIG[key].dotClass).toBeTruthy();
      expect(SENTIMENT_CONFIG[key].message).toBeTruthy();
    }
  });
});

// ── deriveSpendibileTrend ──

describe("deriveSpendibileTrend", () => {
  const makeReceipt = (date: string, amount: number) => ({
    receipt_date: date,
    gross_amount: amount,
  });

  it("returns null for January (month 0, no previous month)", () => {
    const receipts = [makeReceipt("2026-01-15", 5000)];
    expect(deriveSpendibileTrend(receipts, 0)).toBeNull();
  });

  it("returns null when both months have zero receipts", () => {
    expect(deriveSpendibileTrend([], 3)).toBeNull();
  });

  it('returns "up" with percent when current month > previous', () => {
    const receipts = [
      makeReceipt("2026-02-10", 3000), // February (prev)
      makeReceipt("2026-03-10", 6000), // March (current)
    ];
    const trend = deriveSpendibileTrend(receipts, 2); // March = index 2
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe("up");
    expect(trend!.percent).toBe(100); // +100%
    expect(trend!.label).toBe("vs mese scorso");
  });

  it('returns "down" with negative percent when current < previous', () => {
    const receipts = [
      makeReceipt("2026-02-10", 8000),
      makeReceipt("2026-03-10", 4000),
    ];
    const trend = deriveSpendibileTrend(receipts, 2);
    expect(trend!.direction).toBe("down");
    expect(trend!.percent).toBe(-50);
  });

  it('returns "flat" when amounts are equal', () => {
    const receipts = [
      makeReceipt("2026-04-10", 5000),
      makeReceipt("2026-05-10", 5000),
    ];
    const trend = deriveSpendibileTrend(receipts, 4); // May = index 4
    expect(trend!.direction).toBe("flat");
    expect(trend!.percent).toBe(0);
  });

  it('returns "up" with null percent when previous month had 0 but current has data', () => {
    const receipts = [makeReceipt("2026-03-10", 5000)];
    const trend = deriveSpendibileTrend(receipts, 2); // March, February had 0
    expect(trend!.direction).toBe("up");
    expect(trend!.percent).toBeNull();
  });

  it("aggregates multiple receipts within each month", () => {
    const receipts = [
      makeReceipt("2026-02-05", 1000),
      makeReceipt("2026-02-20", 2000),
      makeReceipt("2026-03-10", 4500),
      makeReceipt("2026-03-25", 500),
    ];
    const trend = deriveSpendibileTrend(receipts, 2);
    // prev = 3000, current = 5000 → +67%
    expect(trend!.direction).toBe("up");
    expect(trend!.percent).toBe(67);
  });

  it("handles December (month 11) comparing to November (month 10)", () => {
    const receipts = [
      makeReceipt("2026-11-10", 4000),
      makeReceipt("2026-12-10", 3000),
    ];
    const trend = deriveSpendibileTrend(receipts, 11);
    expect(trend!.direction).toBe("down");
    expect(trend!.percent).toBe(-25);
  });

  it("ignores receipts from other months", () => {
    const receipts = [
      makeReceipt("2026-01-10", 9999), // ignored
      makeReceipt("2026-04-10", 2000), // prev (April)
      makeReceipt("2026-05-10", 3000), // current (May)
      makeReceipt("2026-06-10", 9999), // ignored
    ];
    const trend = deriveSpendibileTrend(receipts, 4);
    expect(trend!.percent).toBe(50);
  });
});
