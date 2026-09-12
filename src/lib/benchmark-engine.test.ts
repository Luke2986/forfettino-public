import { describe, it, expect } from "vitest";
import {
  ralToFreelanceRate,
  computeBenchmark,
  lookupBenchmark,
  getJobTitleCategory,
  formatJobTitle,
  getGroupedJobTitles,
  getAvailableJobTitles,
  getAvailableProvinces,
  DEFAULT_CONFIG,
  EXPERIENCE_BANDS,
  JOB_TITLE_CATEGORIES,
  MIN_SAMPLE_WARNING,
  type AggregatedBenchmarkData,
  type FreelanceRateConfig,
} from "./benchmark-engine";

// ── Fixtures ──

const MOCK_DATA: AggregatedBenchmarkData = {
  meta: {
    totalRecords: 100,
    validRecords: 90,
    generatedAt: "2026-03-18",
    jobTitles: ["backend_developer", "frontend_developer", "data_analyst"],
    provinces: ["Milano", "Roma"],
    source: "Test",
  },
  data: {
    backend_developer: {
      _all: {
        _all: { median: 38000, p25: 30000, p75: 48000, count: 100 },
        junior: { median: 26000, p25: 24000, p75: 30000, count: 30 },
        mid: { median: 35000, p25: 30000, p75: 40000, count: 40 },
        senior: { median: 50000, p25: 45000, p75: 55000, count: 30 },
      },
      Milano: {
        _all: { median: 42000, p25: 35000, p75: 52000, count: 50 },
        junior: { median: 28000, p25: 25000, p75: 32000, count: 15 },
        mid: { median: 38000, p25: 33000, p75: 43000, count: 20 },
        senior: { median: 52000, p25: 48000, p75: 58000, count: 15 },
      },
      Roma: {
        _all: { median: 36000, p25: 28000, p75: 44000, count: 20 },
      },
    },
    frontend_developer: {
      _all: {
        _all: { median: 34000, p25: 28000, p75: 42000, count: 50 },
      },
    },
    data_analyst: {
      _all: {
        _all: { median: 30000, p25: 25000, p75: 35000, count: 8 },
      },
    },
  },
};

// ── ralToFreelanceRate ──

describe("ralToFreelanceRate", () => {
  it("converts RAL with default config (1.35x, 1300h)", () => {
    const rate = ralToFreelanceRate(40000);
    // 40000 * 1.35 / 1300 = 41.538...
    expect(rate.hourly).toBeCloseTo(41.54, 1);
    // daily = hourly * 8
    expect(rate.daily).toBeCloseTo(41.54 * 8, 0);
  });

  it("converts RAL with custom config", () => {
    const config: FreelanceRateConfig = { multiplier: 1.5, billableHoursPerYear: 1200 };
    const rate = ralToFreelanceRate(36000, config);
    // 36000 * 1.5 / 1200 = 45
    expect(rate.hourly).toBe(45);
    expect(rate.daily).toBe(360);
  });

  it("handles zero RAL", () => {
    const rate = ralToFreelanceRate(0);
    expect(rate.hourly).toBe(0);
    expect(rate.daily).toBe(0);
  });

  it("handles zero billableHoursPerYear (guard against NaN/Infinity)", () => {
    const rate = ralToFreelanceRate(40000, { multiplier: 1.35, billableHoursPerYear: 0 });
    expect(rate.hourly).toBe(0);
    expect(rate.daily).toBe(0);
  });

  it("handles negative billableHoursPerYear", () => {
    const rate = ralToFreelanceRate(40000, { multiplier: 1.35, billableHoursPerYear: -100 });
    expect(rate.hourly).toBe(0);
    expect(rate.daily).toBe(0);
  });

  it("produces daily = hourly * 8", () => {
    const rate = ralToFreelanceRate(52000);
    expect(rate.daily).toBeCloseTo(rate.hourly * 8, 1);
  });
});

// ── lookupBenchmark ──

