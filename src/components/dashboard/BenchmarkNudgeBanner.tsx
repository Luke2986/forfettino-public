/**
 * BenchmarkNudgeBanner — Story 46.2
 *
 * Banner nudge in Dashboard che invita utenti PRO/admin
 * a scoprire il comparatore tariffe (/benchmark).
 *
 * Mostra una preview della tariffa mediana se il codice ATECO
 * dell'utente è mappabile a un jobTitle Datapizza.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useIncomeStats } from "@/hooks/useIncomeStats";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { supabase } from "@/integrations/supabase/client";
import { mapAtecoToJobTitle } from "@/lib/ateco-to-role-mapping";
import {
  computeBenchmark,
  DEFAULT_CONFIG,
  formatJobTitle,
  type AggregatedBenchmarkData,
} from "@/lib/benchmark-engine";
import benchmarkData from "@/data/benchmark-aggregated.json";

const LS_DISMISSED = "forfettino:benchmark-nudge-dismissed";
const MIN_INCASSI = 3;

function isDismissed(): boolean {
  try {
    return localStorage.getItem(LS_DISMISSED) === "1";
  } catch {
    return false;
  }
}

export function BenchmarkNudgeBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, isLoading: subLoading } = useSubscription();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const isAdmin = userRole === "admin";
  const { data: incomeStats } = useIncomeStats();
  const { selectedYear } = useFiscalYear();

  const [dismissed, setDismissed] = useState(isDismissed);

  // Fetch ateco_code from fiscal_year_settings
  const { data: atecoCode } = useQuery({
    queryKey: ["benchmark_nudge_ateco", user?.id, selectedYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from("fiscal_year_settings")
        .select("ateco_code")
        .eq("user_id", user.id)
        .eq("fiscal_year", selectedYear)
        .maybeSingle();
      if (error || !data) return null;
      return (data.ateco_code as string) || null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Map ATECO → jobTitle and compute benchmark preview
  const preview = useMemo(() => {
    if (!atecoCode) return null;
    const jobTitle = mapAtecoToJobTitle(atecoCode);
    if (!jobTitle) return null;

    const result = computeBenchmark(
      benchmarkData as unknown as AggregatedBenchmarkData,
      { jobTitle },
      DEFAULT_CONFIG,
    );
    if (!result) return null;

    return {
      hourlyRate: Math.round(result.median.hourly),
      jobLabel: formatJobTitle(jobTitle),
    };
  }, [atecoCode]);

  // Visibility conditions
  const shouldShow = (() => {
    if (subLoading || roleLoading) return false;
    if (!isPro && !isAdmin) return false;
    if (!incomeStats || incomeStats.count_total < MIN_INCASSI) return false;
    if (dismissed) return false;
    return true;
  })();

  if (!shouldShow) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(LS_DISMISSED, "1");
    } catch {
      // localStorage unavailable
    }
    setDismissed(true);
  };

  return (
    <div
      className="squircle-md border border-blue-200/60 bg-gradient-to-r from-blue-50 to-white px-4 py-3"
      role="region"
      aria-label="Confronta le tue tariffe"
    >
      <div className="flex items-start gap-3">
        <BarChart3 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            Scopri se le tue tariffe sono competitive
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            {preview
              ? `Freelancer ${preview.jobLabel} fatturano in media ~\u20AC${preview.hourlyRate}/ora. Confronta con le tue tariffe.`
              : "Confronta quanto fatturi con la mediana del mercato italiano per il tuo ruolo."}
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/benchmark")}
            >
              Confronta
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              Non mi interessa
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Chiudi banner benchmark"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
