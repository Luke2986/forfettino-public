import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateHHI,
  classifyConcentration,
  identifyDormantClients,
  type ClientRevenue,
  type ConcentrationLevel,
} from "../client-analytics";

// ---------- calculateHHI ----------

describe("calculateHHI", () => {
  it("returns 10000 for a single client (100%)", () => {
    const clients: ClientRevenue[] = [
      makeClient({ percentage: 100 }),
    ];
    expect(calculateHHI(clients)).toBe(10000);
  });

  it("returns 5000 for two equal clients (50/50)", () => {
    const clients: ClientRevenue[] = [
      makeClient({ percentage: 50 }),
      makeClient({ percentage: 50 }),
    ];
    expect(calculateHHI(clients)).toBe(5000);
  });

  it("returns 2000 for five equal clients (20% each)", () => {
    const clients: ClientRevenue[] = Array.from({ length: 5 }, () =>
      makeClient({ percentage: 20 }),
    );
    expect(calculateHHI(clients)).toBe(2000);
  });

  it("returns 1000 for ten equal clients (10% each)", () => {
    const clients: ClientRevenue[] = Array.from({ length: 10 }, () =>
      makeClient({ percentage: 10 }),
    );
    expect(calculateHHI(clients)).toBe(1000);
  });

  it("calculates correctly for a realistic distribution", () => {
    // 50% + 30% + 20% → 2500 + 900 + 400 = 3800
    const clients: ClientRevenue[] = [
      makeClient({ percentage: 50 }),
      makeClient({ percentage: 30 }),
      makeClient({ percentage: 20 }),
    ];
    expect(calculateHHI(clients)).toBe(3800);
  });

  it("returns 0 for empty array", () => {
    expect(calculateHHI([])).toBe(0);
  });
});

// ---------- classifyConcentration ----------

describe("classifyConcentration", () => {
  it("returns 'diversificato' for HHI < 1500", () => {
    expect(classifyConcentration(0)).toBe("diversificato");
    expect(classifyConcentration(1000)).toBe("diversificato");
    expect(classifyConcentration(1499)).toBe("diversificato");
  });

  it("returns 'moderato' for HHI 1500-2499", () => {
    expect(classifyConcentration(1500)).toBe("moderato");
    expect(classifyConcentration(2000)).toBe("moderato");
    expect(classifyConcentration(2499)).toBe("moderato");
  });

  it("returns 'concentrato' for HHI 2500-4499", () => {
    expect(classifyConcentration(2500)).toBe("concentrato");
    expect(classifyConcentration(3500)).toBe("concentrato");
    expect(classifyConcentration(4499)).toBe("concentrato");
  });

  it("returns 'molto_concentrato' for HHI >= 4500", () => {
    expect(classifyConcentration(4500)).toBe("molto_concentrato");
    expect(classifyConcentration(10000)).toBe("molto_concentrato");
  });
});

// ---------- identifyDormantClients ----------

describe("identifyDormantClients", () => {
  const NOW = new Date("2026-03-22T00:00:00");

  beforeEach(() => {
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("identifies a client dormant for 3+ months", () => {
    const clients: ClientRevenue[] = [
      makeClient({ clientName: "Old Corp", lastReceiptDate: "2025-12-01" }),
    ];
    const dormant = identifyDormantClients(clients, 3);
    expect(dormant).toHaveLength(1);
    expect(dormant[0].clientName).toBe("Old Corp");
  });

  it("does not flag a client with recent activity", () => {
    const clients: ClientRevenue[] = [
      makeClient({ clientName: "Active LLC", lastReceiptDate: "2026-02-15" }),
    ];
    const dormant = identifyDormantClients(clients, 3);
    expect(dormant).toHaveLength(0);
  });

  it("returns empty array when no clients are dormant", () => {
    const clients: ClientRevenue[] = [
      makeClient({ lastReceiptDate: "2026-03-01" }),
      makeClient({ lastReceiptDate: "2026-02-01" }),
    ];
    const dormant = identifyDormantClients(clients, 3);
    expect(dormant).toHaveLength(0);
  });

  it("returns all clients when all are dormant", () => {
    const clients: ClientRevenue[] = [
      makeClient({ lastReceiptDate: "2025-06-01" }),
      makeClient({ lastReceiptDate: "2025-09-01" }),
    ];
    const dormant = identifyDormantClients(clients, 3);
    expect(dormant).toHaveLength(2);
  });

  it("handles threshold of 0 months (all are dormant if not today)", () => {
    const clients: ClientRevenue[] = [
      makeClient({ lastReceiptDate: "2026-03-21" }),
    ];
    // 1 day ago, threshold 0 months → cutoff is today → dormant
    const dormant = identifyDormantClients(clients, 0);
    expect(dormant).toHaveLength(1);
  });

  it("handles 6 month threshold", () => {
    const clients: ClientRevenue[] = [
      makeClient({ lastReceiptDate: "2025-10-01" }), // ~5 months ago → NOT dormant
      makeClient({ lastReceiptDate: "2025-08-01" }), // ~7 months ago → dormant
    ];
    const dormant = identifyDormantClients(clients, 6);
    expect(dormant).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(identifyDormantClients([], 3)).toEqual([]);
  });
});

// ---------- Helper ----------

function makeClient(overrides: Partial<ClientRevenue> = {}): ClientRevenue {
  return {
    clientId: overrides.clientId ?? crypto.randomUUID(),
    clientName: overrides.clientName ?? "Test Client",
    totalGross: overrides.totalGross ?? 1000,
    totalNet: overrides.totalNet ?? 800,
    receiptCount: overrides.receiptCount ?? 5,
    firstReceiptDate: overrides.firstReceiptDate ?? "2026-01-15",
    lastReceiptDate: overrides.lastReceiptDate ?? "2026-03-15",
    percentage: overrides.percentage ?? 100,
  };
}
