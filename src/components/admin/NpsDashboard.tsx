import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Download,
  MessageSquare,
  TrendingUp,
  ThumbsUp,
} from "lucide-react";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useNpsAnalytics, type NpsResponseRow } from "@/hooks/useNpsAnalytics";
import { TRIGGER_LABELS } from "@/lib/nps-constants";
import { csvSafe, downloadCsv } from "@/lib/csv-export";
import { formatDateIT } from "@/lib/schedule-helpers";

const PAGE_SIZE = 10;

type ScoreFilter = "all" | "promoters" | "passives" | "detractors";
type SortBy = "date_desc" | "date_asc" | "score_desc" | "score_asc";

const MONTH_LABELS: Record<string, string> = {
  "01": "Gen",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "Mag",
  "06": "Giu",
  "07": "Lug",
  "08": "Ago",
  "09": "Set",
  "10": "Ott",
  "11": "Nov",
  "12": "Dic",
};

function formatMonthLabel(ym: string): string {
  const [, m] = ym.split("-");
  return MONTH_LABELS[m] || m;
}


function npsColor(score: number): string {
  if (score < 0) return "text-red-600";
  if (score <= 30) return "text-amber-600";
  return "text-emerald-600";
}

function npsBgColor(score: number): string {
  if (score < 0) return "bg-red-50";
  if (score <= 30) return "bg-amber-50";
  return "bg-emerald-50";
}

function scoreBadgeClasses(score: number): string {
  if (score >= 9) return "bg-emerald-100 text-emerald-800";
  if (score >= 7) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function scoreCategory(score: number): string {
  if (score >= 9) return "Promotore";
  if (score >= 7) return "Passivo";
  return "Detrattore";
}

function matchesScoreFilter(score: number, filter: ScoreFilter): boolean {
  if (filter === "all") return true;
  if (filter === "promoters") return score >= 9;
  if (filter === "passives") return score >= 7 && score <= 8;
  return score <= 6;
}

function exportNpsCsv(responses: NpsResponseRow[]) {
  const header =
    "data,codice_utente,score,categoria,commento,trigger_source,campaign_id";
  const rows = responses.map((r) => {
    const date = formatDateIT(r.created_at);
    return [
      csvSafe(date),
      csvSafe(r.user_code),
      String(r.score),
      csvSafe(scoreCategory(r.score)),
      r.comment ? csvSafe(r.comment) : "",
      csvSafe(r.trigger_source || ""),
      csvSafe(r.campaign_id || ""),
    ].join(",");
  });
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, "0");
  const d = String(new Date().getDate()).padStart(2, "0");
  const filename = `nps_export_${y}-${m}-${d}.csv`;
  downloadCsv(header, rows, filename);
}

const chartConfig: ChartConfig = {
  npsScore: {
    label: "NPS Score",
    color: "hsl(var(--chart-1))",
  },
};

