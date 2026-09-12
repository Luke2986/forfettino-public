/**
 * deadline-notifications.test.ts
 *
 * Story 9.3 — Tests for pure notification generation logic.
 * Covers: thresholds, formatting, dedup, paid filter, all bucket types.
 */
import { describe, it, expect } from "vitest";
import {
  bucketToLabel,
  formatEuro,
  formatDateShort,
  daysUntilFromDate,
  buildNotificationPayload,
  generateNotificationPayloads,
  dedupKey,
  type ScheduleInput,
} from "./deadline-notifications";

// ── Helpers ──

function makeSchedule(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    id: "sched-001",
    user_id: "user-abc",
    bucket: "june",
    due_date: "2026-06-16",
    total_expected: 1500.5,
    status: "open",
    ...overrides,
  };
}

// ── bucketToLabel ──

describe("bucketToLabel", () => {
  it("maps known buckets to Italian labels", () => {
    expect(bucketToLabel("june")).toBe("Rata Giugno");
    expect(bucketToLabel("november")).toBe("Rata Novembre");
    expect(bucketToLabel("inps_q1")).toBe("Rata INPS Q1 (Feb)");
    expect(bucketToLabel("inps_q2")).toBe("Rata INPS Q2 (Mag)");
    expect(bucketToLabel("inps_q3")).toBe("Rata INPS Q3 (Ago)");
    expect(bucketToLabel("inps_q4")).toBe("Rata INPS Q4 (Nov)");
    expect(bucketToLabel("saldo_tax")).toBe("Saldo Imposta");
    expect(bucketToLabel("saldo_inps")).toBe("Saldo INPS");
    expect(bucketToLabel("acconto_tax_1")).toBe("I° Acconto Imposta");
    expect(bucketToLabel("acconto_tax_2")).toBe("II° Acconto Imposta");
    expect(bucketToLabel("acconto_inps_1")).toBe("I° Acconto INPS");
    expect(bucketToLabel("acconto_inps_2")).toBe("II° Acconto INPS");
  });

  it("returns fallback for unknown bucket", () => {
    expect(bucketToLabel("unknown_bucket")).toBe("Scadenza Fiscale");
  });
});

// ── formatEuro ──

describe("formatEuro", () => {
  it("formats euros in Italian locale", () => {
    const result = formatEuro(1500.5);
    // jsdom Intl.NumberFormat("it-IT") not fully supported — use regex
    expect(result).toMatch(/1[.\s]?500,50/);
    expect(result).toMatch(/€/);
  });

  it("formats zero", () => {
    const result = formatEuro(0);
    expect(result).toContain("0,00");
  });
});

// ── formatDateShort ──

describe("formatDateShort", () => {
  it("formats date in Italian short format", () => {
    const result = formatDateShort("2026-06-16");
    // Accept various formats: "16 giu 2026" or similar
    expect(result).toMatch(/16/);
    expect(result).toMatch(/2026/);
  });
});

// ── daysUntilFromDate ──

describe("daysUntilFromDate", () => {
  it("returns 0 when due date is today", () => {
    expect(daysUntilFromDate("2026-06-16", "2026-06-16")).toBe(0);
  });

  it("returns 7 when due date is 7 days ahead", () => {
    expect(daysUntilFromDate("2026-06-16", "2026-06-09")).toBe(7);
  });

  it("returns 3 when due date is 3 days ahead", () => {
    expect(daysUntilFromDate("2026-06-16", "2026-06-13")).toBe(3);
  });

  it("returns negative for past dates", () => {
    expect(daysUntilFromDate("2026-06-10", "2026-06-16")).toBe(-6);
  });

  it("returns 1 for tomorrow", () => {
    expect(daysUntilFromDate("2026-06-17", "2026-06-16")).toBe(1);
  });
});

// ── buildNotificationPayload ──

