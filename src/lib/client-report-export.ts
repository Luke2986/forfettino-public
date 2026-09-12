import type { ClientRevenue } from "@/lib/client-analytics";
import { csvSafe, downloadCsvItalian, formatNumberIT } from "@/lib/csv-export";
import { formatDateIT } from "@/lib/schedule-helpers";

const CSV_HEADER =
  "Cliente;Fatturato lordo;Netto spendibile;N. incassi;% totale;Primo incasso;Ultimo incasso";

export function exportClientReport(
  data: ClientRevenue[],
  period: number | null,
): void {
  if (!data.length) return;

  const rows = data.map((c) =>
    [
      csvSafe(c.clientName),
      formatNumberIT(c.totalGross, 2),
      formatNumberIT(c.totalNet, 2),
      String(c.receiptCount),
      formatNumberIT(c.percentage, 1),
      formatDateIT(c.firstReceiptDate),
      formatDateIT(c.lastReceiptDate),
    ].join(";"),
  );

  const filename = `report-clienti-${period ?? "totale"}.csv`;
  downloadCsvItalian(CSV_HEADER, rows, filename);
}
