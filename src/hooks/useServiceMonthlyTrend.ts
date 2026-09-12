import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ServiceMonthlyData {
  month: number;
  grossAmount: number;
  receiptCount: number;
}

export function useServiceMonthlyTrend(
  fiscalYear: number,
  serviceId: string | null | undefined,
) {
  const { user } = useAuth();

  return useQuery<ServiceMonthlyData[]>({
    queryKey: ["service-monthly-trend", user?.id, fiscalYear, serviceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_service_monthly_trend",
        {
          p_user_id: user!.id,
          p_fiscal_year: fiscalYear,
          p_service_id: serviceId ?? null,
        },
      );
      if (error) throw error;
      return ((data as any[]) ?? []).map((row: any) => ({
        month: Number(row.month) || 0,
        grossAmount: Number(row.gross_amount) || 0,
        receiptCount: Number(row.receipt_count) || 0,
      }));
    },
    enabled: !!user && serviceId !== undefined,
    staleTime: 60_000,
  });
}
