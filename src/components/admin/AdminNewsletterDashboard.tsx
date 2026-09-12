import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { useToast } from "@/hooks/use-toast";
import {
  Newspaper,
  TrendingUp,
  CheckCircle2,
  UserMinus,
  Download,
  Tag,
} from "lucide-react";

interface NewsletterRow {
  id: string;
  email: string;
  source: string;
  source_detail: string | null;
  lead_magnet: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  tags: string[];
  created_at: string;
}

const SOURCE_COLORS: Record<string, string> = {
  landing: "bg-sky-50 text-sky-700",
  blog: "bg-violet-50 text-violet-700",
  footer: "bg-slate-100 text-slate-700",
  calcolatore: "bg-emerald-50 text-emerald-700",
  "pro-waitlist": "bg-amber-50 text-amber-700",
  other: "bg-gray-100 text-gray-600",
};

const LEAD_MAGNET_COLORS: Record<string, string> = {
  guida_protezione: "bg-teal-50 text-teal-700",
  scadenziario_2026: "bg-orange-50 text-orange-700",
  simulatore_acconti_2026: "bg-blue-50 text-blue-700",
};

export function AdminNewsletterDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-newsletter-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NewsletterRow[];
    },
  });

  // Hook MUST be called before any conditional return (React Rules of Hooks)
  const tagCounts = useMemo(() => {
    if (!data) return [];
    const active = data.filter((r) => r.confirmed_at && !r.unsubscribed_at);
    const counts: Record<string, number> = {};
    active.forEach((r) =>
      (r.tags ?? []).forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [data]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  const rows = data ?? [];

  // --- Stats ---
  const confirmedActive = rows.filter((r) => r.confirmed_at && !r.unsubscribed_at);
  const totalConfirmed = confirmedActive.length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const confirmedLast7d = confirmedActive.filter(
    (r) => new Date(r.confirmed_at!) >= sevenDaysAgo
  ).length;

  // Tasso conferma: tutti i confermati (inclusi poi disiscritti) / totale richieste
  const totalRecords = rows.length;
  const allConfirmed = rows.filter((r) => r.confirmed_at).length;
  const confirmationRate = totalRecords > 0
    ? (allConfirmed / totalRecords * 100).toFixed(1)
    : "0.0";

  const totalUnsubscribed = rows.filter((r) => r.unsubscribed_at).length;

  // --- Breakdown per source (solo confermati attivi) ---
  const sourceCounts: Record<string, number> = {};
  for (const r of confirmedActive) {
    const s = r.source || "other";
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }

  // --- Breakdown per lead_magnet (solo confermati attivi) ---
  const leadMagnetCounts: Record<string, number> = {};
  for (const r of confirmedActive) {
    const lm = r.lead_magnet || "nessuno";
    leadMagnetCounts[lm] = (leadMagnetCounts[lm] || 0) + 1;
  }

  // --- Tabella: ultimi 100 confermati (inclusi disiscritti, visibili in colonna Unsub) ---
  const tableRows = rows
    .filter((r) => r.confirmed_at)
    .sort((a, b) => new Date(b.confirmed_at!).getTime() - new Date(a.confirmed_at!).getTime())
    .slice(0, 100);

  // --- Export CSV ---
  const handleExportCSV = () => {
    const exportRows = rows.filter((r) => r.confirmed_at && !r.unsubscribed_at);
    if (!exportRows.length) {
      toast({ title: "Nessun iscritto", description: "Non ci sono iscritti confermati attivi.", variant: "destructive" });
      return;
    }
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = "email,source,source_detail,confirmed_at,tags";
    const csvRows = exportRows.map((r) =>
      `${esc(r.email)},${esc(r.source)},${esc(r.source_detail ?? "")},${esc(r.confirmed_at ?? "")},${esc((r.tags ?? []).join(";"))}`
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter_subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export completato", description: `${exportRows.length} iscritti esportati.` });
  };

  // --- Aggiungi tag (admin) ---
  const handleAddTag = async (email: string) => {
    const tag = window.prompt("Inserisci tag (lowercase, kebab-case):");
    if (!tag?.trim()) return;
    const { data: result, error } = await supabase.rpc("add_tag_to_subscriber" as any, {
      p_email: email,
      p_tag: tag.trim(),
    });
    if (error || !(result as any)?.success) {
      const rpcError = (result as any)?.error;
      const msg = rpcError === "unauthorized"
        ? "Non autorizzato: solo admin possono aggiungere tag."
        : rpcError === "empty_tag"
          ? "Il tag non può essere vuoto."
          : "Tag non aggiunto (subscriber non trovato o tag già presente).";
      toast({ variant: "destructive", description: msg });
      return;
    }
    toast({ description: `Tag "${tag.trim()}" aggiunto.` });
    queryClient.invalidateQueries({ queryKey: ["admin-newsletter-stats"] });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Newspaper className="h-5 w-5 text-teal-500" />
          Newsletter
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={totalConfirmed === 0}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            icon={<Newspaper className="h-5 w-5 text-teal-500" />}
            label="Iscritti Confermati"
            value={totalConfirmed}
            iconClassName="bg-teal-500/10"
          />
          <AdminStatCard
            icon={<TrendingUp className="h-5 w-5 text-green-500" />}
            label="Nuovi 7gg"
            value={confirmedLast7d}
            iconClassName="bg-green-500/10"
          />
          <AdminStatCard
            icon={<CheckCircle2 className="h-5 w-5 text-blue-500" />}
            label="Tasso Conferma"
            value={`${confirmationRate}%`}
            iconClassName="bg-blue-500/10"
          />
          <AdminStatCard
            icon={<UserMinus className="h-5 w-5 text-red-500" />}
            label="Unsubscribe"
            value={totalUnsubscribed}
            iconClassName="bg-red-500/10"
          />
        </div>

        {/* Breakdown Source */}
        {totalConfirmed > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Per source</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sourceCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => (
                  <div
                    key={source}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${SOURCE_COLORS[source] ?? SOURCE_COLORS.other}`}
                  >
                    <span className="text-sm font-medium">{source}</span>
                    <span className="text-sm">{count} ({(count / totalConfirmed * 100).toFixed(0)}%)</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Breakdown Lead Magnet */}
        {totalConfirmed > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Per lead magnet</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(leadMagnetCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([lm, count]) => (
                  <div
                    key={lm}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${LEAD_MAGNET_COLORS[lm] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    <span className="text-sm font-medium">{lm}</span>
                    <span className="text-sm">{count} ({(count / totalConfirmed * 100).toFixed(0)}%)</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Top 10 Tag */}
        {tagCounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Top tag</p>
            <div className="flex flex-wrap gap-2">
              {tagCounts.map(([tag, count]) => (
                <div
                  key={tag}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 bg-slate-100 text-slate-700"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span className="text-sm font-medium">{tag}</span>
                  <span className="text-sm">{count} ({(count / totalConfirmed * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabella iscritti */}
        {tableRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun iscritto confermato.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Source</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Lead Magnet</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Confermato</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Tags</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Unsub</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-700">
                      <span className="block truncate max-w-[180px]">{row.email}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-xs">{row.source}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {row.lead_magnet ? (
                        <Badge variant="outline" className="text-xs">{row.lead_magnet}</Badge>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(row.confirmed_at!).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      {row.tags?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {row.unsubscribed_at
                        ? new Date(row.unsubscribed_at).toLocaleDateString("it-IT", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddTag(row.email)}
                        className="h-7 w-7 p-0"
                        title="Aggiungi tag"
                      >
                        <Tag className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