describe("lookupBenchmark", () => {
  it("returns exact match for jobTitle + province + band", () => {
    const result = lookupBenchmark(MOCK_DATA, {
      jobTitle: "backend_developer",
      province: "Milano",
      experienceBand: "junior",
    });
    expect(result).not.toBeNull();
    expect(result!.stats.median).toBe(28000);
    expect(result!.fallbackUsed).toBe(false);
  });

  it("returns _all province when no province filter", () => {
    const result = lookupBenchmark(MOCK_DATA, {
      jobTitle: "backend_developer",
      experienceBand: "mid",
    });
    expect(result!.stats.median).toBe(35000);
    expect(result!.fallbackUsed).toBe(false);
  });

  it("returns _all band when no experience filter", () => {
    const result = lookupBenchmark(MOCK_DATA, {
      jobTitle: "backend_developer",
      province: "Milano",
    });
    expect(result!.stats.median).toBe(42000);
    expect(result!.fallbackUsed).toBe(false);
  });

  it("returns _all/_all when no filters", () => {
    const result = lookupBenchmark(MOCK_DATA, { jobTitle: "backend_developer" });
    expect(result!.stats.median).toBe(38000);
    expect(result!.fallbackUsed).toBe(false);
  });

  it("falls back from province+band to province+_all", () => {
    // Roma has _all but no "junior" band
    const result = lookupBenchmark(MOCK_DATA, {
      jobTitle: "backend_developer",
      province: "Roma",
      experienceBand: "junior",
    });
    expect(result).not.toBeNull();
    expect(result!.stats.median).toBe(36000); // Roma _all
    expect(result!.fallbackUsed).toBe(true);
    expect(result!.fallbackReason).toContain("Pochi dati");
  });

  it("falls back from missing province to _all + band", () => {
    // "Torino" doesn't exist in mock data
    const result = lookupBenchmark(MOCK_DATA, {
      jobTitle: "backend_developer",
      province: "Torino",
      experienceBand: "senior",
    });
    expect(result).not.toBeNull();
    expect(result!.stats.median).toBe(50000); // _all + senior
    expect(result!.fallbackUsed).toBe(true);
    expect(result!.fallbackReason).toContain("dati nazionali");
  });

  it("falls back to _all/_all for completely missing combo", () => {
    const result = lookupBenchmark(MOCK_DATA, {
      jobTitle: "frontend_developer",
      province: "Milano",
      experienceBand: "senior",
    });
    expect(result).not.toBeNull();
    expect(result!.stats.median).toBe(34000); // _all/_all
    expect(result!.fallbackUsed).toBe(true);
  });

  it("returns null for non-existent jobTitle", () => {
    const result = lookupBenchmark(MOCK_DATA, { jobTitle: "nonexistent_role" });
    expect(result).toBeNull();
  });
});

// ── computeBenchmark ──

describe("computeBenchmark", () => {
  it("returns full benchmark result with freelance rates", () => {
    const result = computeBenchmark(MOCK_DATA, { jobTitle: "backend_developer" });
    expect(result).not.toBeNull();
    expect(result!.stats.median).toBe(38000);
    // median freelance rate: 38000 * 1.35 / 1300 = 39.46/h
    expect(result!.median.hourly).toBeCloseTo(39.46, 0);
    expect(result!.median.daily).toBeCloseTo(39.46 * 8, 0);
    // p25 rate
    expect(result!.p25.hourly).toBeCloseTo((30000 * 1.35) / 1300, 0);
    // p75 rate
    expect(result!.p75.hourly).toBeCloseTo((48000 * 1.35) / 1300, 0);
    expect(result!.config).toEqual(DEFAULT_CONFIG);
    expect(result!.fallbackUsed).toBe(false);
  });

  it("uses custom config for conversion", () => {
    const config: FreelanceRateConfig = { multiplier: 1.5, billableHoursPerYear: 1200 };
    const result = computeBenchmark(MOCK_DATA, { jobTitle: "backend_developer" }, config);
    expect(result!.median.hourly).toBeCloseTo((38000 * 1.5) / 1200, 0);
    expect(result!.config).toEqual(config);
  });

  it("returns null for non-existent job", () => {
    const result = computeBenchmark(MOCK_DATA, { jobTitle: "unknown" });
    expect(result).toBeNull();
  });

  it("preserves filters in result", () => {
    const filters = { jobTitle: "backend_developer", province: "Milano", experienceBand: "senior" as const };
    const result = computeBenchmark(MOCK_DATA, filters);
    expect(result!.filters).toEqual(filters);
  });

  it("includes fallback info", () => {
    const result = computeBenchmark(MOCK_DATA, {
      jobTitle: "backend_developer",
      province: "Torino",
      experienceBand: "junior",
    });
    expect(result!.fallbackUsed).toBe(true);
    expect(result!.fallbackReason).toBeTruthy();
  });
});

// ── getJobTitleCategory ──

