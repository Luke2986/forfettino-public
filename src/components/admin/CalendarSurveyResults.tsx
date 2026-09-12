import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";

const SURVEY_KEY = "calendar_usage_v1";

interface SurveyRow {
  id: string;
  selected_reason: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  google_calendar: "Google Calendar",
  apple_calendar: "Apple Calendar",
  outlook: "Outlook",
  other: "Altro",
  no: "No",
};

const PROVIDER_ORDER = ["google_calendar", "apple_calendar", "outlook", "other", "no"];

function parseProvider(row: SurveyRow): string {
  try {
    const parsed = JSON.parse(row.selected_reason);
    return parsed.provider || "unknown";
  } catch {
    return "unknown";
  }
}

export function CalendarSurveyResults() {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["admin-calendar-survey"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("survey_responses")
        .select("id, selected_reason")
        .eq("survey_key", SURVEY_KEY);
      if (error) return [];
      return (data ?? []) as SurveyRow[];
    },
  });

  const breakdown = useMemo(() => {
    if (!rawData || rawData.length === 0) return null;

    const counts: Record<string, number> = {};
    for (const row of rawData) {
      const provider = parseProvider(row);
      counts[provider] = (counts[provider] || 0) + 1;
    }

    const total = rawData.length;
    const yesCount = total - (counts["no"] || 0);
    const yesPct = total > 0 ? Math.round((yesCount / total) * 100) : 0;

    const items = PROVIDER_ORDER.map((key) => ({
      key,
      label: PROVIDER_LABELS[key] || key,
      count: counts[key] || 0,
      pct: total > 0 ? Math.round(((counts[key] || 0) / total) * 100) : 0,
    }));

    return { total, yesCount, yesPct, items };
  }, [rawData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-base">
            Survey Calendario Digitale
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!breakdown || breakdown.total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessuna risposta ricevuta ancora.
          </p>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {breakdown.total} {breakdown.total === 1 ? "risposta totale" : "risposte totali"}
              </span>
              <span className="text-slate-600">
                {breakdown.yesPct}% usa un calendario ({breakdown.yesCount}/{breakdown.total})
              </span>
            </div>

            {/* Breakdown bars */}
            <div className="space-y-2.5">
              {breakdown.items.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-600 tabular-nums">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.key === "no" ? "bg-slate-400" : "bg-blue-500"
                      }`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
