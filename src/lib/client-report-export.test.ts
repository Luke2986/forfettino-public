import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ClientRevenue } from "@/lib/client-analytics";

const mockDownloadCsvItalian = vi.fn();

vi.mock("@/lib/csv-export", () => ({
  csvSafe: (v: string) => {
    const escaped = v.replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(escaped)) return `"'${escaped}"`;
    return `"${escaped}"`;
  },
  downloadCsvItalian: (...args: any[]) => mockDownloadCsvItalian(...args),
  formatNumberIT: (n: number, d: number = 2) =>
    n.toLocaleString("it-IT", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }),
}));

vi.mock("@/lib/schedule-helpers", () => ({
  formatDateIT: (dateStr: string) => {
    const safe = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(safe);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  },
}));

const SAMPLE_DATA: ClientRevenue[] = [
  {
    clientId: "c1",
    clientName: "Acme Srl",
    totalGross: 10000,
    totalNet: 7800,
    receiptCount: 5,
    firstReceiptDate: "2026-01-15",
    lastReceiptDate: "2026-06-20",
    percentage: 62.5,
  },
  {
    clientId: "c2",
    clientName: "Beta SpA",
    totalGross: 6000,
    totalNet: 4680,
    receiptCount: 3,
    firstReceiptDate: "2026-03-01",
    lastReceiptDate: "2026-05-10",
    percentage: 37.5,
  },
];

describe("exportClientReport", () => {
  let exportClientReport: (data: ClientRevenue[], period: number | null) => void;

  beforeEach(async () => {
    mockDownloadCsvItalian.mockClear();
    const mod = await import("./client-report-export");
    exportClientReport = mod.exportClientReport;
  });

  it("calls downloadCsvItalian with correct header", () => {
    exportClientReport(SAMPLE_DATA, 2026);

    expect(mockDownloadCsvItalian).toHaveBeenCalledTimes(1);
    const [header] = mockDownloadCsvItalian.mock.calls[0];
    expect(header).toBe(
      "Cliente;Fatturato lordo;Netto spendibile;N. incassi;% totale;Primo incasso;Ultimo incasso",
    );
  });

  it("generates correct number of rows", () => {
    exportClientReport(SAMPLE_DATA, 2026);

    const [, rows] = mockDownloadCsvItalian.mock.calls[0];
    expect(rows).toHaveLength(2);
  });

  it("rows use semicolon separator", () => {
    exportClientReport(SAMPLE_DATA, 2026);

    const [, rows] = mockDownloadCsvItalian.mock.calls[0];
    // Each row should have 6 semicolons (7 fields)
    for (const row of rows) {
      const semicolonCount = (row.match(/;/g) || []).length;
      expect(semicolonCount).toBe(6);
    }
  });

  it("wraps client name with csvSafe", () => {
    exportClientReport(SAMPLE_DATA, 2026);

    const [, rows] = mockDownloadCsvItalian.mock.calls[0];
    expect(rows[0]).toMatch(/^"Acme Srl";/);
  });

  it("uses year-based filename", () => {
    exportClientReport(SAMPLE_DATA, 2026);

    const [, , filename] = mockDownloadCsvItalian.mock.calls[0];
    expect(filename).toBe("report-clienti-2026.csv");
  });

  it("uses 'totale' filename when period is null", () => {
    exportClientReport(SAMPLE_DATA, null);

    const [, , filename] = mockDownloadCsvItalian.mock.calls[0];
    expect(filename).toBe("report-clienti-totale.csv");
  });

  it("includes formatted dates in rows", () => {
    exportClientReport(SAMPLE_DATA, 2026);

    const [, rows] = mockDownloadCsvItalian.mock.calls[0];
    // First row should contain formatted dates for Acme Srl
    expect(rows[0]).toContain("15/01/2026");
    expect(rows[0]).toContain("20/06/2026");
  });

  it("does not call download when data is empty", () => {
    exportClientReport([], 2026);

    expect(mockDownloadCsvItalian).not.toHaveBeenCalled();
  });
});
