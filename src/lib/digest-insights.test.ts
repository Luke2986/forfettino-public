/**
 * digest-insights.test.ts
 *
 * Story 9.5 — Test suite for digest/insight pure functions.
 * Task 4: Almeno 20 test cases.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  evaluateDigestTriggers,
  calcMonthlyComparison,
  calcThresholdProgress,
  calcInactivityDays,
  buildDigestPayload,
  buildDigestTitle,
  buildDigestBody,
  extractMonth,
  prevMonth,
  THRESHOLD_LIMIT,
  INACTIVITY_DAYS_THRESHOLD,
  TRIGGER_TO_NOTIF_TYPE,
  type DigestContext,
  type DigestTrigger,
} from "./digest-insights";

// ── Helpers ──

function makeContext(overrides: Partial<DigestContext> = {}): DigestContext {
  return {
    receipts: [],
    todayISO: "2026-02-15",
    lastReceiptDate: "2026-02-10",
    fiscalYear: 2026,
    nextDeadlineDays: 12,
    nextDeadlineLabel: "Rata INPS Q1",
    ...overrides,
  };
}

function makeReceipts(entries: { amount: number; date: string }[]) {
  return entries.map((e) => ({ gross_amount: e.amount, receipt_date: e.date }));
}

// ── extractMonth / prevMonth ──

describe("extractMonth", () => {
  it("extracts YYYY-MM from ISO date", () => {
    expect(extractMonth("2026-01-15")).toBe("2026-01");
    expect(extractMonth("2026-12-31")).toBe("2026-12");
  });
});

describe("prevMonth", () => {
  it("returns previous month", () => {
    expect(prevMonth("2026-02")).toBe("2026-01");
    expect(prevMonth("2026-06")).toBe("2026-05");
  });

  it("handles January → December of previous year", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });
});

// ── calcInactivityDays (AC: #3, #7) ──

describe("calcInactivityDays", () => {
  it("returns 0 when last receipt is today", () => {
    expect(calcInactivityDays("2026-02-15", "2026-02-15")).toBe(0);
  });

  it("returns exact days of inactivity", () => {
    expect(calcInactivityDays("2026-02-01", "2026-02-16")).toBe(15);
  });

  it("returns 30 days for month-old receipt", () => {
    expect(calcInactivityDays("2026-01-17", "2026-02-16")).toBe(30);
  });

  it("returns Infinity when no receipt ever (null)", () => {
    expect(calcInactivityDays(null, "2026-02-15")).toBe(Infinity);
  });
});

// ── calcMonthlyComparison (AC: #2) ──

describe("calcMonthlyComparison", () => {
  it("calculates comparison between two months with receipts", () => {
    const receipts = makeReceipts([
      { amount: 3000, date: "2026-01-10" },
      { amount: 2000, date: "2026-01-20" },
      { amount: 4000, date: "2025-12-05" },
    ]);
    const result = calcMonthlyComparison(receipts, "2026-01", "2025-12");

    expect(result.currentMonthCount).toBe(2);
    expect(result.currentMonthTotal).toBe(5000);
    expect(result.prevMonthCount).toBe(1);
    expect(result.prevMonthTotal).toBe(4000);
    expect(result.variationPercent).toBe(25); // (5000-4000)/4000 * 100 = 25
  });

  it("returns null variationPercent when previous month has zero receipts", () => {
    const receipts = makeReceipts([{ amount: 3000, date: "2026-01-10" }]);
    const result = calcMonthlyComparison(receipts, "2026-01", "2025-12");

    expect(result.currentMonthCount).toBe(1);
    expect(result.prevMonthCount).toBe(0);
    expect(result.variationPercent).toBeNull();
  });

  it("handles negative variation", () => {
    const receipts = makeReceipts([
      { amount: 2000, date: "2026-01-10" },
      { amount: 5000, date: "2025-12-05" },
    ]);
    const result = calcMonthlyComparison(receipts, "2026-01", "2025-12");
    expect(result.variationPercent).toBe(-60); // (2000-5000)/5000*100 = -60
  });

  it("returns zero counts when no receipts in either month", () => {
    const result = calcMonthlyComparison([], "2026-01", "2025-12");
    expect(result.currentMonthCount).toBe(0);
    expect(result.currentMonthTotal).toBe(0);
    expect(result.prevMonthCount).toBe(0);
    expect(result.prevMonthTotal).toBe(0);
    expect(result.variationPercent).toBeNull();
  });
});

// ── calcThresholdProgress (AC: #7) ──

describe("calcThresholdProgress", () => {
  it("returns 0% for zero YTD", () => {
    const result = calcThresholdProgress(0);
    expect(result.percent).toBe(0);
    expect(result.milestones.every((m) => !m.reached)).toBe(true);
  });

  it("returns under 50% correctly", () => {
    const result = calcThresholdProgress(30000);
    expect(result.percent).toBe(35);
    expect(result.milestones[0].reached).toBe(false); // 50%
    expect(result.milestones[1].reached).toBe(false); // 75%
    expect(result.milestones[2].reached).toBe(false); // 100%
  });

  it("returns exactly 50%", () => {
    const result = calcThresholdProgress(42500);
    expect(result.percent).toBe(50);
    expect(result.milestones[0].reached).toBe(true); // 50%
    expect(result.milestones[1].reached).toBe(false); // 75%
  });

  it("returns between 50-75%", () => {
    const result = calcThresholdProgress(55000);
    expect(result.percent).toBe(65);
    expect(result.milestones[0].reached).toBe(true); // 50%
    expect(result.milestones[1].reached).toBe(false); // 75%
  });

  it("returns exactly 75%", () => {
    const result = calcThresholdProgress(63750);
    expect(result.percent).toBe(75);
    expect(result.milestones[0].reached).toBe(true);
    expect(result.milestones[1].reached).toBe(true); // 75%
    expect(result.milestones[2].reached).toBe(false); // 100%
  });

  it("returns 100% when at threshold", () => {
    const result = calcThresholdProgress(85000);
    expect(result.percent).toBe(100);
    expect(result.milestones.every((m) => m.reached)).toBe(true);
  });

  it("returns over 100% above threshold", () => {
    const result = calcThresholdProgress(90000);
    expect(result.percent).toBe(106);
    expect(result.milestones.every((m) => m.reached)).toBe(true);
  });
});

// ── evaluateDigestTriggers (AC: #1, #7) ──

describe("evaluateDigestTriggers", () => {
  it("returns monthly_summary trigger on day 1 of month", () => {
    const ctx = makeContext({ todayISO: "2026-02-01" });
    const triggers = evaluateDigestTriggers(ctx);
    const monthly = triggers.find((t) => t.type === "monthly_summary");
    expect(monthly).toBeDefined();
    expect(monthly!.dedupKey).toBe("2026-01"); // report for January
  });

  it("returns monthly_summary trigger on day 3 of month", () => {
    const ctx = makeContext({ todayISO: "2026-03-03" });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "monthly_summary")).toBe(true);
  });

  it("does NOT return monthly_summary on day 4+", () => {
    const ctx = makeContext({ todayISO: "2026-02-04" });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "monthly_summary")).toBe(false);
  });

  it("returns inactivity trigger when 15+ days inactive", () => {
    const ctx = makeContext({
      todayISO: "2026-02-20",
      lastReceiptDate: "2026-02-01", // 19 days
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "inactivity_15d")).toBe(true);
  });

  it("does NOT return inactivity trigger when recent receipt", () => {
    const ctx = makeContext({
      todayISO: "2026-02-15",
      lastReceiptDate: "2026-02-10", // 5 days
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "inactivity_15d")).toBe(false);
  });

  it("returns inactivity trigger when null lastReceiptDate (never registered)", () => {
    const ctx = makeContext({
      todayISO: "2026-02-15",
      lastReceiptDate: null,
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "inactivity_15d")).toBe(true);
  });

  it("returns threshold_50 trigger when YTD >= 50%", () => {
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 43000, date: "2026-01-15" }]),
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "threshold_50")).toBe(true);
    expect(triggers.some((t) => t.type === "threshold_75")).toBe(false);
  });

  it("returns threshold_50 AND threshold_75 when YTD >= 75%", () => {
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 65000, date: "2026-01-15" }]),
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "threshold_50")).toBe(true);
    expect(triggers.some((t) => t.type === "threshold_75")).toBe(true);
    expect(triggers.some((t) => t.type === "threshold_100")).toBe(false);
  });

  it("returns all 3 threshold triggers when YTD >= 100%", () => {
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 90000, date: "2026-01-15" }]),
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers.some((t) => t.type === "threshold_50")).toBe(true);
    expect(triggers.some((t) => t.type === "threshold_75")).toBe(true);
    expect(triggers.some((t) => t.type === "threshold_100")).toBe(true);
  });

  it("returns no triggers when no conditions are met", () => {
    const ctx = makeContext({
      todayISO: "2026-02-15", // day 15 → no monthly
      lastReceiptDate: "2026-02-10", // 5 days → no inactivity
      receipts: makeReceipts([{ amount: 10000, date: "2026-01-10" }]), // 12% → no threshold
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers).toHaveLength(0);
  });

  it("returns all 5 triggers simultaneously when all conditions are met", () => {
    // Day 1 (monthly) + null lastReceipt (inactivity) + YTD >= 100% (all 3 thresholds)
    const ctx = makeContext({
      todayISO: "2026-02-01",
      lastReceiptDate: null,
      fiscalYear: 2026,
      receipts: makeReceipts([{ amount: 90000, date: "2026-01-15" }]),
    });
    const triggers = evaluateDigestTriggers(ctx);
    expect(triggers).toHaveLength(5);
    expect(triggers.map((t) => t.type).sort()).toEqual([
      "inactivity_15d",
      "monthly_summary",
      "threshold_100",
      "threshold_50",
      "threshold_75",
    ]);
  });

  it("threshold dedupKey includes fiscal year for cross-year dedup", () => {
    const ctx = makeContext({
      todayISO: "2026-06-15",
      lastReceiptDate: "2026-06-14",
      fiscalYear: 2026,
      receipts: makeReceipts([{ amount: 50000, date: "2026-06-10" }]),
    });
    const triggers = evaluateDigestTriggers(ctx);
    const threshold50 = triggers.find((t) => t.type === "threshold_50");
    expect(threshold50).toBeDefined();
    expect(threshold50!.dedupKey).toBe("2026:50");
  });
});

// ── buildDigestTitle (AC: #1) ──

describe("buildDigestTitle", () => {
  it("builds monthly summary title with receipts", () => {
    const ctx = makeContext({
      receipts: makeReceipts([
        { amount: 3000, date: "2026-01-10" },
        { amount: 5200, date: "2026-01-20" },
      ]),
    });
    const trigger: DigestTrigger = { type: "monthly_summary", dedupKey: "2026-01" };
    const title = buildDigestTitle(trigger, ctx);
    expect(title).toMatch(/Gennaio.*2.*incassi/);
  });

  it("builds monthly summary title with zero receipts", () => {
    const ctx = makeContext({ receipts: [] });
    const trigger: DigestTrigger = { type: "monthly_summary", dedupKey: "2026-01" };
    const title = buildDigestTitle(trigger, ctx);
    expect(title).toContain("nessun incasso");
  });

  it("builds inactivity title with day count", () => {
    const ctx = makeContext({
      todayISO: "2026-02-20",
      lastReceiptDate: "2026-02-02",
    });
    const trigger: DigestTrigger = { type: "inactivity_15d", dedupKey: "2026-02" };
    const title = buildDigestTitle(trigger, ctx);
    expect(title).toContain("18 giorni");
  });

  it("builds inactivity title with 'molto tempo' when no receipt ever", () => {
    const ctx = makeContext({
      todayISO: "2026-02-20",
      lastReceiptDate: null,
    });
    const trigger: DigestTrigger = { type: "inactivity_15d", dedupKey: "2026-02" };
    const title = buildDigestTitle(trigger, ctx);
    expect(title).toContain("molto tempo");
    expect(title).not.toContain("Infinity");
  });

  it("builds threshold 50% title", () => {
    const trigger: DigestTrigger = { type: "threshold_50", dedupKey: "2026:50" };
    const title = buildDigestTitle(trigger, makeContext());
    expect(title).toContain("50%");
  });

  it("builds threshold 100% title", () => {
    const trigger: DigestTrigger = { type: "threshold_100", dedupKey: "2026:100" };
    const title = buildDigestTitle(trigger, makeContext());
    expect(title).toContain("85.000");
  });
});

// ── buildDigestBody (AC: #1, #2, #3) ──

describe("buildDigestBody", () => {
  it("builds monthly body with variation, YTD, % soglia and deadline", () => {
    const ctx = makeContext({
      receipts: makeReceipts([
        { amount: 5000, date: "2026-01-10" },
        { amount: 4000, date: "2025-12-05" },
      ]),
      fiscalYear: 2026,
      nextDeadlineDays: 12,
      nextDeadlineLabel: "Rata INPS Q1",
    });
    const trigger: DigestTrigger = { type: "monthly_summary", dedupKey: "2026-01" };
    const body = buildDigestBody(trigger, ctx);
    expect(body).toContain("+25%");
    expect(body).toMatch(/Totale YTD/);
    expect(body).toMatch(/soglia/);
    expect(body).toContain("12 giorni");
  });

  it("builds monthly body when 0 receipts in report month", () => {
    const ctx = makeContext({ receipts: [] });
    const trigger: DigestTrigger = { type: "monthly_summary", dedupKey: "2026-01" };
    const body = buildDigestBody(trigger, ctx);
    expect(body).toContain("registrare");
  });

  it("builds inactivity body with positive tone", () => {
    const ctx = makeContext({ nextDeadlineDays: 5, nextDeadlineLabel: "Rata" });
    const trigger: DigestTrigger = { type: "inactivity_15d", dedupKey: "2026-02" };
    const body = buildDigestBody(trigger, ctx);
    expect(body).toContain("Tutto ok?");
    expect(body).toContain("5 giorni");
  });

  it("builds threshold body with YTD amount", () => {
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 42500, date: "2026-01-10" }]),
    });
    const trigger: DigestTrigger = { type: "threshold_50", dedupKey: "2026:50" };
    const body = buildDigestBody(trigger, ctx);
    // Use regex to handle locale formatting differences
    expect(body).toMatch(/42[.,]?500/);
  });

  it("threshold_100 body suggests commercialista", () => {
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 87000, date: "2026-01-10" }]),
    });
    const trigger: DigestTrigger = { type: "threshold_100", dedupKey: "2026:100" };
    const body = buildDigestBody(trigger, ctx);
    expect(body).toContain("commercialista");
  });

  it("omits deadline text when nextDeadlineLabel is null", () => {
    const ctx = makeContext({
      nextDeadlineDays: 5,
      nextDeadlineLabel: null, // no label → no deadline part
    });
    const trigger: DigestTrigger = { type: "inactivity_15d", dedupKey: "2026-02" };
    const body = buildDigestBody(trigger, ctx);
    expect(body).toContain("Tutto ok?");
    expect(body).not.toContain("scadenza");
  });

  it("omits deadline text when nextDeadlineDays is null", () => {
    const ctx = makeContext({
      nextDeadlineDays: null,
      nextDeadlineLabel: "Rata INPS Q1",
    });
    const trigger: DigestTrigger = { type: "inactivity_15d", dedupKey: "2026-02" };
    const body = buildDigestBody(trigger, ctx);
    expect(body).not.toContain("scadenza");
  });
});

// ── buildDigestPayload (AC: #1, #6) ──

describe("buildDigestPayload", () => {
  it("builds complete payload with correct structure", () => {
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 5000, date: "2026-01-10" }]),
    });
    const trigger: DigestTrigger = { type: "monthly_summary", dedupKey: "2026-01" };
    const payload = buildDigestPayload(trigger, ctx);

    expect(payload.type).toBe("digest_mensile");
    expect(payload.category).toBe("insights");
    expect(payload.title).toBeTruthy();
    expect(payload.body).toBeTruthy();
    expect(payload.action_url).toBe("/dashboard");
    expect(payload.action_label).toBe("Vedi Dashboard");
    expect(payload.metadata.trigger_type).toBe("monthly_summary");
    expect(payload.metadata.period).toBe("2026-01");
    expect(payload.metadata.fiscal_year).toBe(2026);
  });

  it("all trigger types map to digest_mensile notification type", () => {
    // Story note: using single type to avoid CHECK constraint migration
    const types: DigestTrigger["type"][] = [
      "monthly_summary",
      "inactivity_15d",
      "threshold_50",
      "threshold_75",
      "threshold_100",
    ];
    const ctx = makeContext({
      receipts: makeReceipts([{ amount: 90000, date: "2026-01-10" }]),
    });

    for (const t of types) {
      const payload = buildDigestPayload({ type: t, dedupKey: "test" }, ctx);
      expect(payload.type).toBe("digest_mensile");
    }
  });

  it("payload metadata includes trigger_type for dedup differentiation", () => {
    const ctx = makeContext();
    const payload = buildDigestPayload(
      { type: "inactivity_15d", dedupKey: "2026-02" },
      ctx,
    );
    expect(payload.metadata.trigger_type).toBe("inactivity_15d");
    expect(payload.metadata.period).toBe("2026-02");
  });
});
