import type { ServiceRevenue } from "@/hooks/useServiceRevenueReport";
import { csvSafe, downloadCsvItalian, formatNumberIT } from "@/lib/csv-export";
import { formatDateIT } from "@/lib/schedule-helpers";

const CSV_HEADER =
  "Servizio;Fatturato lordo;Netto spendibile;N. incassi;% totale;Primo incasso;Ultimo incasso";

export function exportServiceReport(
  data: ServiceRevenue[],
  period: number | null,
): void {
  if (!data.length) return;

  const rows = data.map((s) =>
    [
      csvSafe(s.serviceName),
      formatNumberIT(s.totalGross, 2),
      formatNumberIT(s.totalNet, 2),
      String(s.receiptCount),
      formatNumberIT(s.percentage, 1),
      formatDateIT(s.firstReceiptDate),
      formatDateIT(s.lastReceiptDate),
    ].join(";"),
  );

  const filename = `report-servizi-${period ?? "totale"}.csv`;
  downloadCsvItalian(CSV_HEADER, rows, filename);
}
