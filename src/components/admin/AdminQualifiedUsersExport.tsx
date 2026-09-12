import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, UserCheck } from "lucide-react";
import { useAdminQualifiedUsers } from "@/hooks/useAdminQualifiedUsers";
import type { AdminQualifiedUser } from "@/hooks/useAdminQualifiedUsers";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { csvSafe, downloadCsv } from "@/lib/csv-export";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

function safeParseDate(dateStr: string): Date {
  if (dateStr.includes("T")) return new Date(dateStr);
  return new Date(dateStr + "T00:00:00");
}

function exportQualifiedUsersCsv(users: AdminQualifiedUser[]) {
  const header = "codice,nome,email,incassi,gestione_inps,data_iscrizione,consenso_email";
  const rows = users.map((u) => {
    const nome = csvSafe(u.firstName ?? "\u2014");
    const email = csvSafe(u.email);
    const code = csvSafe(u.userCode);
    const inps = csvSafe(u.inpsType ?? "");
    const dataIscr = format(safeParseDate(u.createdAt), "dd/MM/yyyy", { locale: it });
    return `${code},${nome},${email},${u.receiptCount},${inps},${dataIscr},si`;
  });
  const filename = `utenti_qualificati_${format(new Date(), "yyyy-MM-dd")}.csv`;
  downloadCsv(header, rows, filename);
}

export function AdminQualifiedUsersExport() {
  const { user, loading: authLoading } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const [minReceipts, setMinReceipts] = useState(3);
  const [debouncedMin, setDebouncedMin] = useState(3);
  const queryEnabled = !!user && !authLoading && !roleLoading && role === "admin";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMin(minReceipts), 300);
    return () => clearTimeout(timer);
  }, [minReceipts]);

  const { data, isLoading } = useAdminQualifiedUsers(debouncedMin, queryEnabled);
  const count = data?.length ?? 0;
  const showLoading = isLoading || !queryEnabled;

  function handleExport() {
    if (!data || data.length === 0) return;
    try {
      exportQualifiedUsersCsv(data);
      toast.success(`Esportati ${data.length} utenti qualificati`);
    } catch (err) {
      console.warn("Export CSV error:", err);
      toast.error("Errore durante l'export CSV");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-teal-600" />
          Export Utenti Qualificati
        </CardTitle>
        <p className="text-sm text-slate-500">
          Utenti con almeno N incassi e consenso email per interviste qualitative
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label htmlFor="min-receipts" className="text-sm font-medium text-slate-700 whitespace-nowrap">
            Soglia minima incassi
          </label>
          <Input
            id="min-receipts"
            type="number"
            min={1}
            max={100}
            value={minReceipts}
            onChange={(e) => setMinReceipts(Math.round(Math.max(1, Math.min(100, Number(e.target.value) || 1))))}
            className="w-20"
          />
          {showLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <Badge variant="secondary">{count} utenti</Badge>
          )}
        </div>
        <Button
          onClick={handleExport}
          disabled={count === 0 || showLoading}
          variant="outline"
          size="sm"
        >
          <Download className="h-4 w-4 mr-2" />
          Esporta CSV
        </Button>
      </CardContent>
    </Card>
  );
}
