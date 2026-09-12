import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CrossAnalysisEntry {
  clientId: string | null;
  clientName: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  totalGross: number;
  receiptCount: number;
}

export interface CrossClient {
  id: string | null;
  name: string;
  totalGross: number;
}

export interface CrossCategory {
  id: string | null;
  name: string;
  color: string;
  totalGross: number;
}

export interface CrossCellData {
  totalGross: number;
  receiptCount: number;
}

export interface CrossTotals {
  byClient: Map<string, number>;
  byCategory: Map<string, number>;
  grand: number;
}

export interface CrossAnalysisData {
  entries: CrossAnalysisEntry[];
  clients: CrossClient[];
  categories: CrossCategory[];
  matrix: Map<string, Map<string, CrossCellData>>;
  totals: CrossTotals;
}

function keyOf(id: string | null): string {
  return id ?? "__null__";
}

function transformData(entries: CrossAnalysisEntry[]): CrossAnalysisData {
  const clientMap = new Map<string, CrossClient>();
  const categoryMap = new Map<string, CrossCategory>();
  const matrix = new Map<string, Map<string, CrossCellData>>();
  const totalsByClient = new Map<string, number>();
  const totalsByCategory = new Map<string, number>();
  let grand = 0;

  for (const e of entries) {
    const ck = keyOf(e.clientId);
    const catk = keyOf(e.categoryId);

    // Accumulate client totals
    if (!clientMap.has(ck)) {
      clientMap.set(ck, { id: e.clientId, name: e.clientName, totalGross: 0 });
    }
    clientMap.get(ck)!.totalGross += e.totalGross;

    // Accumulate category totals
    if (!categoryMap.has(catk)) {
      categoryMap.set(catk, { id: e.categoryId, name: e.categoryName, color: e.categoryColor, totalGross: 0 });
    }
    categoryMap.get(catk)!.totalGross += e.totalGross;

    // Fill matrix
    if (!matrix.has(ck)) matrix.set(ck, new Map());
    matrix.get(ck)!.set(catk, { totalGross: e.totalGross, receiptCount: e.receiptCount });

    // Totals
    totalsByClient.set(ck, (totalsByClient.get(ck) ?? 0) + e.totalGross);
    totalsByCategory.set(catk, (totalsByCategory.get(catk) ?? 0) + e.totalGross);
    grand += e.totalGross;
  }

  const clients = Array.from(clientMap.values()).sort((a, b) => b.totalGross - a.totalGross);
  const categories = Array.from(categoryMap.values()).sort((a, b) => b.totalGross - a.totalGross);

  return {
    entries,
    clients,
    categories,
    matrix,
    totals: { byClient: totalsByClient, byCategory: totalsByCategory, grand },
  };
}

export function useCrossAnalysis(fiscalYear: number | null) {
  const { user } = useAuth();

  const query = useQuery<CrossAnalysisData>({
    queryKey: ["cross-analysis", user?.id, fiscalYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_cross_analysis", {
        p_user_id: user!.id,
        p_fiscal_year: fiscalYear,
      });
      if (error) throw error;

      const entries: CrossAnalysisEntry[] = ((data as any[]) ?? []).map((row: any) => ({
        clientId: row.client_id ?? null,
        clientName: row.client_name ?? "Senza cliente",
        categoryId: row.category_id ?? null,
        categoryName: row.category_name ?? "Non categorizzato",
        categoryColor: row.category_color ?? "#94a3b8",
        totalGross: Number(row.total_gross) || 0,
        receiptCount: Number(row.receipt_count) || 0,
      }));

      return transformData(entries);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
