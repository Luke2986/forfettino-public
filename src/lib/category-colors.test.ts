import { describe, it, expect } from "vitest";
import { CATEGORY_COLORS, getNextColor } from "./category-colors";

describe("CATEGORY_COLORS", () => {
  it("should have exactly 10 colors", () => {
    expect(CATEGORY_COLORS).toHaveLength(10);
  });

  it("should all be valid hex colors", () => {
    for (const color of CATEGORY_COLORS) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("should have no duplicates", () => {
    const unique = new Set(CATEGORY_COLORS.map((c) => c.toLowerCase()));
    expect(unique.size).toBe(CATEGORY_COLORS.length);
  });
});

describe("getNextColor", () => {
  it("should return first color when no colors are used", () => {
    expect(getNextColor([])).toBe(CATEGORY_COLORS[0]);
  });

  it("should return second color when first is used", () => {
    expect(getNextColor([CATEGORY_COLORS[0]])).toBe(CATEGORY_COLORS[1]);
  });

  it("should skip used colors and return next available", () => {
    const used = CATEGORY_COLORS.slice(0, 5);
    expect(getNextColor(used)).toBe(CATEGORY_COLORS[5]);
  });

  it("should cycle when all 10 colors are used", () => {
    const allUsed = [...CATEGORY_COLORS];
    // 10 used → index 10 % 10 = 0
    expect(getNextColor(allUsed)).toBe(CATEGORY_COLORS[0]);
  });

  it("should cycle correctly with 12 used colors", () => {
    const used = [...CATEGORY_COLORS, CATEGORY_COLORS[0], CATEGORY_COLORS[1]];
    // 12 used → index 12 % 10 = 2
    expect(getNextColor(used)).toBe(CATEGORY_COLORS[2]);
  });

  it("should be case-insensitive when matching used colors", () => {
    expect(getNextColor(["#14B8A6"])).toBe(CATEGORY_COLORS[1]);
  });
});
