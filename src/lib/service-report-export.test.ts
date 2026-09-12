/**
 * Story 55.3 — Test exportServiceReport
 * Header CSV, filename con anno.
 */
import { describe, it, expect, vi } from "vitest";

const mockDownloadCsvItalian = vi.fn();
vi.mock("@/lib/csv-export", () => ({
  csvSafe: (s: string) => `"${s}"`,
  downloadCsvItalian: (...args: any[]) => mockDownloadCsvItalian(...args),
  formatNumberIT: (n: number, d: number) => n.toFixed(d).replace(".", ","),
}));

vi.mock("@/lib/schedule-helpers", () => ({
  formatDateIT: (d: string) => d,
}));

import { exportServiceReport } from "./service-report-export";
import type { ServiceRevenue } from "@/hooks/useServiceRevenueReport";

const mockData: ServiceRevenue[] = [
  {
    serviceId: "s1",
    serviceName: "Consulenza",
    serviceColor: "#14b8a6",
    totalGross: 5000,
    totalNet: 4000,
    receiptCount: 5,
    firstReceiptDate: "2026-01-01",
    lastReceiptDate: "2026-03-01",
    percentage: 50,
  },
  {
    serviceId: null,
    serviceName: "Non categorizzato",
    serviceColor: "#94a3b8",
    totalGross: 5000,
    totalNet: 4000,
    receiptCount: 5,
    firstReceiptDate: "2026-02-01",
    lastReceiptDate: "2026-03-01",
    percentage: 50,
  },
];

describe("exportServiceReport", () => {
  it("genera CSV con header corretto", () => {
    exportServiceReport(mockData, 2026);
    expect(mockDownloadCsvItalian).toHaveBeenCalledTimes(1);
    const [header] = mockDownloadCsvItalian.mock.calls[0];
    expect(header).toBe("Servizio;Fatturato lordo;Netto spendibile;N. incassi;% totale;Primo incasso;Ultimo incasso");
  });

  it("genera filename con anno specifico", () => {
    exportServiceReport(mockData, 2026);
    const filename = mockDownloadCsvItalian.mock.calls[0][2];
    expect(filename).toBe("report-servizi-2026.csv");
  });

  it("genera filename 'totale' quando periodo è null", () => {
    mockDownloadCsvItalian.mockClear();
    exportServiceReport(mockData, null);
    const filename = mockDownloadCsvItalian.mock.calls[0][2];
    expect(filename).toBe("report-servizi-totale.csv");
  });

  it("genera il numero corretto di righe", () => {
    mockDownloadCsvItalian.mockClear();
    exportServiceReport(mockData, 2026);
    const rows = mockDownloadCsvItalian.mock.calls[0][1];
    expect(rows).toHaveLength(2);
  });

  it("non esporta se data è vuoto", () => {
    mockDownloadCsvItalian.mockClear();
    exportServiceReport([], 2026);
    expect(mockDownloadCsvItalian).not.toHaveBeenCalled();
  });

  it("include nome servizio nella prima colonna", () => {
    mockDownloadCsvItalian.mockClear();
    exportServiceReport(mockData, 2026);
    const rows = mockDownloadCsvItalian.mock.calls[0][1] as string[];
    expect(rows[0]).toContain('"Consulenza"');
    expect(rows[1]).toContain('"Non categorizzato"');
  });
});
