import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ClientMonthlyData {
  month: number;
  grossAmount: number;
  receiptCount: number;
}

export function useClientMonthlyTrend(
  fiscalYear: number,
  clientId: string | null | undefined,
) {
  const { user } = useAuth();

  return useQuery<ClientMonthlyData[]>({
    queryKey: ["client-monthly-trend", user?.id, fiscalYear, clientId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_client_monthly_trend",
        {
          p_user_id: user!.id,
          p_fiscal_year: fiscalYear,
          p_client_id: clientId ?? null,
        },
      );
      if (error) throw error;
      return ((data as any[]) ?? []).map((row: any) => ({
        month: Number(row.month) || 0,
        grossAmount: Number(row.gross_amount) || 0,
        receiptCount: Number(row.receipt_count) || 0,
      }));
    },
    enabled: !!user && clientId !== undefined,
    staleTime: 60_000,
  });
}
