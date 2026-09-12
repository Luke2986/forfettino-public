import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUserMessage {
  id: string;
  title: string;
  body: string;
  action_url: string | null;
  action_label: string | null;
  delivery_type: string; // 'sidebar' | 'popup'
  sent_count: number; // 0 = suppressed, 1 = sent
  created_at: string;
  published_at: string | null;
  // Joined from notifications
  read_at: string | null;
  dismissed_at: string | null;
  suppressed: boolean;
}

export function useAdminUserMessages(userId: string | null) {
  return useQuery({
    queryKey: ["admin-user-messages", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Get individual announcements for this user
      const { data: announcements, error } = await (supabase as any)
        .from("admin_announcements")
        .select("*")
        .eq("target_user_id", userId)
        .eq("target_type", "individual")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!announcements?.length) return [];

      // Get notification read status for each announcement
      const announcementIds = announcements.map((a: any) => a.id);
      const { data: notifications } = await supabase
        .from("notifications")
        .select("metadata, read_at, dismissed_at")
        .eq("user_id", userId)
        .eq("type", "admin_individual")
        .in("metadata->>announcement_id", announcementIds);

      const notifMap = new Map(
        (notifications ?? []).map((n: any) => [
          (n.metadata as any)?.announcement_id,
          {
            read_at: n.read_at,
            dismissed_at: n.dismissed_at,
            suppressed: !!(n.metadata as any)?.suppressed,
          },
        ]),
      );

      return announcements.map((a: any) => {
        const notif = notifMap.get(a.id);
        return {
          id: a.id,
          title: a.title,
          body: a.body,
          action_url: a.action_url,
          action_label: a.action_label,
          delivery_type: a.delivery_type ?? "sidebar",
          sent_count: a.sent_count ?? 0,
          created_at: a.created_at,
          published_at: a.published_at,
          read_at: notif?.read_at ?? null,
          dismissed_at: notif?.dismissed_at ?? null,
          suppressed: notif?.suppressed ?? false,
        } satisfies AdminUserMessage;
      });
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