describe("getJobTitleCategory", () => {
  it("returns correct category for known title", () => {
    expect(getJobTitleCategory("backend_developer")).toBe("Development");
    expect(getJobTitleCategory("data_scientist")).toBe("Data & AI");
    expect(getJobTitleCategory("product_manager")).toBe("Management");
    expect(getJobTitleCategory("devops_engineer")).toBe("DevOps & Cloud");
  });

  it("returns 'Altro' for unknown title", () => {
    expect(getJobTitleCategory("unknown_role")).toBe("Altro");
    expect(getJobTitleCategory("logistics")).toBe("Altro");
  });
});

// ── formatJobTitle ──

describe("formatJobTitle", () => {
  it("converts snake_case to Title Case", () => {
    expect(formatJobTitle("backend_developer")).toBe("Backend Developer");
    expect(formatJobTitle("fullstack_developer")).toBe("Fullstack Developer");
  });

  it("handles special abbreviations", () => {
    expect(formatJobTitle("ai_engineer")).toBe("AI Engineer");
    expect(formatJobTitle("it_consultant")).toBe("IT Consultant");
    expect(formatJobTitle("cto")).toBe("CTO");
    expect(formatJobTitle("ui/ux_designer")).toBe("UI/UX Designer");
    expect(formatJobTitle("devops_engineer")).toBe("Devops Engineer"); // DevOps not in replace list, ok
    expect(formatJobTitle("rpa_developer")).toBe("RPA Developer");
    expect(formatJobTitle("genai_engineer")).toBe("GenAI Engineer");
  });
});

// ── getGroupedJobTitles ──

describe("getGroupedJobTitles", () => {
  it("returns groups with items", () => {
    const groups = getGroupedJobTitles(MOCK_DATA);
    expect(groups.length).toBeGreaterThan(0);

    // Each group has category and items
    for (const g of groups) {
      expect(g.category).toBeTruthy();
      expect(g.items.length).toBeGreaterThan(0);
      for (const item of g.items) {
        expect(item.value).toBeTruthy();
        expect(item.label).toBeTruthy();
      }
    }
  });

  it("items contain value/label pairs", () => {
    const groups = getGroupedJobTitles(MOCK_DATA);
    const allItems = groups.flatMap((g) => g.items);
    const bdItem = allItems.find((i) => i.value === "backend_developer");
    expect(bdItem).toBeDefined();
    expect(bdItem!.label).toBe("Backend Developer");
  });
});

// ── Data accessors ──

describe("data accessors", () => {
  it("getAvailableJobTitles returns sorted list from meta", () => {
    const titles = getAvailableJobTitles(MOCK_DATA);
    expect(titles).toEqual(["backend_developer", "frontend_developer", "data_analyst"]);
  });

  it("getAvailableProvinces returns sorted list from meta", () => {
    const provinces = getAvailableProvinces(MOCK_DATA);
    expect(provinces).toEqual(["Milano", "Roma"]);
  });
});

// ── Constants ──

describe("constants", () => {
  it("DEFAULT_CONFIG has expected values", () => {
    expect(DEFAULT_CONFIG.multiplier).toBe(1.35);
    expect(DEFAULT_CONFIG.billableHoursPerYear).toBe(1300);
  });

  it("EXPERIENCE_BANDS covers full range", () => {
    expect(EXPERIENCE_BANDS.junior.minMonths).toBe(0);
    expect(EXPERIENCE_BANDS.junior.maxMonths).toBe(24);
    expect(EXPERIENCE_BANDS.mid.minMonths).toBe(25);
    expect(EXPERIENCE_BANDS.mid.maxMonths).toBe(72);
    expect(EXPERIENCE_BANDS.senior.minMonths).toBe(73);
    expect(EXPERIENCE_BANDS.senior.maxMonths).toBe(Infinity);
  });

  it("JOB_TITLE_CATEGORIES has major categories", () => {
    const cats = Object.keys(JOB_TITLE_CATEGORIES);
    expect(cats).toContain("Development");
    expect(cats).toContain("Data & AI");
    expect(cats).toContain("Management");
    expect(cats).toContain("DevOps & Cloud");
  });

  it("MIN_SAMPLE_WARNING is 10", () => {
    expect(MIN_SAMPLE_WARNING).toBe(10);
  });
});

// ── Edge cases ──

describe("edge cases", () => {
  it("low sample count data still computes", () => {
    const result = computeBenchmark(MOCK_DATA, { jobTitle: "data_analyst" });
    expect(result).not.toBeNull();
    expect(result!.stats.count).toBe(8);
    expect(result!.stats.count).toBeLessThan(MIN_SAMPLE_WARNING);
  });
});
