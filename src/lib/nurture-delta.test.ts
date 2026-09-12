import { describe, it, expect } from "vitest";
import { getEmailTypeForDelta } from "./nurture-delta";

describe("getEmailTypeForDelta", () => {
  // --- T-14 window: 12.5 <= delta <= 15.5 ---
  it("returns nurture_t14 at delta 14 (exact center)", () => {
    expect(getEmailTypeForDelta(14)).toBe("nurture_t14");
  });

  it("returns nurture_t14 at delta 12.5 (lower bound)", () => {
    expect(getEmailTypeForDelta(12.5)).toBe("nurture_t14");
  });

  it("returns nurture_t14 at delta 15.5 (upper bound)", () => {
    expect(getEmailTypeForDelta(15.5)).toBe("nurture_t14");
  });

  it("returns null at delta 12.4 (below T-14 window)", () => {
    expect(getEmailTypeForDelta(12.4)).toBeNull();
  });

  it("returns null at delta 15.6 (above T-14 window)", () => {
    expect(getEmailTypeForDelta(15.6)).toBeNull();
  });

  // --- T-7 window: 5.5 <= delta <= 8.5 ---
  it("returns nurture_t7 at delta 7 (exact center)", () => {
    expect(getEmailTypeForDelta(7)).toBe("nurture_t7");
  });

  it("returns nurture_t7 at delta 5.5 (lower bound)", () => {
    expect(getEmailTypeForDelta(5.5)).toBe("nurture_t7");
  });

  it("returns nurture_t7 at delta 8.5 (upper bound)", () => {
    expect(getEmailTypeForDelta(8.5)).toBe("nurture_t7");
  });

  it("returns null at delta 5.4 (below T-7 window)", () => {
    expect(getEmailTypeForDelta(5.4)).toBeNull();
  });

  // --- T-48h window: 1.0 <= delta <= 3.0 ---
  it("returns nurture_t48h at delta 2 (exact center)", () => {
    expect(getEmailTypeForDelta(2)).toBe("nurture_t48h");
  });

  it("returns nurture_t48h at delta 1.0 (lower bound)", () => {
    expect(getEmailTypeForDelta(1.0)).toBe("nurture_t48h");
  });

  it("returns nurture_t48h at delta 3.0 (upper bound)", () => {
    expect(getEmailTypeForDelta(3.0)).toBe("nurture_t48h");
  });

  it("returns null at delta 0.9 (below T-48h window)", () => {
    expect(getEmailTypeForDelta(0.9)).toBeNull();
  });

  // --- Gap zones ---
  it("returns null in gap between T-14 and T-7 (delta 10)", () => {
    expect(getEmailTypeForDelta(10)).toBeNull();
  });

  it("returns null in gap between T-7 and T-48h (delta 4)", () => {
    expect(getEmailTypeForDelta(4)).toBeNull();
  });

  // --- Edge cases ---
  it("returns null for negative delta (past launch)", () => {
    expect(getEmailTypeForDelta(-1)).toBeNull();
  });

  it("returns null for delta 0 (launch day)", () => {
    expect(getEmailTypeForDelta(0)).toBeNull();
  });

  it("returns null for very large delta (30 days)", () => {
    expect(getEmailTypeForDelta(30)).toBeNull();
  });

  // --- No overlap: windows are non-overlapping ---
  it("windows do not overlap: each delta maps to at most 1 type", () => {
    for (let d = 0; d <= 20; d += 0.5) {
      const result = getEmailTypeForDelta(d);
      // At most one match
      const matches = [
        d >= 12.5 && d <= 15.5 ? "nurture_t14" : null,
        d >= 5.5 && d <= 8.5 ? "nurture_t7" : null,
        d >= 1.0 && d <= 3.0 ? "nurture_t48h" : null,
      ].filter(Boolean);
      expect(matches.length).toBeLessThanOrEqual(1);
      if (matches.length === 1) {
        expect(result).toBe(matches[0]);
      }
    }
  });
});
