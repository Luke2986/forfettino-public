import { useState, useMemo, useCallback } from "react";
import {
  Filter,
  Users,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  Bar,
  BarChart,
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
import {
  useAdminWizardFunnel,
  type Range,
  type FunnelStep,
} from "@/hooks/useAdminWizardFunnel";
import { cn } from "@/lib/utils";

// --- Step labels ---

const STEP_LABELS: Record<string, string> = {
  gestione: "Gestione INPS",
  annoIscrizione: "Anno Iscrizione",
  riduzione35: "Riduzione 35%",
  acconti: "Acconti Versati",
  profilo: "Profilo",
  datiFiscali: "Dati Fiscali",
  prudenza: "Saldo Prudenza",
  scadenze: "Scadenze",
  conferma: "Conferma",
};

function getStepLabel(stepId: string): string {
  return STEP_LABELS[stepId] ?? stepId;
}

// --- Range & Gestione options ---

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "7gg" },
  { value: "30d", label: "30gg" },
  { value: "90d", label: "90gg" },
  { value: "all", label: "Tutto" },
];

const GESTIONE_OPTIONS = [
  { value: "all", label: "Tutte" },
  { value: "separata", label: "Separata" },
  { value: "artigiani", label: "Artigiani" },
  { value: "commercianti", label: "Commercianti" },
];

// --- Bar color by drop-off severity ---

function barColor(dropOffRate: number): string {
  if (dropOffRate > 40) return "bg-red-500";
  if (dropOffRate > 20) return "bg-amber-500";
  return "bg-teal-500";
}

// --- Chart config for time per step ---

const timeChartConfig: ChartConfig = {
  avgSeconds: {
    label: "Media (s)",
    color: "hsl(var(--chart-1))",
  },
};

// --- Main Component ---

const VARIANT_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "control", label: "Control" },
  { value: "short", label: "Short" },
];

