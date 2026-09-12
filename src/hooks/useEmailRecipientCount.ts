import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmailRecipientCount() {
  return useQuery({
    queryKey: ["email-recipient-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("marketing_email_consent", true)
        .eq("is_internal", false);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}