export function NpsDashboard() {
  const { responses, npsScore, breakdown, monthlyTrend, meanScore, isLoading } =
    useNpsAnalytics();

  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Unique trigger sources from data
  const triggerSources = useMemo(() => {
    const set = new Set<string>();
    for (const r of responses) {
      if (r.trigger_source) set.add(r.trigger_source);
    }
    return Array.from(set).sort();
  }, [responses]);

  // Filtered & sorted responses (for table only)
  const filteredResponses = useMemo(() => {
    let result = responses.filter((r) => matchesScoreFilter(r.score, scoreFilter));
    if (triggerFilter !== "all") {
      result = result.filter((r) => r.trigger_source === triggerFilter);
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return a.created_at.localeCompare(b.created_at);
        case "score_desc":
          return b.score - a.score;
        case "score_asc":
          return a.score - b.score;
        default: // date_desc
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return result;
  }, [responses, scoreFilter, triggerFilter, sortBy]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedResponses = useMemo(
    () =>
      filteredResponses.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
      ),
    [filteredResponses, safePage],
  );

  // Comments list
  const comments = useMemo(
    () => responses.filter((r) => r.comment),
    [responses],
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (responses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-teal-500" />
            <CardTitle className="text-base">Dashboard NPS Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <MessageSquare className="h-10 w-10 text-slate-500 mb-3" />
            <p className="text-sm font-medium text-slate-700">
              Nessuna risposta NPS ancora raccolta
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Configura la campagna NPS per iniziare a raccogliere feedback
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <BarChart3 className="h-5 w-5 text-teal-500" />
            <CardTitle className="text-base">Dashboard NPS Analytics</CardTitle>
            <Badge variant="outline" className="ml-1">
              {breakdown.total} risposte
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => exportNpsCsv(filteredResponses)}
          >
            <Download className="h-4 w-4 mr-1" />
            Esporta CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              <MessageSquare className="h-4 w-4" />
              Risposte Totali
            </div>
            <p className="text-2xl font-bold tabular-nums">{breakdown.total}</p>
          </div>
          <div className={`rounded-lg border p-4 space-y-1 ${npsBgColor(npsScore)}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              <TrendingUp className="h-4 w-4" />
              NPS Score
            </div>
            <p className={`text-2xl font-bold tabular-nums ${npsColor(npsScore)}`}>
              {npsScore > 0 ? "+" : ""}
              {npsScore}
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              <BarChart3 className="h-4 w-4" />
              Score Medio
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {responses.length > 0 ? meanScore.toFixed(1) : "—"}
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              <ThumbsUp className="h-4 w-4" />
              Promotori
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              {breakdown.promoters.pct}%
            </p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Breakdown</h4>
          {([
            ["Promotori (9-10)", breakdown.promoters, "bg-emerald-500"],
            ["Passivi (7-8)", breakdown.passives, "bg-amber-500"],
            ["Detrattori (0-6)", breakdown.detractors, "bg-red-500"],
          ] as const).map(([label, data, barColor]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-sm w-28 sm:w-32 shrink-0 truncate">{label}</span>
              <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all duration-500`}
                  style={{ width: `${data.pct}%` }}
                />
              </div>
              <span className="text-sm tabular-nums w-20 text-right">
                {data.count} ({data.pct}%)
              </span>
            </div>
          ))}
        </div>

        {/* Trend Chart */}
        {monthlyTrend.length >= 2 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Trend NPS Mensile</h4>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <LineChart
                data={monthlyTrend}
                accessibilityLayer
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatMonthLabel}
                />
                <YAxis
                  domain={[-100, 100]}
                  ticks={[-100, -50, 0, 50, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => (
                        <span>
                          NPS: {String(value)} ({item.payload.count} risposte)
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  dataKey="npsScore"
                  type="monotone"
                  stroke="var(--color-npsScore)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}

        {monthlyTrend.length < 2 && monthlyTrend.length > 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Dati insufficienti per il trend (servono almeno 2 mesi)
          </p>
        )}

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={scoreFilter}
            onValueChange={(v) => {
              setScoreFilter(v as ScoreFilter);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              <SelectItem value="promoters">Promotori (9-10)</SelectItem>
              <SelectItem value="passives">Passivi (7-8)</SelectItem>
              <SelectItem value="detractors">Detrattori (0-6)</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={triggerFilter}
            onValueChange={(v) => {
              setTriggerFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i trigger</SelectItem>
              {triggerSources.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRIGGER_LABELS[t] || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as SortBy);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Ordinamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Data (recenti)</SelectItem>
              <SelectItem value="date_asc">Data (meno recenti)</SelectItem>
              <SelectItem value="score_desc">Score (alto → basso)</SelectItem>
              <SelectItem value="score_asc">Score (basso → alto)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Responses table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Risposte{" "}
            {filteredResponses.length !== responses.length && (
              <span className="text-muted-foreground font-normal">
                ({filteredResponses.length} di {responses.length})
              </span>
            )}
          </h4>
          <TooltipProvider>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="hidden sm:table-cell">Codice Utente</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Trigger</TableHead>
                  <TableHead>Commento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResponses.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {formatDateIT(r.created_at)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">
                      {r.user_code}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={scoreBadgeClasses(r.score)}
                      >
                        {r.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {TRIGGER_LABELS[r.trigger_source] || r.trigger_source || "—"}
                    </TableCell>
                    <TableCell className="max-w-[120px] sm:max-w-[200px]">
                      {r.comment ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground truncate block cursor-help">
                              {r.comment.length > 80
                                ? r.comment.slice(0, 80) + "..."
                                : r.comment}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-xs whitespace-pre-wrap">
                              {r.comment}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedResponses.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-4"
                    >
                      Nessuna risposta per i filtri selezionati
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </TooltipProvider>

          {totalPages > 1 && (
            <div className="flex flex-col items-center sm:flex-row sm:justify-between gap-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Pagina {safePage} di {totalPages} ({filteredResponses.length}{" "}
                risposte filtrate)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Precedente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Successiva
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Comments full list */}
        {comments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Commenti dettagliati</h4>
            <div className="space-y-2">
              {comments.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border bg-muted/30 p-3 space-y-1"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{r.user_code}</span>
                    <span>·</span>
                    <span>{formatDateIT(r.created_at)}</span>
                    <span>·</span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${scoreBadgeClasses(r.score)}`}
                    >
                      {r.score}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
