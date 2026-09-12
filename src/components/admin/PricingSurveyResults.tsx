import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, BarChart3 } from "lucide-react";
import { csvSafe, downloadCsv } from "@/lib/csv-export";

const SURVEY_KEY = "pricing_van_westendorp_v1";
const TARGET_RESPONSES = 30;
const PAGE_SIZE = 10;

interface SurveyRow {
  id: string;
  selected_reason: string;
  free_text: string | null;
  created_at: string;
  user_code: string;
}

interface ParsedResponse {
  id: string;
  tooCheap: number;
  goodValue: number;
  expensiveOk: number;
  tooExpensive: number;
  freeText: string | null;
  createdAt: string;
  userCode: string;
}

function parseResponse(row: SurveyRow): ParsedResponse {
  let parsed = { too_cheap: 0, good_value: 0, expensive_ok: 0, too_expensive: 0 };
  try {
    parsed = JSON.parse(row.selected_reason);
  } catch {
    // fallback to defaults
  }
  return {
    id: row.id,
    tooCheap: parsed.too_cheap || 0,
    goodValue: parsed.good_value || 0,
    expensiveOk: parsed.expensive_ok || 0,
    tooExpensive: parsed.too_expensive || 0,
    freeText: row.free_text,
    createdAt: row.created_at,
    userCode: row.user_code,
  };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function exportCSV(responses: ParsedResponse[]) {
  const header = "codice_utente,data,too_cheap,good_value,expensive_ok,too_expensive,free_text";
  const rows = responses.map((r) => {
    const date = formatDate(r.createdAt);
    const text = r.freeText ? csvSafe(r.freeText) : "";
    return `${r.userCode},${date},${r.tooCheap},${r.goodValue},${r.expensiveOk},${r.tooExpensive},${text}`;
  });
  const filename = `pricing_survey_${new Date().toISOString().split("T")[0]}.csv`;
  downloadCsv(header, rows, filename);
}

export function PricingSurveyResults() {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["admin-pricing-survey"],
    queryFn: async () => {
      // Join survey_responses with profiles to get user_code
      const { data, error } = await (supabase as any).rpc(
        "admin_get_pricing_survey_responses" as any,
      );
      // Fallback: if RPC doesn't exist yet, query directly
      if (error) {
        const { data: fallbackData } = await (supabase as any)
          .from("survey_responses")
          .select("id, selected_reason, free_text, created_at, user_id")
          .eq("survey_key", SURVEY_KEY)
          .order("created_at", { ascending: false });

        if (!fallbackData) return [];

        // Get user codes separately
        const userIds = [...new Set(fallbackData.map((r: any) => r.user_id))] as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, user_code")
          .in("user_id", userIds);

        const codeMap = new Map<string, string>();
        profiles?.forEach((p: any) => codeMap.set(p.user_id, p.user_code));

        return fallbackData.map((r: any) => ({
          ...r,
          user_code: codeMap.get(r.user_id) || "???",
        })) as SurveyRow[];
      }
      return (data ?? []) as SurveyRow[];
    },
  });

  const responses = useMemo(
    () => (rawData ?? []).map(parseResponse),
    [rawData],
  );

  const stats = useMemo(() => {
    if (responses.length === 0) return null;
    const tc = responses.map((r) => r.tooCheap);
    const gv = responses.map((r) => r.goodValue);
    const eo = responses.map((r) => r.expensiveOk);
    const te = responses.map((r) => r.tooExpensive);
    return {
      tooCheap: { median: median(tc), mean: mean(tc), min: Math.min(...tc), max: Math.max(...tc) },
      goodValue: { median: median(gv), mean: mean(gv), min: Math.min(...gv), max: Math.max(...gv) },
      expensiveOk: { median: median(eo), mean: mean(eo), min: Math.min(...eo), max: Math.max(...eo) },
      tooExpensive: { median: median(te), mean: mean(te), min: Math.min(...te), max: Math.max(...te) },
    };
  }, [responses]);

  const freeTexts = useMemo(
    () => responses.filter((r) => r.freeText),
    [responses],
  );

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(responses.length / PAGE_SIZE));
  const paginatedResponses = useMemo(
    () => responses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [responses, currentPage],
  );

  const count = responses.length;
  const progressPct = Math.min((count / TARGET_RESPONSES) * 100, 100);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-base">
              Survey Pricing (Van Westendorp)
            </CardTitle>
          </div>
          {count > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(responses)}
            >
              <Download className="h-4 w-4 mr-1" />
              Esporta CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {count}/{TARGET_RESPONSES} risposte
            </span>
            {count >= TARGET_RESPONSES ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                Obiettivo raggiunto
              </Badge>
            ) : (
              <span className="text-muted-foreground">
                Mancano {TARGET_RESPONSES - count} risposte
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Stats table */}
        {stats && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metrica</TableHead>
                  <TableHead className="text-right">Mediana</TableHead>
                  <TableHead className="text-right">Media</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  ["Troppo economico", stats.tooCheap],
                  ["Buon affare", stats.goodValue],
                  ["Caro ma ok", stats.expensiveOk],
                  ["Troppo caro", stats.tooExpensive],
                ] as const).map(([label, s]) => (
                  <TableRow key={label}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.median.toFixed(0)}€</TableCell>
                    <TableCell className="text-right tabular-nums">{s.mean.toFixed(0)}€</TableCell>
                    <TableCell className="text-right tabular-nums">{s.min}€</TableCell>
                    <TableCell className="text-right tabular-nums">{s.max}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Respondent list */}
        {count > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Rispondenti</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice Utente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Troppo eco.</TableHead>
                    <TableHead className="text-right">Buon aff.</TableHead>
                    <TableHead className="text-right">Caro ok</TableHead>
                    <TableHead className="text-right">Troppo caro</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedResponses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.userCode}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.tooCheap}€</TableCell>
                      <TableCell className="text-right tabular-nums">{r.goodValue}€</TableCell>
                      <TableCell className="text-right tabular-nums">{r.expensiveOk}€</TableCell>
                      <TableCell className="text-right tabular-nums">{r.tooExpensive}€</TableCell>
                      <TableCell className="max-w-[150px]">
                        {r.freeText ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground truncate block cursor-help">
                                  {r.freeText.length > 50
                                    ? r.freeText.slice(0, 50) + "..."
                                    : r.freeText}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p className="text-xs whitespace-pre-wrap">{r.freeText}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Pagina {currentPage} di {totalPages} ({count} rispondenti totali)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                  >
                    Precedente
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Successiva
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Free-text full list */}
        {freeTexts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Commenti completi</h4>
            <div className="space-y-2">
              {freeTexts.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border bg-muted/30 p-3 space-y-1"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{r.userCode}</span>
                    <span>·</span>
                    <span>{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.freeText}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {count === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessuna risposta ricevuta ancora.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
