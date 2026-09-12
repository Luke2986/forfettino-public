/**
 * src/lib/csv.ts — helper CSV condivisi per gli export "log/drill-down" admin.
 *
 * Estratti VERBATIM da AdminEmailLog (Story 44.3) per DRY (Story 84.9, AC#4):
 * consumer attuali = AdminEmailLog, AdminConsentedEmailList, AdminDeadlineEmailMetrics.
 *
 * ⚠️ Distinto da `src/lib/csv-export.ts` (`csvSafe`/`downloadCsvItalian`), che usa una
 * firma diversa `(header, rows[], filename)` + protezione formula-injection e serve i
 * report cliente/servizio/NPS. Qui la firma è `downloadCsv(filename, csv)` (stringa CSV
 * già composta) per restare compatibile con i consumer email senza cambiarne il comportamento.
 *
 * BOM `﻿` obbligatorio: senza, Excel non riconosce l'UTF-8 e gli accenti si rompono.
 */

/** Escape di un campo CSV: quota solo se contiene virgola/quote/newline (raddoppia le quote). */
export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Crea un Blob CSV (con BOM UTF-8 per Excel) e forza il download nel browser. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Compone una stringa CSV da header + righe applicando `escapeCsvField` a ogni cella.
 * Righe separate da `\n`, celle da `,`.
 */
export function buildCsv(header: string[], rows: string[][]): string {
  const headerLine = header.map(escapeCsvField).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...bodyLines].join("\n");
}
