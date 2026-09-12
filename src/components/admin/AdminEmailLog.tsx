import { useState, useMemo, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Download, Loader2 } from "lucide-react";
import { useEmailLog } from "@/hooks/useEmailLog";
import type { EmailBatch } from "@/hooks/useEmailLog";
import { escapeCsvField, downloadCsv } from "@/lib/csv";

const PAGE_SIZE = 10;

function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BatchStatusBadges({ summary }: { summary: EmailBatch["summary"] }) {
  return (
    <div className="flex gap-1.5">
      {summary.sent > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          {summary.sent} inviate
        </span>
      )}
      {summary.failed > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          {summary.failed} fallite
        </span>
      )}
    </div>
  );
}

function RecipientStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sent: "bg-green-100 text-green-700",
    delivered: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    bounced: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}

export function AdminEmailLog() {
  const { batches, isLoading } = useEmailLog();
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
  const paginatedBatches = useMemo(
    () =>
      batches.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [batches, currentPage],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center" data-testid="email-log-empty">
        Nessuna email inviata
      </p>
    );
  }

  function handleExportCsv() {
    const header = "Data,Oggetto,Email,Stato,Resend ID,Errore";
    const rows = batches.flatMap((b) =>
      b.recipients.map((r) =>
        [
          formatDateTime(r.sent_at),
          escapeCsvField(r.subject),
          r.recipient_email,
          r.status,
          r.resend_message_id ?? "",
          escapeCsvField(r.error_message ?? ""),
        ].join(","),
      ),
    );
    downloadCsv(`email-log-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join("\n"));
  }

  return (
    <div data-testid="email-log">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Storico invii
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          data-testid="export-log-csv"
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Data</TableHead>
              <TableHead>Oggetto</TableHead>
              <TableHead>Destinatari</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBatches.map((batch) => (
              <Fragment key={batch.batchId}>
                <TableRow
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() =>
                    setExpandedBatchId((prev) =>
                      prev === batch.batchId ? null : batch.batchId,
                    )
                  }
                  data-testid={`batch-row-${batch.batchId}`}
                >
                  <TableCell className="w-8 px-2">
                    {expandedBatchId === batch.batchId ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(batch.sentAt)}
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">
                    {batch.subject}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.summary.total}
                  </TableCell>
                  <TableCell>
                    <BatchStatusBadges summary={batch.summary} />
                  </TableCell>
                </TableRow>
                {expandedBatchId === batch.batchId && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <div className="bg-slate-50 p-4" data-testid={`batch-detail-${batch.batchId}`}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Stato</TableHead>
                              <TableHead>Resend ID</TableHead>
                              <TableHead>Errore</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batch.recipients.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-mono text-sm">
                                  {r.recipient_email}
                                </TableCell>
                                <TableCell>
                                  <RecipientStatusBadge status={r.status} />
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-500">
                                  {r.resend_message_id?.slice(0, 12) ?? "—"}
                                </TableCell>
                                <TableCell className="text-sm text-red-600">
                                  {r.error_message ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-slate-500">
            Pagina {currentPage} di {totalPages} ({batches.length} invii
            totali)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 1}
            >
              Precedente
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage === totalPages}
            >
              Successiva
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
