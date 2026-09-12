import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProcessReferral() {
  return useMutation({
    mutationFn: async (referrerCode: string) => {
      const { error } = await supabase.rpc(
        "process_referral_signup" as any,
        { p_referrer_code: referrerCode },
      );
      if (error) throw error;
    },
  });
}
