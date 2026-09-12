/**
 * deadline-notifications.edge-cases.test.ts
 *
 * Story 9.3 TEA — Additional edge-case tests for pure notification logic.
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
// NOTE: makeSchedule duplicated from deadline-notifications.test.ts intentionally
// to keep edge-case file self-contained. If defaults change, update both files.

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

// ── daysUntilFromDate edge cases ──

describe("daysUntilFromDate edge cases", () => {
  it("month boundary: Feb 28 → Mar 1 = 1 day", () => {
    expect(daysUntilFromDate("2026-03-01", "2026-02-28")).toBe(1);
  });

  it("year boundary: Dec 31 → Jan 1 = 1 day", () => {
    expect(daysUntilFromDate("2026-01-01", "2025-12-31")).toBe(1);
  });

  it("same date returns 0", () => {
    expect(daysUntilFromDate("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("far future: Jan 1 2026 → Jan 1 2027 = 365 days", () => {
    expect(daysUntilFromDate("2027-01-01", "2026-01-01")).toBe(365);
  });

  it("leap year: Feb 28 → Mar 1 2024 = 2 days (2024 is leap)", () => {
    expect(daysUntilFromDate("2024-03-01", "2024-02-28")).toBe(2);
  });

  it("negative result: past due date returns negative integer", () => {
    expect(daysUntilFromDate("2026-06-10", "2026-06-16")).toBe(-6);
  });
});

// ── formatEuro edge cases ──

describe("formatEuro edge cases", () => {
  it("very large amount: 99999.99", () => {
    const result = formatEuro(99999.99);
    expect(result).toMatch(/99[.\s]?999,99/);
    expect(result).toMatch(/€/);
  });

  it("very small amount: 0.01", () => {
    const result = formatEuro(0.01);
    expect(result).toContain("0,01");
    expect(result).toMatch(/€/);
  });

  it("rounding: 1.555 rounds to 1,56 (banker's rounding)", () => {
    const result = formatEuro(1.555);
    // Intl.NumberFormat uses IEEE 754 rounding: 1.555 → 1.56
    expect(result).toContain("1,56");
    expect(result).toMatch(/€/);
  });

  it("negative amount does not throw", () => {
    // total_expected should always be positive, but formatEuro must not crash
    const result = formatEuro(-100);
    expect(result).toContain("100,00");
    expect(result).toMatch(/€/);
    expect(result).toMatch(/-/);
  });
});

// ── formatDateShort additional months ──

describe("formatDateShort additional months", () => {
  it("January 1st 2026", () => {
    const result = formatDateShort("2026-01-01");
    // Use word boundary to avoid matching "1" inside year or month name
    expect(result).toMatch(/\b1\b/);
    expect(result).toMatch(/2026/);
    // Verify month component is January (it-IT: "gen")
    expect(result).toMatch(/gen/i);
  });

  it("December 31st 2026", () => {
    const result = formatDateShort("2026-12-31");
    expect(result).toMatch(/31/);
    expect(result).toMatch(/2026/);
    // Verify month component is December (it-IT: "dic")
    expect(result).toMatch(/dic/i);
  });
});

// ── generateNotificationPayloads critical edge cases ──

describe("generateNotificationPayloads edge cases", () => {
  it("P0: multiple schedules same day, same threshold → 2 payloads", () => {
    const schedules = [
      makeSchedule({ id: "s1", bucket: "june", due_date: "2026-06-16" }),
      makeSchedule({ id: "s2", bucket: "saldo_tax", due_date: "2026-06-16" }),
    ];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(2);
    expect(payloads[0].metadata.schedule_id).toBe("s1");
    expect(payloads[1].metadata.schedule_id).toBe("s2");
  });

  it("P0: user_id propagated correctly", () => {
    const schedules = [
      makeSchedule({ id: "s1", user_id: "user-xyz", due_date: "2026-06-16" }),
    ];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(1);
    expect(payloads[0].user_id).toBe("user-xyz");
  });

  it("P0: metadata has exactly 4 keys (exact match)", () => {
    const schedules = [makeSchedule({ due_date: "2026-06-16" })];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(1);
    // Sorted exact match — no extra keys allowed, no ambiguity
    expect(Object.keys(payloads[0].metadata).sort()).toEqual(
      ["amount", "days_until", "due_date", "schedule_id"],
    );
  });

  it("P1: mixed statuses — open + partial included, paid excluded", () => {
    const schedules = [
      makeSchedule({ id: "s1", status: "open", due_date: "2026-06-16" }),
      makeSchedule({ id: "s2", status: "partial", due_date: "2026-06-16" }),
      makeSchedule({ id: "s3", status: "paid", due_date: "2026-06-16" }),
    ];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(2);
    const ids = payloads.map((p) => p.metadata.schedule_id);
    expect(ids).toContain("s1");
    expect(ids).toContain("s2");
    expect(ids).not.toContain("s3");
  });

  it("P1: all non-threshold days produce empty (positive offsets)", () => {
    // Explicit [today, dueDate] pairs — no inline date arithmetic
    const cases: [string, string][] = [
      ["2026-06-15", "2026-06-16"], // 1 day
      ["2026-06-14", "2026-06-16"], // 2 days
      ["2026-06-12", "2026-06-16"], // 4 days
      ["2026-06-11", "2026-06-16"], // 5 days
      ["2026-06-10", "2026-06-16"], // 6 days
      ["2026-06-08", "2026-06-16"], // 8 days
      ["2026-06-07", "2026-06-16"], // 9 days
      ["2026-06-06", "2026-06-16"], // 10 days
      ["2026-05-17", "2026-06-16"], // 30 days — large offset, still not a threshold
    ];
    for (const [today, dueDate] of cases) {
      const schedules = [makeSchedule({ due_date: dueDate })];
      const payloads = generateNotificationPayloads(schedules, today);
      expect(payloads).toHaveLength(0);
    }
  });

  it("P1: past-due schedules (negative days) produce empty", () => {
    // User logs in late — due_date already passed, should NOT generate notifications
    const cases: [string, string][] = [
      ["2026-06-17", "2026-06-16"], // -1 day
      ["2026-06-19", "2026-06-16"], // -3 days
      ["2026-06-23", "2026-06-16"], // -7 days
    ];
    for (const [today, dueDate] of cases) {
      const schedules = [makeSchedule({ due_date: dueDate })];
      const payloads = generateNotificationPayloads(schedules, today);
      expect(payloads).toHaveLength(0);
    }
  });

  it("P2: unknown status still generates notification (not paid)", () => {
    const schedules = [
      makeSchedule({ status: "unknown", due_date: "2026-06-16" }),
    ];
    const payloads = generateNotificationPayloads(schedules, "2026-06-09");
    expect(payloads).toHaveLength(1);
  });
});

// ── buildNotificationPayload edge cases ──

describe("buildNotificationPayload edge cases", () => {
  it("P0: payload user_id equals schedule user_id", () => {
    const schedule = makeSchedule({ user_id: "user-custom-123" });
    const payload = buildNotificationPayload(schedule, 7);
    expect(payload).not.toBeNull();
    expect(payload!.user_id).toBe("user-custom-123");
  });

  it("P0: action_url is /scadenziario for 7-day threshold", () => {
    const payload = buildNotificationPayload(makeSchedule(), 7);
    expect(payload!.action_url).toBe("/scadenziario");
  });

  it("P0: action_url is /scadenziario for 3-day threshold", () => {
    const payload = buildNotificationPayload(makeSchedule(), 3);
    expect(payload!.action_url).toBe("/scadenziario");
  });

  it("P0: action_url is /scadenziario for today threshold", () => {
    const payload = buildNotificationPayload(makeSchedule(), 0);
    expect(payload!.action_url).toBe("/scadenziario");
  });

  it("P0: body uses 'Oggi scade' for today threshold (0 days)", () => {
    const payload = buildNotificationPayload(makeSchedule(), 0);
    expect(payload).not.toBeNull();
    expect(payload!.body).toMatch(/Oggi scade/);
    expect(payload!.body).toMatch(/Rata Giugno/);
  });

  it("P0: body uses 'Scadenza ... il ...' for non-today threshold (7 days)", () => {
    const payload = buildNotificationPayload(makeSchedule(), 7);
    expect(payload).not.toBeNull();
    expect(payload!.body).toMatch(/Scadenza Rata Giugno/);
    expect(payload!.body).toMatch(/il /);
  });

  it("P0: category is always 'scadenze'", () => {
    for (const days of [0, 3, 7]) {
      const payload = buildNotificationPayload(makeSchedule(), days);
      expect(payload).not.toBeNull();
      expect(payload!.category).toBe("scadenze");
    }
  });

  it("P0: action_label is always 'Vai allo Scadenziario'", () => {
    for (const days of [0, 3, 7]) {
      const payload = buildNotificationPayload(makeSchedule(), days);
      expect(payload).not.toBeNull();
      expect(payload!.action_label).toBe("Vai allo Scadenziario");
    }
  });

  it("P2: unknown bucket falls back to 'Scadenza Fiscale' in title", () => {
    const schedule = makeSchedule({ bucket: "nonexistent_bucket" });
    const payload = buildNotificationPayload(schedule, 7);
    expect(payload).not.toBeNull();
    expect(payload!.title).toBe("Tra 7 giorni: Scadenza Fiscale");
  });
});

// ── dedupKey edge cases ──

describe("dedupKey edge cases", () => {
  it("P2: empty string inputs produce valid key", () => {
    const key = dedupKey("", "", "deadline_today");
    expect(key).toBe("::deadline_today");
    expect(typeof key).toBe("string");
  });

  it("P2: different schedule IDs produce distinct keys", () => {
    const keyA = dedupKey("user-1", "sched-A", "deadline_reminder_7d");
    const keyB = dedupKey("user-1", "sched-B", "deadline_reminder_7d");
    expect(keyA).not.toBe(keyB);
  });

  it("P2: different user IDs produce distinct keys", () => {
    const keyA = dedupKey("user-1", "sched-1", "deadline_today");
    const keyB = dedupKey("user-2", "sched-1", "deadline_today");
    expect(keyA).not.toBe(keyB);
  });

  it("P2: IDs with special chars do not break", () => {
    // NOTE: dedupKey uses ":" as separator, so IDs containing ":"
    // can produce ambiguous keys (e.g. "user:1" + "s" vs "user" + "1:s").
    // Acceptable because UUIDs from Supabase never contain ":".
    const key = dedupKey("user:1", "sched/2", "deadline_reminder_7d");
    expect(key).toBe("user:1:sched/2:deadline_reminder_7d");
    expect(typeof key).toBe("string");
  });
});
