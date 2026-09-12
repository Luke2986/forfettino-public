import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TrendData } from "@/hooks/useAdminStats";
import { calcChange } from "./adminActivityUtils";

type Granularity = "daily" | "weekly" | "monthly";

interface AdminActivityChartProps {
  title: string;
  description: string;
  data: TrendData;
  chartType: "bar" | "area";
  color: string;
  dataLabel: string;
  defaultGranularity?: Granularity;
}

export function AdminActivityChart({
  title,
  description,
  data,
  chartType,
  color,
  dataLabel,
  defaultGranularity = "monthly",
}: AdminActivityChartProps) {
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);
  // Fix M-3: unique SVG gradient id per chart instance
  const gradientId = useMemo(() => `areaGradient-${title.replace(/\s+/g, "-")}`, [title]);

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      value: {
        label: dataLabel,
        color,
      },
    }),
    [dataLabel, color]
  );

  const { chartData, xKey, hasData, trend } = useMemo(() => {
    const source =
      granularity === "daily"
        ? data.daily
        : granularity === "weekly"
          ? data.weekly
          : data.monthly;

    const key =
      granularity === "daily"
        ? "date"
        : granularity === "weekly"
          ? "week"
          : "month";

    const mapped = source.map((d) => ({
      label: d[key as keyof typeof d] as string,
      value: d.count,
    }));

    const any = mapped.some((d) => d.value > 0);
    const last = mapped[mapped.length - 1]?.value ?? 0;
    const prev = mapped[mapped.length - 2]?.value ?? 0;

    return {
      chartData: mapped,
      xKey: "label",
      hasData: any,
      trend: calcChange(last, prev),
    };
  }, [data, granularity]);

  const granularityLabel =
    granularity === "daily"
      ? "Ultimi 30 giorni"
      : granularity === "weekly"
        ? "Ultime 12 settimane"
        : "Ultimi 12 mesi";

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Dati in raccolta</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{granularityLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {trend !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm font-medium ${trend > 0 ? "text-green-600" : "text-red-600"}`}
              >
                <TrendingUp
                  className={`h-4 w-4 ${trend < 0 ? "rotate-180" : ""}`}
                />
                {trend > 0 ? "+" : ""}
                {trend}%
              </div>
            )}
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={`${title}: ${granularityLabel}`}>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          {chartType === "bar" ? (
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value} ${dataLabel.toLowerCase()}`}
                  />
                }
              />
              <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value} ${dataLabel.toLowerCase()}`}
                  />
                }
              />
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                dataKey="value"
                type="monotone"
                fill={`url(#${gradientId})`}
                stroke="var(--color-value)"
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ChartContainer>

        {/* Accessible data table alternative (WCAG 1.1.1) */}
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Visualizza dati numerici
          </summary>
          <table className="w-full text-xs mt-2 border-collapse">
            <caption className="sr-only">{title} — {granularityLabel}</caption>
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 pr-2 font-medium">Periodo</th>
                <th className="text-right py-1 pl-2 font-medium">{dataLabel}</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.label} className="border-b border-muted">
                  <td className="py-1 pr-2">{d.label}</td>
                  <td className="py-1 pl-2 text-right tabular-nums">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        </div>
      </CardContent>
    </Card>
  );
}

function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  const options: { key: Granularity; label: string; fullLabel: string }[] = [
    { key: "daily", label: "G", fullLabel: "Giornaliero" },
    { key: "weekly", label: "S", fullLabel: "Settimanale" },
    { key: "monthly", label: "M", fullLabel: "Mensile" },
  ];

  return (
    <div className="flex gap-1" role="group" aria-label="Granularità">
      {options.map((o) => (
        <Button
          key={o.key}
          variant={value === o.key ? "default" : "outline"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          aria-label={o.fullLabel}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
