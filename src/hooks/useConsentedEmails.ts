import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ConsentedEmail {
  email: string;
  consent_at: string | null;
}

export function useConsentedEmails() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["consented-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_consented_email_list" as any,
      );
      if (error) throw error;
      return (data as unknown as ConsentedEmail[]) ?? [];
    },
    staleTime: 60_000,
  });

  return {
    emails: data ?? [],
    count: data?.length ?? 0,
    isLoading,
    error,
  };
}
