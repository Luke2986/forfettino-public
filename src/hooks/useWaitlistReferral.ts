import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProWaitlist } from "./useProWaitlist";

interface ReferralInfo {
  referral_token: string | null;
  invites_count: number;
  queue_position_boost: number;
  next_boost_at: number | null;
  next_boost_label: string | null;
}

export function useWaitlistReferral() {
  const { user } = useAuth();
  const { isJoined } = useProWaitlist();

  const query = useQuery({
    queryKey: ["waitlist-referral", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_my_referral_info" as any
      );
      if (error) throw error;
      return data as ReferralInfo;
    },
    enabled: !!user && isJoined,
    staleTime: 60_000,
  });

  const referralToken = query.data?.referral_token ?? null;
  const referralUrl = referralToken
    ? `${window.location.origin}/pro-presto?wl=${referralToken}`
    : null;

  return {
    referralToken,
    invitesCount: query.data?.invites_count ?? 0,
    boostLevel: query.data?.queue_position_boost ?? 0,
    nextBoostAt: query.data?.next_boost_at ?? null,
    nextBoostLabel: query.data?.next_boost_label ?? null,
    referralUrl,
    isLoading: query.isLoading,
  };
}
