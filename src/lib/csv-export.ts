/** Sanitize a string for CSV to prevent formula injection (=, +, -, @, \t, \r) */
export function csvSafe(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(escaped)) return `"'${escaped}"`;
  return `"${escaped}"`;
}

/** Generate a CSV string from header + rows and trigger browser download */
export function downloadCsv(
  header: string,
  rows: string[],
  filename: string,
): void {
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Format a number using Italian locale (dot thousands, comma decimal) */
export function formatNumberIT(n: number, decimals: number = 2): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Generate a CSV with UTF-8 BOM (Italian format) and trigger browser download */
export function downloadCsvItalian(
  header: string,
  rows: string[],
  filename: string,
): void {
  const BOM = "\uFEFF";
  const csv = BOM + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
