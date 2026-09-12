import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapRpcToBreakdown, type ContributionBreakdown } from "@/lib/contribution-helpers";

export function useMyContributions() {
  return useQuery<ContributionBreakdown>({
    queryKey: ["my-contributions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_my_contributions" as any,
      );
      if (error) throw error;
      const rows = data as any[];
      if (!rows || rows.length === 0) {
        return {
          callPts: 0,
          feedbackPts: 0,
          referralPts: 0,
          firstImportXmlPts: 0,
          welcomeGiftPts: 0,
          adminManualPts: 0,
          npsSurveyPts: 0,
          pricingSurveyPts: 0,
          calendarSurveyPts: 0,
          totalPts: 0,
          myRank: 0,
          monthlyReferralCount: 0,
        };
      }
      return mapRpcToBreakdown(rows[0]);
    },
    staleTime: 2 * 60_000,
  });
}
