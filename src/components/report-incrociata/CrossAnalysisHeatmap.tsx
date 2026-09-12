/**
 * Story 55.4 — Heatmap table: matrice cliente x servizio.
 * HTML table pura (no shadcn Table) per colori celle custom.
 */

import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";
import { formatCurrency } from "@/lib/money";
import { capitalizeFirst } from "@/lib/string-utils";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]";

function getCellBg(cellGross: number, maxGross: number): string | undefined {
  if (cellGross === 0) return undefined;
  const intensity = maxGross > 0 ? cellGross / maxGross : 0;
  return `rgba(20, 184, 166, ${(intensity * 0.4).toFixed(2)})`;
}

interface Props {
  data: CrossAnalysisData;
}

export function CrossAnalysisHeatmap({ data }: Props) {
  const { clients, categories, matrix, totals } = data;

  // Find max cell value for intensity scaling
  let maxCellGross = 0;
  for (const clientRow of matrix.values()) {
    for (const cell of clientRow.values()) {
      if (cell.totalGross > maxCellGross) maxCellGross = cell.totalGross;
    }
  }

  const minWidth = `${categories.length * 140 + 160}px`;

  return (
    <div className={`bg-white rounded-2xl ${CARD_SHADOW} p-5`}>
      <div className="overflow-x-auto -mx-5 px-5">
        <table
          className="w-full text-sm"
          style={{ minWidth }}
        >
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left font-semibold text-slate-700 px-3 py-2 min-w-[120px]">
                Cliente
              </th>
              {categories.map((cat) => (
                <th key={cat.id ?? "__null__"} className="text-right font-semibold text-slate-700 px-3 py-2 min-w-[100px]">
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="break-words leading-tight" title={cat.name}>{cat.name}</span>
                  </div>
                  <div className="text-slate-500 font-normal text-sm">
                    {formatCurrency(cat.totalGross)}
                  </div>
                </th>
              ))}
              <th className="text-right font-semibold text-slate-700 px-3 py-2">
                Totale
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const ck = client.id ?? "__null__";
              const clientRow = matrix.get(ck);
              const clientTotal = totals.byClient.get(ck) ?? 0;

              return (
                <tr key={ck} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900 truncate max-w-[120px]">
                    {capitalizeFirst(client.name)}
                  </td>
                  {categories.map((cat) => {
                    const catk = cat.id ?? "__null__";
                    const cell = clientRow?.get(catk);
                    const gross = cell?.totalGross ?? 0;
                    const count = cell?.receiptCount ?? 0;
                    const bg = getCellBg(gross, maxCellGross);

                    return (
                      <td
                        key={catk}
                        className={`text-right px-3 py-2 ${gross === 0 ? "bg-slate-50 text-slate-500" : "text-slate-900"}`}
                        style={bg ? { backgroundColor: bg } : undefined}
                        title={
                          gross > 0
                            ? `${capitalizeFirst(client.name)} x ${cat.name}: ${formatCurrency(gross)} (${count} incass${count !== 1 ? "i" : "o"})`
                            : undefined
                        }
                      >
                        {gross > 0 ? formatCurrency(gross) : "—"}
                      </td>
                    );
                  })}
                  <td className="text-right px-3 py-2 font-semibold text-slate-900">
                    {formatCurrency(clientTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-3 py-2 font-semibold text-slate-700">Totale</td>
              {categories.map((cat) => {
                const catk = cat.id ?? "__null__";
                return (
                  <td key={catk} className="text-right px-3 py-2 font-semibold text-slate-700">
                    {formatCurrency(totals.byCategory.get(catk) ?? 0)}
                  </td>
                );
              })}
              <td className="text-right px-3 py-2 font-bold text-slate-900">
                {formatCurrency(totals.grand)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