export function AdminWizardFunnel() {
  const [range, setRange] = useState<Range>("30d");
  const [gestione, setGestione] = useState<string>("all");
  const [variant, setVariant] = useState<string>("all");
  const gestioneFilter = gestione === "all" ? null : gestione;
  const variantFilter = variant === "all" ? null : variant;

  const { data, isLoading, isFetching, isError, refetch } =
    useAdminWizardFunnel(range, gestioneFilter, variantFilter);

  const isStale = isFetching && !isLoading;

  // Filter funnel steps for display: hide entered=0 when gestione filter active
  const visibleFunnel = useMemo(() => {
    if (!data) return [];
    if (gestioneFilter) {
      return data.funnel.filter((s) => s.entered > 0);
    }
    return data.funnel;
  }, [data, gestioneFilter]);

  const maxEntered = useMemo(
    () => Math.max(...visibleFunnel.map((s) => s.entered), 1),
    [visibleFunnel],
  );

  // Top 3 problematic steps (ADR-5: entered >= 3)
  const topDropOff = useMemo(() => {
    if (!data) return [];
    return [...data.funnel]
      .filter((s) => s.entered >= 3 && s.dropOffRate > 0)
      .sort((a, b) => b.dropOffRate - a.dropOffRate)
      .slice(0, 3);
  }, [data]);

  const smallSampleInTopDropOff = topDropOff.length > 0 && topDropOff.some((s) => s.entered < 10);

  // P3: memoized tooltip formatter to avoid BarChart re-renders
  const timeTooltipFormatter = useCallback(
    (_value: any, _name: any, item: any) => {
      const p = item?.payload;
      if (!p) return "";
      return `Media: ${p.avgSeconds}s | Mediana: ${p.medianSeconds}s | P90: ${p.p90Seconds}s`;
    },
    [],
  );

  // Time chart data
  const timeChartData = useMemo(() => {
    if (!data) return [];
    return data.timePerStep.map((t) => ({
      stepId: t.stepId,
      label: getStepLabel(t.stepId),
      avgSeconds: t.avgSeconds,
      medianSeconds: t.medianSeconds,
      p90Seconds: t.p90Seconds,
    }));
  }, [data]);

  // --- Filters header (shared across all states) ---
  const filtersHeader = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-lg">Wizard Funnel</CardTitle>
        {isStale && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2">
        <Select value={gestione} onValueChange={setGestione}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GESTIONE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
  );

  // --- Loading ---
  if (isLoading) {
    return (
      <Card>
        <CardHeader>{filtersHeader}</CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[180px]" />
        </CardContent>
      </Card>
    );
  }

  // --- Error ---
  if (isError) {
    return (
      <Card>
        <CardHeader>{filtersHeader}</CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Impossibile caricare i dati del funnel
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

  // --- Empty ---
  if (!data || data.summary.totalStarted === 0) {
    return (
      <Card>
        <CardHeader>{filtersHeader}</CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Filter className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessun dato wizard nel periodo selezionato
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">{filtersHeader}</CardHeader>
      <CardContent className={cn("space-y-6", isStale && "opacity-60 transition-opacity")}>
        {/* Summary stat cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <AdminStatCard
            icon={<Users className="h-5 w-5 text-teal-500" />}
            iconClassName="bg-teal-500/10"
            label="Avviati"
            value={data.summary.totalStarted}
          />
          <AdminStatCard
            icon={<CheckCircle className="h-5 w-5 text-teal-500" />}
            iconClassName="bg-teal-500/10"
            label="Completati"
            value={data.summary.totalCompleted}
          />
          <AdminStatCard
            icon={<TrendingUp className="h-5 w-5 text-teal-500" />}
            iconClassName="bg-teal-500/10"
            label="Completion Rate"
            value={`${data.summary.overallCompletionRate}%`}
            subLabel={
              data.summary.topDropOffStep
                ? `Collo di bottiglia: ${getStepLabel(data.summary.topDropOffStep)}`
                : data.summary.totalStarted > 0
                  ? "Campione insufficiente per collo di bottiglia"
                  : undefined
            }
          />
        </div>

        {/* Funnel visualization (ADR-2: Custom HTML) */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Funnel Step-by-Step</h3>
          <div className="space-y-2" role="img" aria-label="Wizard funnel visualization">
            {visibleFunnel.map((step) => (
              <FunnelBar key={step.stepId} step={step} maxEntered={maxEntered} />
            ))}
          </div>
        </div>

        {/* Top 3 problematic steps */}
        {topDropOff.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Top drop-off:</span>
            {topDropOff.map((s) => (
              <span
                key={s.stepId}
                className="bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-sm"
              >
                {getStepLabel(s.stepId)} ({s.dropOffRate}%)
              </span>
            ))}
            {smallSampleInTopDropOff && (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-sm">
                Campione ridotto
              </span>
            )}
          </div>
        )}

        {/* Time per step chart */}
        {timeChartData.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Tempo medio per step (secondi)
            </h3>
            <div role="img" aria-label="Tempo medio per step del wizard">
              <ChartContainer config={timeChartConfig} className="h-[180px] w-full">
                <BarChart data={timeChartData} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={timeTooltipFormatter} />
                    }
                  />
                  <Bar
                    dataKey="avgSeconds"
                    fill="var(--color-avgSeconds)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        )}

        {/* Abandonment distribution */}
        {data.abandonment.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Distribuzione Abbandoni
            </h3>
            <div className="space-y-2">
              {data.abandonment.map((a) => (
                <div key={a.lastStepId} className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                  <span className="font-medium min-w-[120px]">{getStepLabel(a.lastStepId)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {a.count} utenti ({a.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Funnel bar sub-component ---

function FunnelBar({ step, maxEntered }: { step: FunnelStep; maxEntered: number }) {
  const widthPct = maxEntered > 0 ? (step.entered / maxEntered) * 100 : 0;
  const completedPct = step.entered > 0 ? (step.completed / step.entered) * 100 : 0;

  if (step.entered === 0) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium min-w-[120px] text-muted-foreground">
          {getStepLabel(step.stepId)}
        </span>
        <span className="text-sm text-muted-foreground">0 utenti</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium min-w-[120px] shrink-0">
        {getStepLabel(step.stepId)}
      </span>
      <div className="flex-1 relative">
        <div
          className="h-8 bg-slate-100 rounded-md relative overflow-hidden"
          style={{ width: `${widthPct}%`, minWidth: "40px" }}
        >
          <div
            className={cn("h-full rounded-md transition-all", barColor(step.dropOffRate))}
            style={{ width: `${completedPct}%` }}
          />
        </div>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums shrink-0 min-w-[160px] text-right">
        {step.entered} → {step.completed} ({step.completionRate}%)
      </span>
    </div>
  );
}

// --- Range selector (same pattern as AdminTTVWidget) ---

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
