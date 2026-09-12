/**
 * excel-export.ts - Generazione Excel per Commercialista
 *
 * Genera un file .xlsx con 2 fogli:
 * 1. "Riepilogo Fiscale" — panoramica anno con calcoli
 * 2. "Dettaglio Incassi" — elenco incassi con breakdown per riga
 *
 * Usa le funzioni di money.ts per coerenza con i calcoli dell'app.
 * Libreria: ExcelJS (sostituisce xlsx/SheetJS vulnerabile).
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  sanitizeMoney,
  calculateTaxableAmount,
  calculateTax,
  calculateInps,
  subtractMoney,
  sumMoney,
  roundMoney,
} from "@/lib/money";

// === TYPES ===

interface ExportReceipt {
  receipt_date: string;
  client_name: string | null;
  gross_amount: number;
  notes: string | null;
}

interface ExportSettings {
  taxRate: number;
  profitCoeff: number;
  inpsRate: number;
  safetyBuffer: number;
  reserveAmount: number;
  bufferBase: string;
}

interface ExportFiscalPeak {
  saldoTax: number;
  saldoInps: number;
  accontoTax1: number;
  accontoTax2: number;
  accontoTaxSingle: number;
  accontoInps1: number;
  accontoInps2: number;
  juneTotal: number;
  novemberTotal: number;
  yearTotal: number;
  paymentYear: number;
}

interface ExportMetrics {
  incassiYTD: number;
  taxableAmount: number;
  taxAmount: number;
  inpsAmount: number;
  totalWithholding: number;
  yearlyToolCost: number;
  bufferAmount: number;
  spendable: number;
  fiscalPeak: ExportFiscalPeak;
  settings: ExportSettings;
}

export interface ExportParams {
  receipts: ExportReceipt[];
  metrics: ExportMetrics;
  fiscalYear: number;
  userName?: string;
}

// === HELPERS ===

/** Formatta data YYYY-MM-DD → DD/MM/YYYY */
function formatDateIT(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Formatta importo come numero a 2 decimali (per celle Excel) */
function money(amount: number | null | undefined): number {
  return roundMoney(sanitizeMoney(amount));
}

/** Formatta percentuale come stringa leggibile */
function pct(rate: number): string {
  if (Number.isInteger(rate)) return `${rate}%`;
  return `${rate.toString().replace(".", ",")}%`;
}

// === FOGLIO 1: RIEPILOGO FISCALE ===

function buildRiepilogoSheet(wb: ExcelJS.Workbook, params: ExportParams): void {
  const { metrics, fiscalYear, userName } = params;
  const { settings, fiscalPeak } = metrics;
  const nextYear = fiscalPeak.paymentYear;
  const today = new Date().toLocaleDateString("it-IT");

  const ws = wb.addWorksheet("Riepilogo Fiscale");

  const rows: (string | number | null)[][] = [
    [`RIEPILOGO FISCALE ${fiscalYear}`, null],
    [`Data Export: ${today}`, null],
    [],
    ["DATI CONTRIBUENTE", null],
    ["Nome", userName || "(non specificato)"],
    [],
    ["INCASSI", null],
    ["Totale Incassi Lordi", money(metrics.incassiYTD)],
    ["Numero Fatture", params.receipts.length],
    [`Coefficiente di Redditività`, `${pct(settings.profitCoeff)}`],
    ["Reddito Imponibile", money(metrics.taxableAmount)],
    [],
    ["IMPOSTE E CONTRIBUTI", null],
    [`Imposta Sostitutiva (${pct(settings.taxRate)})`, money(metrics.taxAmount)],
    [`INPS Gest. Separata (${pct(settings.inpsRate)})`, money(metrics.inpsAmount)],
    ["Totale Ritenute", money(metrics.totalWithholding)],
    [],
    [`PREVISIONE USCITE ${nextYear}`, null],
    [`Rata Giugno ${nextYear}`, money(fiscalPeak.juneTotal)],
    [`  - Saldo Imposta ${fiscalYear}`, money(fiscalPeak.saldoTax)],
    [`  - Saldo INPS ${fiscalYear}`, money(fiscalPeak.saldoInps)],
    [`  - Acconto Imposta ${nextYear}`, money(fiscalPeak.accontoTax1 || fiscalPeak.accontoTaxSingle)],
    [`  - Acconto INPS ${nextYear}`, money(fiscalPeak.accontoInps1)],
    [`Rata Novembre ${nextYear}`, money(fiscalPeak.novemberTotal)],
    [`  - Acconto Imposta ${nextYear}`, money(fiscalPeak.accontoTax2)],
    [`  - Acconto INPS ${nextYear}`, money(fiscalPeak.accontoInps2)],
    ["Totale Uscite Anno", money(fiscalPeak.yearTotal)],
    [],
    ["SPENDIBILE OGGI", null],
    ["Incassi", money(metrics.incassiYTD)],
    ["- Imposte e Contributi", money(metrics.totalWithholding)],
    ["- Costi Strumenti (annuo)", money(metrics.yearlyToolCost)],
    [`- Buffer Sicurezza (${pct(settings.safetyBuffer)})`, money(metrics.bufferAmount)],
    ["- Riserva Personale", money(settings.reserveAmount)],
    ["= Spendibile oggi", money(metrics.spendable)],
  ];

  for (const row of rows) {
    ws.addRow(row);
  }

  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 18;
}

// === FOGLIO 2: DETTAGLIO INCASSI ===

function buildDettaglioSheet(wb: ExcelJS.Workbook, params: ExportParams): void {
  const { receipts, metrics } = params;
  const { settings } = metrics;

  const ws = wb.addWorksheet("Dettaglio Incassi");

  const header = [
    "Data",
    "Cliente",
    "Importo Lordo",
    "Imponibile",
    "Imposta",
    "INPS",
    "Netto dopo tasse e INPS",
    "Note",
  ];

  ws.addRow(header);

  const dataRows: { row: (string | number)[]; numericValues: number[] }[] = receipts.map((r) => {
    const gross = sanitizeMoney(r.gross_amount);
    const taxable = calculateTaxableAmount(gross, settings.profitCoeff);
    const tax = calculateTax(taxable, settings.taxRate);
    const inps = calculateInps(taxable, settings.inpsRate);
    const net = subtractMoney(gross, sumMoney(tax, inps));

    return {
      row: [
        formatDateIT(r.receipt_date),
        r.client_name || "",
        money(gross),
        money(taxable),
        money(tax),
        money(inps),
        money(net),
        r.notes || "",
      ],
      numericValues: [money(gross), money(taxable), money(tax), money(inps), money(net)],
    };
  });

  for (const d of dataRows) {
    ws.addRow(d.row);
  }

  if (dataRows.length > 0) {
    const totals = dataRows.reduce(
      (acc, item) => {
        acc[0] += item.numericValues[0];
        acc[1] += item.numericValues[1];
        acc[2] += item.numericValues[2];
        acc[3] += item.numericValues[3];
        acc[4] += item.numericValues[4];
        return acc;
      },
      [0, 0, 0, 0, 0]
    );

    ws.addRow([]); // separator
    ws.addRow([
      "TOTALE",
      "",
      money(totals[0]),
      money(totals[1]),
      money(totals[2]),
      money(totals[3]),
      money(totals[4]),
      "",
    ]);
  }

  const colWidths = [12, 25, 15, 15, 12, 12, 22, 30];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

// === EXPORT PRINCIPALE ===

export async function exportCommercialista(params: ExportParams): Promise<void> {
  const { fiscalYear } = params;

  const wb = new ExcelJS.Workbook();

  buildRiepilogoSheet(wb, params);
  buildDettaglioSheet(wb, params);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Forfettino_${fiscalYear}_Export.xlsx`);
}
