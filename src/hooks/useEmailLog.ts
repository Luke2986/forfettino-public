import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface EmailLogRow {
  id: string;
  recipient_email: string;
  subject: string;
  resend_message_id: string | null;
  status: "sent" | "delivered" | "bounced" | "failed";
  error_message: string | null;
  sent_at: string;
  sent_by: string;
  batch_id: string | null;
}

export interface EmailBatch {
  batchId: string;
  subject: string;
  sentAt: string;
  sentBy: string;
  recipients: EmailLogRow[];
  summary: {
    total: number;
    sent: number;
    failed: number;
  };
}

export function groupByBatch(rows: EmailLogRow[]): EmailBatch[] {
  const map = new Map<string, EmailLogRow[]>();
  for (const row of rows) {
    const key = row.batch_id ?? `${row.sent_at}_${row.subject}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries())
    .map(([batchId, recipients]) => ({
      batchId,
      subject: recipients[0].subject,
      sentAt: recipients[0].sent_at,
      sentBy: recipients[0].sent_by,
      recipients,
      summary: {
        total: recipients.length,
        sent: recipients.filter(
          (r) => r.status === "sent" || r.status === "delivered",
        ).length,
        failed: recipients.filter(
          (r) => r.status === "failed" || r.status === "bounced",
        ).length,
      },
    }))
    .sort(
      (a, b) =>
        new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    );
}

export function useEmailLog() {
  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["email-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log" as any)
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as EmailLogRow[];
    },
    staleTime: 30_000,
  });

  const batches = useMemo(
    () => groupByBatch(rows ?? []),
    [rows],
  );

  return { batches, isLoading, error };
}
