import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateHHI,
  classifyConcentration,
  type ConcentrationLevel,
} from "@/lib/client-analytics";

export interface ServiceRevenue {
  serviceId: string | null;
  serviceName: string;
  serviceColor: string;
  totalGross: number;
  totalNet: number;
  receiptCount: number;
  firstReceiptDate: string;
  lastReceiptDate: string;
  percentage: number;
}

export interface ServiceRevenueMetrics {
  hhi: number;
  concentration: ConcentrationLevel;
  topServicePct: number;
  serviceCount: number;
  totalGross: number;
}

export function useServiceRevenueReport(fiscalYear: number | null) {
  const { user } = useAuth();

  const query = useQuery<ServiceRevenue[]>({
    queryKey: ["service-revenue-report", user?.id, fiscalYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_service_revenue_report",
        { p_user_id: user!.id, p_fiscal_year: fiscalYear },
      );
      if (error) throw error;
      return ((data as any[]) ?? []).map((row: any) => ({
        serviceId: row.service_id ?? null,
        serviceName: row.service_name ?? "Non categorizzato",
        serviceColor: row.service_color ?? "#94a3b8",
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
  const metrics: ServiceRevenueMetrics | undefined = query.data
    ? (() => {
        const hhi = calculateHHI(data);
        return {
          hhi,
          concentration: classifyConcentration(hhi),
          topServicePct: data.length > 0 ? data[0].percentage : 0,
          serviceCount: data.length,
          totalGross: data.reduce((sum, s) => sum + s.totalGross, 0),
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
