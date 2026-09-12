import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bucketToLabel,
  deriveRataType,
  rataTypeLabel,
  daysUntil,
  formatDateIT,
  getScheduleStatus,
  getRataBreakdown,
  isInpsFixedBucket,
  countInpsFixedRates,
} from "./schedule-helpers";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

// Helper per creare una schedule row minima
function makeSchedule(overrides: Partial<TaxScheduleRow> = {}): TaxScheduleRow {
  return {
    id: "test-id",
    user_id: "user-1",
    payment_year: 2026,
    reference_year: 2025,
    bucket: "june",
    due_date: "2026-06-16",
    tax_balance: 0,
    tax_advance: 0,
    inps_balance: 0,
    inps_advance: 0,
    total_expected: 1000,
    total_paid: 0,
    status: "open",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as TaxScheduleRow;
}

// ── bucketToLabel ──

describe("bucketToLabel", () => {
  it("maps all 12 known bucket values", () => {
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
    expect(bucketToLabel("")).toBe("Scadenza Fiscale");
  });

  describe("month-derived label (june/november segue il mese della scadenza)", () => {
    it("june prorogata segue il mese reale (proroga 2026: 20/07 → Rata Luglio)", () => {
      expect(bucketToLabel("june", "2026-07-20")).toBe("Rata Luglio");
    });

    it("june non prorogata resta Rata Giugno", () => {
      expect(bucketToLabel("june", "2025-06-30")).toBe("Rata Giugno");
    });

    it("november segue il mese della scadenza", () => {
      expect(bucketToLabel("november", "2026-11-30")).toBe("Rata Novembre");
    });

    it("ignora il due_date per i bucket non month-derived", () => {
      expect(bucketToLabel("saldo_tax", "2026-07-20")).toBe("Saldo Imposta");
      expect(bucketToLabel("inps_q1", "2026-07-20")).toBe("Rata INPS Q1 (Feb)");
    });

    it("parsa date-only come local time (no day-shift UTC)", () => {
      // 2026-07-01 a mezzanotte locale deve restare luglio, non scivolare a giugno
      expect(bucketToLabel("june", "2026-07-01")).toBe("Rata Luglio");
    });
  });
});

// ── deriveRataType ──

describe("deriveRataType", () => {
  it("maps INPS fixed buckets to INPS_FISSO", () => {
    expect(deriveRataType("inps_q1")).toBe("INPS_FISSO");
    expect(deriveRataType("inps_q2")).toBe("INPS_FISSO");
    expect(deriveRataType("inps_q3")).toBe("INPS_FISSO");
    expect(deriveRataType("inps_q4")).toBe("INPS_FISSO");
  });

  it("maps june/november to MISTA", () => {
    expect(deriveRataType("june")).toBe("MISTA");
    expect(deriveRataType("november")).toBe("MISTA");
  });

  it("maps tax buckets to TAX", () => {
    expect(deriveRataType("saldo_tax")).toBe("TAX");
    expect(deriveRataType("acconto_tax_1")).toBe("TAX");
    expect(deriveRataType("acconto_tax_2")).toBe("TAX");
  });

  it("maps INPS variable buckets to INPS_VARIABILE", () => {
    expect(deriveRataType("saldo_inps")).toBe("INPS_VARIABILE");
    expect(deriveRataType("acconto_inps_1")).toBe("INPS_VARIABILE");
    expect(deriveRataType("acconto_inps_2")).toBe("INPS_VARIABILE");
  });

  it("returns TAX as fallback for unknown bucket and warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(deriveRataType("unknown")).toBe("TAX");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown bucket "unknown"')
    );
    warnSpy.mockRestore();
  });
});

// ── rataTypeLabel ──

describe("rataTypeLabel", () => {
  it("returns Italian labels for all types", () => {
    expect(rataTypeLabel("INPS_FISSO")).toBe("Fissa trimestrale");
    expect(rataTypeLabel("INPS_VARIABILE")).toBe("Variabile");
    expect(rataTypeLabel("TAX")).toBe("Tasse");
    expect(rataTypeLabel("MISTA")).toBe("Mista (INPS + Tasse)");
  });
});

// ── getScheduleStatus ──

describe("getScheduleStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns pagata when status is paid", () => {
    const schedule = makeSchedule({ status: "paid", due_date: "2026-05-01" });
    expect(getScheduleStatus(schedule)).toBe("pagata");
  });

  it("returns scaduta when due_date is in the past and not paid", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-05-01" });
    expect(getScheduleStatus(schedule)).toBe("scaduta");
  });

  it("returns imminente when due within 30 days and not paid", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-06-16" });
    expect(getScheduleStatus(schedule)).toBe("imminente");
  });

  it("returns imminente when due today", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-06-01" });
    expect(getScheduleStatus(schedule)).toBe("imminente");
  });

  it("returns da_pagare when due in more than 30 days", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-08-16" });
    expect(getScheduleStatus(schedule)).toBe("da_pagare");
  });

  it("returns pagata regardless of due date when paid", () => {
    const schedule = makeSchedule({ status: "paid", due_date: "2026-08-16" });
    expect(getScheduleStatus(schedule)).toBe("pagata");
  });
});

// ── daysUntil ──

describe("daysUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns positive days for future date", () => {
    expect(daysUntil("2026-06-16")).toBe(15);
  });

  it("returns negative days for past date", () => {
    expect(daysUntil("2026-05-20")).toBe(-12);
  });

  it("returns 0 for today", () => {
    expect(daysUntil("2026-06-01")).toBe(0);
  });
});

