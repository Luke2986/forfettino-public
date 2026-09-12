/**
 * Unit tests for aggregate() and computeMedian() — pure functions in useAdminBenchmarkStats.
 * These test the aggregation logic that is mocked away in BenchmarkUsageStats component tests.
 */

import { describe, it, expect } from "vitest";
import { aggregate, computeMedian, type EventLogRow } from "./useAdminBenchmarkStats";

// ── computeMedian ──

describe("computeMedian", () => {
  it("returns 0 for empty array", () => {
    expect(computeMedian([])).toBe(0);
  });

  it("returns the single element for array of length 1", () => {
    expect(computeMedian([42])).toBe(42);
  });

  it("returns the middle element for odd-length array", () => {
    expect(computeMedian([10, 20, 30])).toBe(20);
  });

  it("returns average of two middle elements for even-length array", () => {
    expect(computeMedian([10, 20, 30, 40])).toBe(25);
  });

  it("handles unsorted input correctly", () => {
    expect(computeMedian([30, 10, 20])).toBe(20);
  });
});

// ── aggregate ──

describe("aggregate", () => {
  it("returns empty data for empty rows", () => {
    const result = aggregate([]);
    expect(result).toEqual({
      totalViews: 0,
      uniqueUsers: 0,
      topRoles: [],
      avgPersonalRate: null,
      medianPersonalRate: null,
    });
  });

  it("counts totalViews as row count", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: { jobTitle: "dev" } },
      { user_id: "u1", props: { jobTitle: "dev" } },
      { user_id: "u2", props: { jobTitle: "dev" } },
    ];
    expect(aggregate(rows).totalViews).toBe(3);
  });

  it("counts uniqueUsers correctly", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: { jobTitle: "dev" } },
      { user_id: "u1", props: { jobTitle: "pm" } },
      { user_id: "u2", props: { jobTitle: "dev" } },
    ];
    expect(aggregate(rows).uniqueUsers).toBe(2);
  });

  it("computes top 10 roles sorted by count descending", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: { jobTitle: "backend_developer" } },
      { user_id: "u2", props: { jobTitle: "backend_developer" } },
      { user_id: "u3", props: { jobTitle: "backend_developer" } },
      { user_id: "u4", props: { jobTitle: "data_analyst" } },
      { user_id: "u5", props: { jobTitle: "data_analyst" } },
      { user_id: "u6", props: { jobTitle: "product_manager" } },
    ];
    const { topRoles } = aggregate(rows);
    expect(topRoles).toEqual([
      { jobTitle: "backend_developer", count: 3 },
      { jobTitle: "data_analyst", count: 2 },
      { jobTitle: "product_manager", count: 1 },
    ]);
  });

  it("limits topRoles to 10 entries", () => {
    const rows: EventLogRow[] = Array.from({ length: 12 }, (_, i) => ({
      user_id: `u${i}`,
      props: { jobTitle: `role_${i}` },
    }));
    const { topRoles } = aggregate(rows);
    expect(topRoles).toHaveLength(10);
  });

  it("skips rows with null props for role counting", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: null },
      { user_id: "u2", props: { jobTitle: "dev" } },
    ];
    const { topRoles } = aggregate(rows);
    expect(topRoles).toEqual([{ jobTitle: "dev", count: 1 }]);
  });

  it("computes avgPersonalRate and medianPersonalRate", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: { jobTitle: "dev", personalHourlyRate: 30 } },
      { user_id: "u2", props: { jobTitle: "dev", personalHourlyRate: 40 } },
      { user_id: "u3", props: { jobTitle: "dev", personalHourlyRate: 50 } },
    ];
    const result = aggregate(rows);
    expect(result.avgPersonalRate).toBe(40);
    expect(result.medianPersonalRate).toBe(40);
  });

  it("returns null rates when no personalHourlyRate present", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: { jobTitle: "dev" } },
    ];
    const result = aggregate(rows);
    expect(result.avgPersonalRate).toBeNull();
    expect(result.medianPersonalRate).toBeNull();
  });

  it("ignores zero and negative personalHourlyRate", () => {
    const rows: EventLogRow[] = [
      { user_id: "u1", props: { jobTitle: "dev", personalHourlyRate: 0 } },
      { user_id: "u2", props: { jobTitle: "dev", personalHourlyRate: -5 } },
      { user_id: "u3", props: { jobTitle: "dev", personalHourlyRate: 30 } },
    ];
    const result = aggregate(rows);
    expect(result.avgPersonalRate).toBe(30);
    expect(result.medianPersonalRate).toBe(30);
  });
});
