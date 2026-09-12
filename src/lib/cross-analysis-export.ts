/**
 * Story 55.4 — Export CSV per analisi incrociata (matrice cliente x servizio).
 */
import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";
import { csvSafe, downloadCsvItalian, formatNumberIT } from "@/lib/csv-export";

export function exportCrossAnalysis(
  data: CrossAnalysisData,
  period: number | null,
): void {
  const { clients, categories, matrix, totals } = data;
  if (clients.length === 0) return;

  // Header: Cliente; Cat1; Cat2; ...; Totale
  const header = [
    "Cliente",
    ...categories.map((c) => csvSafe(c.name)),
    "Totale",
  ].join(";");

  // Rows: one per client
  const rows = clients.map((client) => {
    const ck = client.id ?? "__null__";
    const clientRow = matrix.get(ck);
    const cells = categories.map((cat) => {
      const catk = cat.id ?? "__null__";
      const gross = clientRow?.get(catk)?.totalGross ?? 0;
      return formatNumberIT(gross, 2);
    });
    const clientTotal = totals.byClient.get(ck) ?? 0;
    return [csvSafe(client.name), ...cells, formatNumberIT(clientTotal, 2)].join(";");
  });

  // Footer: totals per category
  const footerCells = categories.map((cat) => {
    const catk = cat.id ?? "__null__";
    return formatNumberIT(totals.byCategory.get(catk) ?? 0, 2);
  });
  rows.push(["Totale", ...footerCells, formatNumberIT(totals.grand, 2)].join(";"));

  const filename = `analisi-incrociata-${period ?? "totale"}.csv`;
  downloadCsvItalian(header, rows, filename);
}
