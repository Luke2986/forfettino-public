import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateHHI,
  classifyConcentration,
  type ClientRevenue,
  type ConcentrationLevel,
} from "@/lib/client-analytics";

export interface ClientRevenueMetrics {
  hhi: number;
  concentration: ConcentrationLevel;
  topClientPct: number;
  clientCount: number;
  totalGross: number;
}

export function useClientRevenueReport(fiscalYear: number | null) {
  const { user } = useAuth();

  const query = useQuery<ClientRevenue[]>({
    queryKey: ["client-revenue-report", user?.id, fiscalYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_client_revenue_report",
        { p_user_id: user!.id, p_fiscal_year: fiscalYear },
      );
      if (error) throw error;
      return ((data as any[]) ?? []).map((row: any) => ({
        clientId: row.client_id ?? null,
        clientName: row.client_name ?? "Senza cliente",
        totalGross: Number(row.total_gross) || 0,
        totalNet: Number(row.total_net) || 0,
        receiptCount: Number(row.receipt_count) || 0,
        firstReceiptDate: row.first_receipt_date,
        lastReceiptDate: row.last_receipt_date,
        percentage: Number(row.percentage) || 0,
      }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const data = query.data ?? [];
  const metrics: ClientRevenueMetrics | undefined = query.data
    ? (() => {
        const hhi = calculateHHI(data);
        return {
          hhi,
          concentration: classifyConcentration(hhi),
          topClientPct: data.length > 0 ? data[0].percentage : 0,
          clientCount: data.length,
          totalGross: data.reduce((sum, c) => sum + c.totalGross, 0),
        };
      })()
    : undefined;

  return {
    data: query.data,
    metrics,
    isLoading: query.isLoading,
    error: query.error,
  };
}
