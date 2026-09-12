import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Download, Users, Loader2 } from "lucide-react";
import { useConsentedEmails } from "@/hooks/useConsentedEmails";
import { downloadCsv } from "@/lib/csv";

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AdminConsentedEmailList() {
  const [isOpen, setIsOpen] = useState(false);
  const { emails, count, isLoading } = useConsentedEmails();

  function handleExportCsv() {
    const header = "Email,Data consenso";
    const rows = emails.map((e) => `${e.email},${formatDate(e.consent_at)}`);
    downloadCsv(`consensi-email-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join("\n"));
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="consented-email-list">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 w-full justify-start text-sm text-slate-600 hover:text-slate-900"
          data-testid="consented-email-trigger"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Users className="h-4 w-4" />
          {isLoading
            ? "Caricamento destinatari..."
            : `Destinatari con consenso (${count})`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          </div>
        ) : count === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center" data-testid="consented-empty">
            Nessun utente ha dato il consenso email
          </p>
        ) : (
          <div className="mt-2">
            <div className="flex justify-end mb-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                data-testid="export-consented-csv"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </div>
          <div className="max-h-[200px] overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Data consenso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((e) => (
                  <TableRow key={e.email}>
                    <TableCell className="font-mono text-sm">
                      {e.email}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(e.consent_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
