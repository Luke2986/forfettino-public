/**
 * useExportCommercialista - Hook per export Excel commercialista
 *
 * Carica xlsx tramite dynamic import (code splitting)
 * per evitare di appesantire il bundle iniziale (~400KB).
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useFiscalCalculations } from "@/hooks/useFiscalCalculations";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";

export function useExportCommercialista(yearOverride?: number) {
  const { user } = useAuth();
  const { selectedYear } = useFiscalYear();
  const currentYear = yearOverride ?? selectedYear;
  const { metrics } = useFiscalCalculations(currentYear);
  const { data: profile } = useProfile();
  const { toast } = useToast();

  const [isExporting, setIsExporting] = useState(false);

  // Query receipts ordinati per data (per il foglio dettaglio)
  const { data: receipts } = useQuery({
    queryKey: ["export_receipts", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("receipt_date, client_name, gross_amount, notes")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .order("receipt_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleExport = useCallback(async () => {
    if (!receipts || !metrics) return;

    setIsExporting(true);
    try {
      // Dynamic import per code splitting
      const { exportCommercialista } = await import("@/lib/excel-export");

      const userName =
        profile?.first_name || profile?.last_name
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
          : undefined;

      await exportCommercialista({
        receipts,
        metrics,
        fiscalYear: currentYear,
        userName,
      });

      toast({
        title: "Export completato",
        description: `File Forfettino_${currentYear}_Export.xlsx scaricato.`,
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({
        title: "Errore durante l'export",
        description: "Non è stato possibile generare il file Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [receipts, metrics, currentYear, profile, toast]);

  return {
    handleExport,
    isExporting,
    isReady: !!receipts && !!metrics,
  };
}