// ── formatDateIT ──

describe("formatDateIT", () => {
  it("formats date-only string as dd/mm/yyyy", () => {
    expect(formatDateIT("2026-06-16")).toBe("16/06/2026");
  });

  it("formats ISO datetime string as dd/mm/yyyy", () => {
    expect(formatDateIT("2026-02-16T10:30:00")).toBe("16/02/2026");
  });

  it("handles winter date without timezone shift", () => {
    // This would fail with UTC parsing in CET timezone (UTC+1)
    expect(formatDateIT("2026-01-01")).toBe("01/01/2026");
  });
});

// ── getRataBreakdown ──

describe("getRataBreakdown", () => {
  it("returns minimale + maternita for INPS_FISSO bucket", () => {
    const schedule = makeSchedule({
      bucket: "inps_q1",
      inps_balance: 1000,
      inps_advance: 8,
      total_expected: 1008,
    });
    const items = getRataBreakdown(schedule);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ label: "Minimale", value: 1000 });
    expect(items[1]).toEqual({ label: "Maternità", value: 8 });
  });

  it("returns only non-zero items for INPS_FISSO", () => {
    const schedule = makeSchedule({
      bucket: "inps_q3",
      inps_balance: 1000,
      inps_advance: 0,
      total_expected: 1000,
    });
    const items = getRataBreakdown(schedule);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ label: "Minimale", value: 1000 });
  });

  it("returns all components for MISTA (june) bucket", () => {
    const schedule = makeSchedule({
      bucket: "june",
      tax_balance: 500,
      tax_advance: 300,
      inps_balance: 200,
      inps_advance: 100,
      reference_year: 2025,
      total_expected: 1100,
    });
    const items = getRataBreakdown(schedule);
    expect(items).toHaveLength(4);
    expect(items[0].label).toContain("Saldo Imposta");
    expect(items[1].label).toContain("Acconto Imposta");
    expect(items[2].label).toContain("Saldo INPS");
    expect(items[3].label).toContain("Acconto INPS");
  });

  it("includes reference year in MISTA labels", () => {
    const schedule = makeSchedule({
      bucket: "june",
      tax_balance: 500,
      tax_advance: 0,
      inps_balance: 0,
      inps_advance: 0,
      reference_year: 2025,
    });
    const items = getRataBreakdown(schedule);
    expect(items[0].label).toBe("Saldo Imposta 2025");
  });

  it("returns tax components for TAX bucket", () => {
    const schedule = makeSchedule({
      bucket: "saldo_tax",
      tax_balance: 800,
      tax_advance: 0,
    });
    const items = getRataBreakdown(schedule);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ label: "Saldo Imposta", value: 800 });
  });

  it("returns INPS components for INPS_VARIABILE bucket", () => {
    const schedule = makeSchedule({
      bucket: "saldo_inps",
      inps_balance: 600,
      inps_advance: 0,
    });
    const items = getRataBreakdown(schedule);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ label: "Saldo INPS", value: 600 });
  });

  it("returns empty array when all amounts are zero", () => {
    const schedule = makeSchedule({
      bucket: "inps_q1",
      inps_balance: 0,
      inps_advance: 0,
    });
    const items = getRataBreakdown(schedule);
    expect(items).toHaveLength(0);
  });
});

// ── isInpsFixedBucket + countInpsFixedRates ──

describe("isInpsFixedBucket", () => {
  it("returns true for inps_q1..q4", () => {
    expect(isInpsFixedBucket("inps_q1")).toBe(true);
    expect(isInpsFixedBucket("inps_q2")).toBe(true);
    expect(isInpsFixedBucket("inps_q3")).toBe(true);
    expect(isInpsFixedBucket("inps_q4")).toBe(true);
  });

  it("returns false for other buckets", () => {
    expect(isInpsFixedBucket("june")).toBe(false);
    expect(isInpsFixedBucket("november")).toBe(false);
    expect(isInpsFixedBucket("saldo_tax")).toBe(false);
  });
});

describe("countInpsFixedRates", () => {
  it("counts total and paid INPS fixed rates", () => {
    const schedules = [
      makeSchedule({ bucket: "inps_q1", status: "paid" }),
      makeSchedule({ bucket: "inps_q2", status: "paid" }),
      makeSchedule({ bucket: "inps_q3", status: "open" }),
      makeSchedule({ bucket: "inps_q4", status: "open" }),
      makeSchedule({ bucket: "june", status: "open" }),
    ];
    const result = countInpsFixedRates(schedules);
    expect(result.total).toBe(4);
    expect(result.paid).toBe(2);
  });

  it("returns 0/0 when no INPS fixed rates exist", () => {
    const schedules = [
      makeSchedule({ bucket: "june" }),
      makeSchedule({ bucket: "november" }),
    ];
    const result = countInpsFixedRates(schedules);
    expect(result.total).toBe(0);
    expect(result.paid).toBe(0);
  });

  it("handles all paid rates (4/4)", () => {
    const schedules = [
      makeSchedule({ bucket: "inps_q1", status: "paid" }),
      makeSchedule({ bucket: "inps_q2", status: "paid" }),
      makeSchedule({ bucket: "inps_q3", status: "paid" }),
      makeSchedule({ bucket: "inps_q4", status: "paid" }),
    ];
    const result = countInpsFixedRates(schedules);
    expect(result.total).toBe(4);
    expect(result.paid).toBe(4);
  });
});