describe("buildNotificationPayload", () => {
  const schedule = makeSchedule();

  it("returns payload for 7-day threshold", () => {
    const payload = buildNotificationPayload(schedule, 7);
    expect(payload).not.toBeNull();
    expect(payload!.type).toBe("deadline_reminder_7d");
    expect(payload!.category).toBe("scadenze");
    expect(payload!.title).toBe("Tra 7 giorni: Rata Giugno");
    expect(payload!.body).toContain("Scadenza Rata Giugno");
    expect(payload!.body).toMatch(/1[.\s]?500,50/);
    expect(payload!.action_url).toBe("/scadenziario");
    expect(payload!.action_label).toBe("Vai allo Scadenziario");
    expect(payload!.metadata.schedule_id).toBe("sched-001");
    expect(payload!.metadata.days_until).toBe(7);
    expect(payload!.metadata.due_date).toBe("2026-06-16");
    expect(payload!.metadata.amount).toBe(1500.5);
  });

  it("returns payload for 3-day threshold", () => {
    const payload = buildNotificationPayload(schedule, 3);
    expect(payload).not.toBeNull();
    expect(payload!.type).toBe("deadline_reminder_3d");
    expect(payload!.title).toBe("Tra 3 giorni: Rata Giugno");
  });

  it("returns payload for today (0 days)", () => {
    const payload = buildNotificationPayload(schedule, 0);
    expect(payload).not.toBeNull();
    expect(payload!.type).toBe("deadline_today");
    expect(payload!.title).toBe("Oggi: Rata Giugno");
    expect(payload!.body).toContain("Oggi scade Rata Giugno");
  });

  it("returns null for non-threshold days", () => {
    expect(buildNotificationPayload(schedule, 5)).toBeNull();
    expect(buildNotificationPayload(schedule, 1)).toBeNull();
    expect(buildNotificationPayload(schedule, 10)).toBeNull();
    expect(buildNotificationPayload(schedule, -1)).toBeNull();
  });

  it("uses correct label for INPS bucket", () => {
    const inpsSchedule = makeSchedule({ bucket: "inps_q2" });
    const payload = buildNotificationPayload(inpsSchedule, 7);
    expect(payload!.title).toBe("Tra 7 giorni: Rata INPS Q2 (Mag)");
  });

  it("uses correct label for saldo_tax bucket", () => {
    const taxSchedule = makeSchedule({ bucket: "saldo_tax" });
    const payload = buildNotificationPayload(taxSchedule, 0);
    expect(payload!.title).toBe("Oggi: Saldo Imposta");
  });
});

// ── generateNotificationPayloads ──

describe("generateNotificationPayloads", () => {
  it("generates notification for schedule due in 7 days (AC #1)", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(1);
    expect(payloads[0].type).toBe("deadline_reminder_7d");
  });

  it("generates notification for schedule due in 3 days (AC #2)", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-13");
    expect(payloads).toHaveLength(1);
    expect(payloads[0].type).toBe("deadline_reminder_3d");
  });

  it("generates notification for schedule due today (AC #3)", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-16");
    expect(payloads).toHaveLength(1);
    expect(payloads[0].type).toBe("deadline_today");
  });

  it("skips paid schedules (AC #5)", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16", status: "paid" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(0);
  });

  it("includes partial status schedules", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16", status: "partial" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(1);
  });

  it("skips schedules not matching any threshold", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-11"); // 5 days
    expect(payloads).toHaveLength(0);
  });

  it("generates multiple payloads for different schedules", () => {
    const schedules = [
      makeSchedule({ id: "s1", bucket: "inps_q1", due_date: "2026-02-16" }),
      makeSchedule({ id: "s2", bucket: "inps_q2", due_date: "2026-05-16" }),
      makeSchedule({ id: "s3", bucket: "june", due_date: "2026-06-16" }),
    ];
    // Today is 2026-02-09 → inps_q1 is 7 days away, others are far
    const payloads = generateNotificationPayloads(schedules, "2026-02-09");
    expect(payloads).toHaveLength(1);
    expect(payloads[0].metadata.schedule_id).toBe("s1");
    expect(payloads[0].type).toBe("deadline_reminder_7d");
  });

  it("handles empty schedule list", () => {
    const payloads = generateNotificationPayloads([], "2026-06-16");
    expect(payloads).toHaveLength(0);
  });

  it("handles all 12 bucket types correctly", () => {
    const allBuckets = [
      "june", "november", "inps_q1", "inps_q2", "inps_q3", "inps_q4",
      "saldo_tax", "saldo_inps", "acconto_tax_1", "acconto_tax_2",
      "acconto_inps_1", "acconto_inps_2",
    ];

    for (const bucket of allBuckets) {
      const schedules = [makeSchedule({ bucket, due_date: "2026-06-16" })];
      const payloads = generateNotificationPayloads(schedules, "2026-06-09");
      expect(payloads).toHaveLength(1);
      // june/november seguono il mese della scadenza: passare il due_date anche
      // all'asserzione per allinearsi al label date-driven
      expect(payloads[0].title).toContain(bucketToLabel(bucket, "2026-06-16"));
    }
  });
});

// ── dedupKey ──

describe("dedupKey", () => {
  it("produces consistent key format", () => {
    expect(dedupKey("user-1", "sched-1", "deadline_reminder_7d")).toBe(
      "user-1:sched-1:deadline_reminder_7d",
    );
  });

  it("produces different keys for different types", () => {
    const key7 = dedupKey("u", "s", "deadline_reminder_7d");
    const key3 = dedupKey("u", "s", "deadline_reminder_3d");
    const key0 = dedupKey("u", "s", "deadline_today");
    expect(key7).not.toBe(key3);
    expect(key3).not.toBe(key0);
  });
});
