import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Download, Users, Trophy, Mail } from "lucide-react";
import { useWaitlistNurtureStats, EMAIL_TYPE_LABELS } from "@/hooks/useWaitlistNurtureStats";
import type { NurtureStatRow } from "@/hooks/useWaitlistNurtureStats";
import { useToast } from "@/hooks/use-toast";

interface WaitlistEntry {
  id: string;
  user_id: string;
  email: string;
  consent_given_at: string;
  revoked_at: string | null;
  created_at: string;
  referral_token?: string;
  invites_count?: number;
  queue_position_boost?: number;
}

interface WaitlistLead {
  id: string;
  email: string;
  source: string;
  source_detail: string | null;
  referred_by_token: string | null;
  confirmed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

type UnifiedEntry = {
  id: string;
  email: string;
  date: string;
  type: "account" | "lead";
  revoked: boolean;
  referredByToken: string | null;
};

export function AdminProWaitlist() {
  const { toast } = useToast();

  const { data: pwData, isLoading: pwLoading } = useQuery({
    queryKey: ["admin-pro-waitlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_waitlist")
        .select("*")
        .order("consent_given_at", { ascending: false });
      if (error) throw error;
      return data as WaitlistEntry[];
    },
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["admin-waitlist-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist_leads" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as WaitlistLead[];
    },
  });

  const isLoading = pwLoading || leadsLoading;

  // Email set delle pro_waitlist attive (per dedup lead già convertiti)
  const pwEmails = useMemo(
    () => new Set((pwData ?? []).filter((e) => !e.revoked_at).map((e) => e.email.toLowerCase())),
    [pwData]
  );

  // Unifica le due sorgenti in un'unica lista
  const allEntries = useMemo<UnifiedEntry[]>(() => {
    const entries: UnifiedEntry[] = [];

    for (const e of pwData ?? []) {
      entries.push({
        id: e.id,
        email: e.email,
        date: e.consent_given_at,
        type: "account",
        revoked: !!e.revoked_at,
        referredByToken: null,
      });
    }

    for (const l of leadsData ?? []) {
      // Escludi lead il cui email è già in pro_waitlist (merge avvenuto parzialmente)
      if (pwEmails.has(l.email.toLowerCase())) continue;
      entries.push({
        id: l.id,
        email: l.email,
        date: l.confirmed_at ?? l.created_at,
        type: "lead",
        revoked: !!l.revoked_at,
        referredByToken: l.referred_by_token,
      });
    }

    // Ordina per data discendente
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }, [pwData, leadsData, pwEmails]);

  const activeEntries = allEntries.filter((e) => !e.revoked);
  const revokedCount = allEntries.filter((e) => e.revoked).length;
  const accountCount = activeEntries.filter((e) => e.type === "account").length;
  const leadCount = activeEntries.filter((e) => e.type === "lead").length;

  const topReferrers = useMemo(
    () =>
      (pwData ?? [])
        .filter((e) => !e.revoked_at && (e.invites_count ?? 0) > 0)
        .sort((a, b) => (b.invites_count ?? 0) - (a.invites_count ?? 0))
        .slice(0, 10),
    [pwData]
  );

  const handleExportCSV = () => {
    if (!activeEntries.length) {
      toast({ title: "Nessun iscritto", description: "La waitlist è vuota.", variant: "destructive" });
      return;
    }
    const header = "email,data,tipo,referral_token";
    const rows = activeEntries.map((e) =>
      `${e.email},${new Date(e.date).toLocaleDateString("it-IT")},${e.type},${e.referredByToken ?? ""}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pro-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export completato", description: `${activeEntries.length} email esportate.` });
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-5 w-5 text-sky-500" />
          Waitlist Pro
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={!activeEntries.length}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2">
            <Users className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-medium text-sky-700">{activeEntries.length} iscritti</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
            <span className="text-sm font-medium text-emerald-700">{accountCount} account</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
            <span className="text-sm font-medium text-amber-700">{leadCount} lead</span>
          </div>
          {revokedCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
              <span className="text-sm text-slate-500">{revokedCount} revocati</span>
            </div>
          )}
        </div>

        {/* Lista email */}
        {activeEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun iscritto alla waitlist Pro.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Data</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-700">
                      <span className="block truncate max-w-[200px]">
                        {entry.email}
                        {entry.referredByToken && (
                          <span className="ml-1.5 text-xs text-slate-500" title={`Referral: ${entry.referredByToken}`}>
                            via ref
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(entry.date).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {entry.type === "account" ? (
                        <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-xs">
                          Account
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          Lead
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top Referrer */}
        {topReferrers.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Referrer
            </h4>
            <div className="max-h-48 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Inviti</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Boost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topReferrers.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-700">
                        <span className="block truncate max-w-[160px]">{entry.email}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">
                        {entry.invites_count}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        +{entry.queue_position_boost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Email Nurture Stats */}
        <NurtureSection />
      </CardContent>
    </Card>
  );
}

function NurtureStatusBadge({ status }: { status: NurtureStatRow["status"] }) {
  const config = {
    scheduled: { label: "Programmata", className: "bg-slate-100 text-slate-600 border-slate-200" },
    in_progress: { label: "In corso", className: "bg-amber-50 text-amber-700 border-amber-200" },
    completed: { label: "Completata", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const { label, className } = config[status];
  return <Badge className={`text-xs ${className}`}>{label}</Badge>;
}

function NurtureSection() {
  const { data: stats, isLoading } = useWaitlistNurtureStats();

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Mail className="h-4 w-4 text-violet-500" />
        Email Nurture
      </h4>
      {stats.map((win) => (
        <div key={win.windowId} className="space-y-1.5">
          <p className="text-sm text-slate-600">
            {win.windowName} — lancio{" "}
            {new Date(win.startsAt).toLocaleDateString("it-IT", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <div className="overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Inviate</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">In attesa</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Disiscr.</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {win.rows.map((row) => (
                  <tr key={row.email_type} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-700">
                      {EMAIL_TYPE_LABELS[row.email_type].label}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {row.sent}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {row.pending}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {row.unsubscribed}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <NurtureStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
