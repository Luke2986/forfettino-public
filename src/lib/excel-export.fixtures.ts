/**
 * Factory functions per excel-export tests.
 * Pattern: override con spread per creare dati test con default sensati.
 */

import type { ExportParams } from "@/lib/excel-export";

export function makeSettings(
  overrides?: Partial<ExportParams["metrics"]["settings"]>
): ExportParams["metrics"]["settings"] {
  return {
    taxRate: 15,
    profitCoeff: 78,
    inpsRate: 26.07,
    safetyBuffer: 10,
    reserveAmount: 500,
    bufferBase: "incassi",
    ...overrides,
  };
}

export function makeFiscalPeak(
  overrides?: Partial<ExportParams["metrics"]["fiscalPeak"]>
): ExportParams["metrics"]["fiscalPeak"] {
  return {
    saldoTax: 500,
    saldoInps: 800,
    accontoTax1: 200,
    accontoTax2: 300,
    accontoTaxSingle: 0,
    accontoInps1: 400,
    accontoInps2: 400,
    juneTotal: 1900,
    novemberTotal: 700,
    yearTotal: 2600,
    paymentYear: 2025,
    ...overrides,
  };
}

export function makeMetrics(
  overrides?: Partial<ExportParams["metrics"]>
): ExportParams["metrics"] {
  return {
    incassiYTD: 50000,
    taxableAmount: 39000,
    taxAmount: 5850,
    inpsAmount: 10167.3,
    totalWithholding: 16017.3,
    yearlyToolCost: 120,
    bufferAmount: 5000,
    spendable: 28862.7,
    fiscalPeak: makeFiscalPeak(),
    settings: makeSettings(),
    ...overrides,
  };
}

export function makeReceipt(
  overrides?: Partial<{
    receipt_date: string;
    client_name: string | null;
    gross_amount: number;
    notes: string | null;
  }>
) {
  return {
    receipt_date: "2024-03-15",
    client_name: "Acme Srl",
    gross_amount: 5000,
    notes: null,
    ...overrides,
  };
}

export function makeParams(overrides?: Partial<ExportParams>): ExportParams {
  return {
    receipts: [makeReceipt()],
    metrics: makeMetrics(),
    fiscalYear: 2024,
    userName: "Master Luca",
    ...overrides,
  };
}
