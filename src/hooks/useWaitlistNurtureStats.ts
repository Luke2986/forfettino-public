import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EmailType = "nurture_t14" | "nurture_t7" | "nurture_t48h";

export interface NurtureStatRow {
  email_type: EmailType;
  sent: number;
  pending: number;
  unsubscribed: number;
  status: "scheduled" | "in_progress" | "completed";
}

export interface NurtureWindowStats {
  windowId: string;
  windowName: string;
  startsAt: string;
  rows: NurtureStatRow[];
}

const EMAIL_TYPE_LABELS: Record<EmailType, { label: string; deltaDays: number }> = {
  nurture_t14: { label: "T-14 (2 settimane)", deltaDays: 14 },
  nurture_t7: { label: "T-7 (1 settimana)", deltaDays: 7 },
  nurture_t48h: { label: "T-48h (2 giorni)", deltaDays: 2 },
};

export { EMAIL_TYPE_LABELS };

function getDeltaDays(startsAt: string): number {
  const now = new Date();
  const start = new Date(startsAt);
  return (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

export function computeStatus(emailType: EmailType, deltaDays: number, sent: number, pending: number): NurtureStatRow["status"] {
  if (pending === 0 && sent > 0) return "completed";

  const thresholds: Record<EmailType, [number, number]> = {
    nurture_t14: [12.5, 15.5],
    nurture_t7: [5.5, 8.5],
    nurture_t48h: [1.0, 3.0],
  };

  const [min, max] = thresholds[emailType];
  if (deltaDays >= min && deltaDays <= max) return "in_progress";
  return "scheduled";
}

export function useWaitlistNurtureStats() {
  return useQuery({
    queryKey: ["admin-waitlist-nurture-stats"],
    queryFn: async () => {
      // 1. Get active launch windows with future starts_at
      const { data: windows, error: winError } = await supabase
        .from("launch_windows")
        .select("id, name, starts_at")
        .eq("is_active", true)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });

      if (winError) throw winError;
      if (!windows || windows.length === 0) return [];

      // 2. Get total active waitlist count
      const { count: activeCount, error: countError } = await supabase
        .from("pro_waitlist")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null);

      if (countError) throw countError;

      // 3. Get unsubscribed count
      const { count: unsubscribedCount, error: unsubError } = await supabase
        .from("pro_waitlist")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .not("unsubscribed_at", "is", null);

      if (unsubError) throw unsubError;

      // 4. Get sent counts per window and email_type
      const windowIds = windows.map((w) => w.id);
      const { data: sentData, error: sentError } = await supabase
        .from("waitlist_email_sent")
        .select("window_id, email_type")
        .in("window_id", windowIds);

      if (sentError) throw sentError;

      // Aggregate sent counts
      const sentCounts = new Map<string, number>();
      for (const row of sentData || []) {
        const key = `${row.window_id}:${row.email_type}`;
        sentCounts.set(key, (sentCounts.get(key) || 0) + 1);
      }

      const totalActive = activeCount ?? 0;
      const totalUnsub = unsubscribedCount ?? 0;
      const eligibleTotal = totalActive - totalUnsub;

      // 5. Build stats per window
      const results: NurtureWindowStats[] = windows.map((win) => {
        const deltaDays = getDeltaDays(win.starts_at);
        const emailTypes: EmailType[] = ["nurture_t14", "nurture_t7", "nurture_t48h"];

        const rows: NurtureStatRow[] = emailTypes.map((emailType) => {
          const sent = sentCounts.get(`${win.id}:${emailType}`) ?? 0;
          const pending = Math.max(0, eligibleTotal - sent);
          const status = computeStatus(emailType, deltaDays, sent, pending);

          return { email_type: emailType, sent, pending, unsubscribed: totalUnsub, status };
        });

        return {
          windowId: win.id,
          windowName: win.name,
          startsAt: win.starts_at,
          rows,
        };
      });

      return results;
    },
    refetchInterval: 60_000, // refresh every minute
  });
}
