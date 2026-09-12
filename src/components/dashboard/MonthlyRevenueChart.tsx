import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

// === TIPI ===

interface Receipt {
  receipt_date: string;
  gross_amount: number;
}

interface MonthlyRevenueChartProps {
  /** Incassi dell'anno selezionato */
  currentYearReceipts: Receipt[];
  /** Incassi dell'anno precedente (per confronto) */
  previousYearReceipts: Receipt[];
  /** Anno fiscale selezionato */
  currentYear: number;
  /** Compact mode: shorter height, no YAxis, legend as text above chart (Epic 13) */
  compact?: boolean;
}

// === COSTANTI ===

const MONTHS_IT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

// === HELPER ===

/**
 * Raggruppa i receipts per mese e restituisce un array di 12 totali mensili.
 */
function groupByMonth(receipts: Receipt[]): number[] {
  const monthly = new Array(12).fill(0);
  for (const r of receipts) {
    const month = new Date(r.receipt_date + "T00:00:00").getMonth(); // 0-11
    monthly[month] += Number(r.gross_amount) || 0;
  }
  return monthly.map((v) => Math.round(v * 100) / 100);
}

// === COMPONENTE ===

export function MonthlyRevenueChart({
  currentYearReceipts,
  previousYearReceipts,
  currentYear,
  compact = false,
}: MonthlyRevenueChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      current: {
        label: `${currentYear}`,
        color: "hsl(var(--v2-text-primary))",
      },
      previous: {
        label: `${currentYear - 1}`,
        color: "hsl(var(--v2-border-subtle))",
      },
    }),
    [currentYear]
  );

  const monthlyData = useMemo(() => {
    const currentMonthly = groupByMonth(currentYearReceipts);
    const previousMonthly = groupByMonth(previousYearReceipts);

    return MONTHS_IT.map((month, i) => ({
      month,
      current: currentMonthly[i],
      previous: previousMonthly[i],
    }));
  }, [currentYearReceipts, previousYearReceipts]);

  // Check se ci sono dati
  const hasData =
    currentYearReceipts.length > 0 || previousYearReceipts.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          Nessun incasso registrato
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Gli incassi appariranno qui mese per mese
        </p>
      </div>
    );
  }

  return (
    <div role="img" aria-label={`Grafico incassi mensili ${currentYear} confronto con ${currentYear - 1}`}>
      {/* Compact mode: legend as text row above chart */}
      {compact && (
        <div className="flex items-center gap-x-4 gap-y-1 mb-1 px-1 flex-wrap">
          <span className="text-sm font-medium text-slate-600">Incassi Mensili</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: "hsl(var(--v2-text-primary))" }} />
            {currentYear}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-2 w-4 rounded-sm border border-dashed" style={{ borderColor: "hsl(var(--v2-border-subtle))" }} />
            {currentYear - 1}
          </span>
        </div>
      )}
      <ChartContainer config={chartConfig} className={compact ? "h-[180px] w-full" : "h-[300px] w-full"}>
        <AreaChart data={monthlyData} accessibilityLayer>
          <defs>
            <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-current)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-current)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillPrevious" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-previous)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--color-previous)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          {!compact && (
            <YAxis
              tickLine={false}
              axisLine={false}
              width={50}
              fontSize={12}
              tickFormatter={(value) =>
                value >= 1000
                  ? `€${(value / 1000).toFixed(0)}k`
                  : `€${value}`
              }
            />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  new Intl.NumberFormat("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  }).format(value as number)
                }
              />
            }
          />
          {!compact && <ChartLegend content={<ChartLegendContent />} />}
          <Area
            dataKey="previous"
            type="monotone"
            fill="url(#fillPrevious)"
            stroke="var(--color-previous)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
          <Area
            dataKey="current"
            type="monotone"
            fill="url(#fillCurrent)"
            stroke="var(--color-current)"
            strokeWidth={2}
            dot={compact ? false : { r: 3, fill: "var(--color-current)" }}
            activeDot={{ r: compact ? 3 : 5 }}
          />
        </AreaChart>
      </ChartContainer>

      {/* Accessible data table alternative (WCAG 1.1.1) */}
      <details className="mt-2">
        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
          Visualizza dati numerici
        </summary>
        <table className="w-full text-xs mt-2 border-collapse">
          <caption className="sr-only">Dati incassi mensili {currentYear} e {currentYear - 1}</caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1 pr-2 font-medium text-slate-600">Mese</th>
              <th className="text-right py-1 px-2 font-medium text-slate-600">{currentYear}</th>
              <th className="text-right py-1 pl-2 font-medium text-slate-600">{currentYear - 1}</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((d) => (
              <tr key={d.month} className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-700">{d.month}</td>
                <td className="py-1 px-2 text-right tabular-nums">{d.current > 0 ? `€ ${d.current.toLocaleString("it-IT")}` : "—"}</td>
                <td className="py-1 pl-2 text-right tabular-nums">{d.previous > 0 ? `€ ${d.previous.toLocaleString("it-IT")}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
