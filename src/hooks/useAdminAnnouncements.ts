import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdminAnnouncementRow =
  Database["public"]["Tables"]["admin_announcements"]["Row"];

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AdminAnnouncementRow[];
    },
    staleTime: 60_000,
  });
}
