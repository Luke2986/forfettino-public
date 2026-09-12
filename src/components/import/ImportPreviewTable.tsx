import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { ImportPreviewRow } from "@/hooks/useImportFatture";

interface ImportPreviewTableProps {
  rows: ImportPreviewRow[];
  onToggleRow: (index: number) => void;
  onToggleAll: (selected: boolean) => void;
}

export function ImportPreviewTable({
  rows,
  onToggleRow,
  onToggleAll,
}: ImportPreviewTableProps) {
  const allSelected = rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected) && !allSelected;
  const selectedCount = rows.filter((r) => r.selected).length;

  const totalGross = rows
    .filter((r) => r.selected)
    .reduce((sum, r) => sum + r.grossAmount, 0);
  const totalNet = rows
    .filter((r) => r.selected)
    .reduce((sum, r) => sum + r.netSpendable, 0);

  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {selectedCount} di {rows.length} fattur{rows.length === 1 ? "a" : "e"} selezionat{selectedCount === 1 ? "a" : "e"}
        </span>
        {rows.some((r) => r.isDuplicate) && (
          <Badge variant="outline" className="text-warning border-warning-muted">
            Possibili duplicati trovati
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border max-h-[400px] overflow-auto">
        <Table>
          <TableCaption className="sr-only">Anteprima fatture da importare</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      // indeterminate via data attribute for styling
                      (el as unknown as HTMLButtonElement).dataset.state = someSelected
                        ? "indeterminate"
                        : allSelected
                        ? "checked"
                        : "unchecked";
                    }
                  }}
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>N° Fattura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Lordo</TableHead>
              <TableHead className="text-right">Netto dopo tasse e INPS</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.index}
                className={row.isDuplicate ? "bg-warning-muted" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={() => onToggleRow(row.index)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.invoiceNumber}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{row.clientName}</span>
                    {row.direction !== "auto" && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 shrink-0"
                      >
                        {row.direction === "emessa" ? "Emessa" : "Ricevuta"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(row.grossAmount)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground whitespace-nowrap tabular-nums">
                  {formatCurrency(row.netSpendable)}
                </TableCell>
                <TableCell>
                  {row.isDuplicate && (
                    <Badge
                      variant="outline"
                      className="text-warning border-warning-muted text-xs px-1.5"
                    >
                      Duplicato?
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totali */}
      <div className="flex justify-end gap-6 text-sm font-medium pt-1">
        <span>
          Totale lordo: <span className="text-foreground tabular-nums">{formatCurrency(totalGross)}</span>
        </span>
        <span>
          Netto dopo tasse e INPS: <span className="text-muted-foreground tabular-nums">{formatCurrency(totalNet)}</span>
        </span>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: it });
  } catch {
    return dateStr;
  }
}
