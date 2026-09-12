import { describe, it, expect } from "vitest";
import { toAnnual, computeCoverageDots } from "./coverage-helpers";

describe("toAnnual", () => {
  it("returns monthly * 12", () => {
    expect(toAnnual(100, "monthly")).toBe(1200);
  });

  it("returns quarterly * 4", () => {
    expect(toAnnual(300, "quarterly")).toBe(1200);
  });

  it("returns yearly as-is", () => {
    expect(toAnnual(1200, "yearly")).toBe(1200);
  });

  it("treats unknown frequency as monthly", () => {
    expect(toAnnual(50, "unknown")).toBe(600);
  });
});

describe("computeCoverageDots", () => {
  const tools = [
    { id: "a", cost: 100, frequency: "monthly" },  // 1200/yr
    { id: "b", cost: 50, frequency: "monthly" },    // 600/yr
    { id: "c", cost: 200, frequency: "yearly" },    // 200/yr
  ];

  it("marks all as covered when budget is sufficient", () => {
    const dots = computeCoverageDots(tools, 2000); // total needed: 2000
    expect(dots.get("a")).toBe("covered");
    expect(dots.get("b")).toBe("covered");
    expect(dots.get("c")).toBe("covered");
  });

  it("marks all as uncovered when budget is 0", () => {
    const dots = computeCoverageDots(tools, 0);
    expect(dots.get("a")).toBe("uncovered");
    expect(dots.get("b")).toBe("uncovered");
    expect(dots.get("c")).toBe("uncovered");
  });

  it("waterfall: allocates largest first, partial for partly covered", () => {
    // sorted by annual desc: a(1200), b(600), c(200) — total 2000
    // budget = 1500 → a=covered(rem 300), b=partial(rem 0), c=uncovered
    const dots = computeCoverageDots(tools, 1500);
    expect(dots.get("a")).toBe("covered");
    expect(dots.get("b")).toBe("partial");
    expect(dots.get("c")).toBe("uncovered");
  });

  it("exact budget covers all exactly", () => {
    const dots = computeCoverageDots(tools, 2000);
    expect(dots.get("a")).toBe("covered");
    expect(dots.get("b")).toBe("covered");
    expect(dots.get("c")).toBe("covered");
  });

  it("budget covers only the largest tool exactly", () => {
    const dots = computeCoverageDots(tools, 1200);
    expect(dots.get("a")).toBe("covered");
    expect(dots.get("b")).toBe("uncovered");
    expect(dots.get("c")).toBe("uncovered");
  });

  it("handles empty tools list", () => {
    const dots = computeCoverageDots([], 1000);
    expect(dots.size).toBe(0);
  });

  it("handles single tool fully covered", () => {
    const single = [{ id: "x", cost: 10, frequency: "monthly" }]; // 120/yr
    const dots = computeCoverageDots(single, 120);
    expect(dots.get("x")).toBe("covered");
  });

  it("handles single tool partially covered", () => {
    const single = [{ id: "x", cost: 10, frequency: "monthly" }]; // 120/yr
    const dots = computeCoverageDots(single, 50);
    expect(dots.get("x")).toBe("partial");
  });

  it("handles quarterly frequency correctly in sorting", () => {
    const quarterly = [
      { id: "q", cost: 300, frequency: "quarterly" }, // 1200/yr
      { id: "m", cost: 50, frequency: "monthly" },    // 600/yr
    ];
    // sorted: q(1200), m(600) — budget 1200 covers q only
    const dots = computeCoverageDots(quarterly, 1200);
    expect(dots.get("q")).toBe("covered");
    expect(dots.get("m")).toBe("uncovered");
  });
});
