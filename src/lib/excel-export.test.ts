/**
 * Test unitari per excel-export.ts
 *
 * Copertura:
 * - exportCommercialista: workbook creation, sheet names, riepilogo content,
 *   dettaglio headers/rows/totals, empty receipts, formatDateIT edge cases
 *
 * Strategy: mock ExcelJS to capture worksheet data
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeMoney,
  calculateTaxableAmount,
  calculateTax,
  calculateInps,
  subtractMoney,
  sumMoney,
  roundMoney,
} from "@/lib/money";
import { makeSettings, makeMetrics, makeReceipt, makeParams } from "./excel-export.fixtures";

// === ExcelJS MOCK ===

interface MockRow {
  values: (string | number | null)[];
}

interface MockWorksheet {
  name: string;
  rows: MockRow[];
  columns: Map<number, { width?: number }>;
  addRow: (values: (string | number | null)[]) => void;
  getColumn: (index: number) => { width?: number };
}

const mockWorksheets: Record<string, MockWorksheet> = {};
let mockSaveAsName = "";
const mockWriteBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(0)));

vi.mock("exceljs", () => {
  class MockWorkbook {
    worksheets: MockWorksheet[] = [];
    xlsx = { writeBuffer: mockWriteBuffer };
    addWorksheet(name: string): MockWorksheet {
      const ws: MockWorksheet = {
        name,
        rows: [],
        columns: new Map(),
        addRow(values: (string | number | null)[]) {
          this.rows.push({ values: [...values] });
        },
        getColumn(index: number) {
          if (!this.columns.has(index)) this.columns.set(index, {});
          return this.columns.get(index)!;
        },
      };
      this.worksheets.push(ws);
      mockWorksheets[name] = ws;
      return ws;
    }
  }
  return { default: { Workbook: MockWorkbook } };
});

vi.mock("file-saver", () => ({
  saveAs: vi.fn((_blob: Blob, name: string) => {
    mockSaveAsName = name;
  }),
}));

// Helper: get row data as simple arrays
function getSheetData(name: string): (string | number | null)[][] {
  return mockWorksheets[name]?.rows.map((r) => r.values) ?? [];
}

// === TESTS ===

describe("exportCommercialista", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockWorksheets)) {
      delete mockWorksheets[key];
    }
    mockSaveAsName = "";
    mockWriteBuffer.mockClear();
  });

  // --- P0: Workbook structure ---

  it("[P0] creates workbook with 2 sheets: 'Riepilogo Fiscale' and 'Dettaglio Incassi'", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(makeParams());

    expect(Object.keys(mockWorksheets)).toHaveLength(2);
    expect(mockWorksheets["Riepilogo Fiscale"]).toBeDefined();
    expect(mockWorksheets["Dettaglio Incassi"]).toBeDefined();
  });

  it("[P0] saves file with correct filename", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(makeParams({ fiscalYear: 2024 }));

    expect(mockSaveAsName).toBe("Forfettino_2024_Export.xlsx");
  });

  // --- P0: Riepilogo sheet content ---

  it("[P0] Riepilogo sheet contains fiscal year title and key rows", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(makeParams({ fiscalYear: 2024, userName: "Master Luca" }));

    const data = getSheetData("Riepilogo Fiscale");
    const flatLabels = data.map((row) => (row && row[0]) || "");

    expect(flatLabels[0]).toBe("RIEPILOGO FISCALE 2024");

    expect(flatLabels).toContain("DATI CONTRIBUENTE");
    expect(flatLabels).toContain("INCASSI");
    expect(flatLabels).toContain("IMPOSTE E CONTRIBUTI");
    expect(flatLabels).toContain("SPENDIBILE OGGI");

    const nomeRow = data.find((r) => r && r[0] === "Nome");
    expect(nomeRow).toBeDefined();
    expect(nomeRow![1]).toBe("Master Luca");

    const incassiRow = data.find((r) => r && r[0] === "Totale Incassi Lordi");
    expect(incassiRow).toBeDefined();
    expect(incassiRow![1]).toBe(roundMoney(sanitizeMoney(50000)));
  });

  // --- P1: Dettaglio sheet headers ---

  it("[P1] Dettaglio sheet has correct header columns", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(makeParams());

    const data = getSheetData("Dettaglio Incassi");
    const header = data[0];

    expect(header).toEqual([
      "Data",
      "Cliente",
      "Importo Lordo",
      "Imponibile",
      "Imposta",
      "INPS",
      "Netto dopo tasse e INPS",
      "Note",
    ]);
  });

  // --- P1: Per-receipt breakdown ---

  it("[P1] Dettaglio sheet calculates per-receipt breakdown correctly using money.ts functions", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");

    const settings = makeSettings();
    const receipt = makeReceipt({ gross_amount: 10000, receipt_date: "2024-06-01", client_name: "Test Client" });

    await exportCommercialista(
      makeParams({
        receipts: [receipt],
        metrics: makeMetrics({ settings }),
      })
    );

    const data = getSheetData("Dettaglio Incassi");
    const row = data[1];

    const gross = sanitizeMoney(10000);
    const taxable = calculateTaxableAmount(gross, settings.profitCoeff);
    const tax = calculateTax(taxable, settings.taxRate);
    const inps = calculateInps(taxable, settings.inpsRate);
    const net = subtractMoney(gross, sumMoney(tax, inps));

    expect(row[0]).toBe("01/06/2024");
    expect(row[1]).toBe("Test Client");
    expect(row[2]).toBe(roundMoney(sanitizeMoney(gross)));
    expect(row[3]).toBe(roundMoney(sanitizeMoney(taxable)));
    expect(row[4]).toBe(roundMoney(sanitizeMoney(tax)));
    expect(row[5]).toBe(roundMoney(sanitizeMoney(inps)));
    expect(row[6]).toBe(roundMoney(sanitizeMoney(net)));
    expect(row[7]).toBe("");
  });

  // --- P1: Totals row ---

  it("[P1] Totals row sums correctly for multiple receipts", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");

    const settings = makeSettings();
    const receipts = [
      makeReceipt({ gross_amount: 5000 }),
      makeReceipt({ gross_amount: 3000, receipt_date: "2024-07-20", client_name: "Beta Srl" }),
    ];

    await exportCommercialista(makeParams({ receipts, metrics: makeMetrics({ settings }) }));

    const data = getSheetData("Dettaglio Incassi");

    // header + 2 data rows + 1 empty separator + 1 totals row = 5 rows
    expect(data).toHaveLength(5);

    const totalsRow = data[4];
    expect(totalsRow[0]).toBe("TOTALE");

    const computeRow = (grossAmt: number) => {
      const g = sanitizeMoney(grossAmt);
      const t = calculateTaxableAmount(g, settings.profitCoeff);
      const tx = calculateTax(t, settings.taxRate);
      const ip = calculateInps(t, settings.inpsRate);
      const n = subtractMoney(g, sumMoney(tx, ip));
      return [
        roundMoney(sanitizeMoney(g)),
        roundMoney(sanitizeMoney(t)),
        roundMoney(sanitizeMoney(tx)),
        roundMoney(sanitizeMoney(ip)),
        roundMoney(sanitizeMoney(n)),
      ];
    };

    const r1 = computeRow(5000);
    const r2 = computeRow(3000);

    const m = (v: number) => roundMoney(sanitizeMoney(v));

    expect(totalsRow[2]).toBe(m(r1[0] + r2[0]));
    expect(totalsRow[3]).toBe(m(r1[1] + r2[1]));
    expect(totalsRow[4]).toBe(m(r1[2] + r2[2]));
    expect(totalsRow[5]).toBe(m(r1[3] + r2[3]));
    expect(totalsRow[6]).toBe(m(r1[4] + r2[4]));
  });

  // --- P2: Empty receipts ---

  it("[P2] empty receipts array still has headers but no data rows and no totals", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(makeParams({ receipts: [] }));

    const data = getSheetData("Dettaglio Incassi");

    expect(data).toHaveLength(1);
    expect(data[0][0]).toBe("Data");
  });

  // --- P2: formatDateIT edge cases ---

  it("[P2] formatDateIT handles empty string receipt_date gracefully", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(
      makeParams({
        receipts: [makeReceipt({ receipt_date: "" })],
      })
    );

    const data = getSheetData("Dettaglio Incassi");
    const row = data[1];
    expect(row[0]).toBe("");
  });

  it("[P2] formatDateIT handles malformed date string by returning it as-is", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(
      makeParams({
        receipts: [makeReceipt({ receipt_date: "not-a-date" })],
      })
    );

    const data = getSheetData("Dettaglio Incassi");
    const row = data[1];
    expect(row[0]).toBe("date/a/not");
  });

  it("[P2] formatDateIT handles date with wrong number of parts by returning original string", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(
      makeParams({
        receipts: [makeReceipt({ receipt_date: "2024-03" })],
      })
    );

    const data = getSheetData("Dettaglio Incassi");
    const row = data[1];
    expect(row[0]).toBe("2024-03");
  });

  // --- P2: userName fallback ---

  it("[P2] Riepilogo shows '(non specificato)' when userName is undefined", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(makeParams({ userName: undefined }));

    const data = getSheetData("Riepilogo Fiscale");
    const nomeRow = data.find((r) => r && r[0] === "Nome");
    expect(nomeRow).toBeDefined();
    expect(nomeRow![1]).toBe("(non specificato)");
  });

  // --- P1: Dettaglio handles null client_name and notes ---

  it("[P1] Dettaglio renders empty strings for null client_name and notes", async () => {
    const { exportCommercialista } = await import("@/lib/excel-export");
    await exportCommercialista(
      makeParams({
        receipts: [makeReceipt({ client_name: null, notes: null })],
      })
    );

    const data = getSheetData("Dettaglio Incassi");
    const row = data[1];
    expect(row[1]).toBe("");
    expect(row[7]).toBe("");
  });
});
