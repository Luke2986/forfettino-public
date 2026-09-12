import { useState, useMemo } from "react";
import { Timer, Clock, TrendingUp, ChevronDown, AlertTriangle, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminStatCard } from "./AdminStatCard";
import { useAdminTTVStats } from "@/hooks/useAdminTTVStats";
import { formatTTV } from "./formatTTV";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "7gg" },
  { value: "30d", label: "30gg" },
  { value: "90d", label: "90gg" },
  { value: "all", label: "Tutto" },
];

const GESTIONE_COLORS: Record<string, string> = {
  separata: "bg-blue-500",
  artigiani: "bg-amber-500",
  commercianti: "bg-violet-500",
};

const GESTIONE_LABELS: Record<string, string> = {
  separata: "Separata",
  artigiani: "Artigiani",
  commercianti: "Commercianti",
};

// --- Verdict badges: soglie per capire a colpo d'occhio se va bene o male ---

type Verdict = { label: string; className: string };

function medianVerdict(minutes: number): Verdict {
  if (minutes < 10) return { label: "Ottimo", className: "bg-emerald-100 text-emerald-700" };
  if (minutes < 60) return { label: "Buono", className: "bg-teal-100 text-teal-700" };
  if (minutes < 1440) return { label: "Da migliorare", className: "bg-amber-100 text-amber-700" };
  return { label: "Critico", className: "bg-red-100 text-red-700" };
}

function p90Verdict(minutes: number): Verdict {
  if (minutes < 1440) return { label: "Ottimo", className: "bg-emerald-100 text-emerald-700" };
  if (minutes < 4320) return { label: "Buono", className: "bg-teal-100 text-teal-700" };
  if (minutes < 10080) return { label: "Da migliorare", className: "bg-amber-100 text-amber-700" };
  return { label: "Critico", className: "bg-red-100 text-red-700" };
}

function activationVerdict(rate: number): Verdict {
  if (rate >= 70) return { label: "Ottimo", className: "bg-emerald-100 text-emerald-700" };
  if (rate >= 50) return { label: "Da migliorare", className: "bg-amber-100 text-amber-700" };
  return { label: "Critico", className: "bg-red-100 text-red-700" };
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", verdict.className)}>
      {verdict.label}
    </span>
  );
}

const chartConfig: ChartConfig = {
  value: {
    label: "TTV Median",
    color: "hsl(var(--chart-1))",
  },
};

const VARIANT_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "control", label: "Control" },
  { value: "short", label: "Short" },
];

export function AdminTTVWidget() {
  const [range, setRange] = useState<Range>("30d");
  const [variant, setVariant] = useState<string>("all");
  const variantFilter = variant === "all" ? null : variant;
  const { data, isLoading, isError, refetch } = useAdminTTVStats(range, variantFilter);
  const [gestioneOpen, setGestioneOpen] = useState<boolean | null>(null);

  // Default open if totalActivated >= 20, closed otherwise
  const isGestioneExpanded = gestioneOpen ?? (data ? data.totalActivated >= 20 : false);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dailyTrend.map((d) => ({
      label: formatDayLabel(d.day),
      value: d.medianMinutes,
      activatedCount: d.activatedCount,
      raw: d.day,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Time To Value</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Filtro variant A/B">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RangeSelector value={range} onChange={setRange} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-[180px]" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Time To Value</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Filtro variant A/B">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RangeSelector value={range} onChange={setRange} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Impossibile caricare le metriche TTV
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalActivated === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Time To Value</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Filtro variant A/B">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RangeSelector value={range} onChange={setRange} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Timer className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessuna attivazione nel periodo selezionato
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Time To Value</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={variant} onValueChange={setVariant}>
              <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Filtro variant A/B">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RangeSelector value={range} onChange={setRange} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <AdminStatCard
            icon={<Timer className="h-5 w-5 text-teal-500" />}
            iconClassName="bg-teal-500/10"
            label="TTV Median"
            value={formatTTV(data.medianMinutes)}
            subLabel={<span className="flex items-center gap-2">mediana <VerdictBadge verdict={medianVerdict(data.medianMinutes)} /></span>}
          />
          <AdminStatCard
            icon={<Clock className="h-5 w-5 text-teal-500" />}
            iconClassName="bg-teal-500/10"
            label="TTV P90"
            value={formatTTV(data.p90Minutes)}
            subLabel={<span className="flex items-center gap-2">90th percentile <VerdictBadge verdict={p90Verdict(data.p90Minutes)} /></span>}
          />
          <AdminStatCard
            icon={<TrendingUp className="h-5 w-5 text-teal-500" />}
            iconClassName="bg-teal-500/10"
            label="Activation Rate"
            value={`${data.activationRate.toFixed(1)}%`}
            subLabel={<span className="flex items-center gap-2 flex-wrap">{data.totalActivated} su {data.totalSignups} <VerdictBadge verdict={activationVerdict(data.activationRate)} /></span>}
          />
        </div>

        {/* Small sample warning */}
        {data.totalActivated < 10 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
            Campione ridotto ({data.totalActivated} utenti) — dati indicativi
          </div>
        )}

        {/* Breakdown per gestione — collapsible */}
        {data.byGestione.length > 0 && (
          <div>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setGestioneOpen(!isGestioneExpanded)}
              aria-expanded={isGestioneExpanded}
            >
              Breakdown per gestione
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isGestioneExpanded && "rotate-180",
                )}
              />
            </button>
            {isGestioneExpanded && (
              <dl className="mt-2 space-y-2">
                {data.byGestione.map((g) => (
                  <div
                    key={g.gestione}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        GESTIONE_COLORS[g.gestione] ?? "bg-slate-400",
                      )}
                      aria-hidden="true"
                    />
                    <dt className="font-medium min-w-[100px]">
                      {GESTIONE_LABELS[g.gestione] ?? g.gestione}
                    </dt>
                    <dd className="flex items-center gap-4 text-muted-foreground tabular-nums flex-wrap">
                      <span>median {formatTTV(g.medianMinutes)}</span>
                      <span>p90 {formatTTV(g.p90Minutes)}</span>
                      <span>{g.userCount} utenti</span>
                      <VerdictBadge verdict={p90Verdict(g.p90Minutes)} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {/* Mini line chart — daily trend */}
        {chartData.length > 0 && (
          <div role="img" aria-label="Andamento TTV giornaliero">
            <ChartContainer config={chartConfig} className="h-[180px] w-full">
              <AreaChart data={chartData} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  fontSize={11}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const payload = item?.payload;
                        const mins = typeof value === "number" ? formatTTV(value) : "—";
                        const count = payload?.activatedCount ?? 0;
                        return `${mins}, ${count} attivazioni`;
                      }}
                    />
                  }
                />
                <defs>
                  <linearGradient id="ttvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="url(#ttvGradient)"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  connectNulls={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Periodo">
      {RANGE_OPTIONS.map((o) => (
        <Button
          key={o.value}
          variant={value === o.value ? "default" : "outline"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function formatDayLabel(day: string): string {
  if (!day) return "";
  const parts = day.split("-");
  if (parts.length < 3) return day;
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10);
  const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${d} ${MONTHS[m - 1] ?? ""}`;
}
