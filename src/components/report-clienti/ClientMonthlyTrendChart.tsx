import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useClientMonthlyTrend, type ClientMonthlyData } from "@/hooks/useClientMonthlyTrend";
import { formatCurrency } from "@/lib/money";

const MONTHS_IT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

interface TrendBarData {
  month: string;
  monthNum: number;
  current?: number;
  previous?: number;
}

interface ClientMonthlyTrendChartProps {
  clientId: string | null;
  clientName: string;
  fiscalYear: number;
}

/** @internal Exported for testing */
export function buildTrendData(
  currentData: ClientMonthlyData[],
  previousData: ClientMonthlyData[] | undefined,
): TrendBarData[] {
  return MONTHS_IT.map((month, i) => {
    const monthNum = i + 1;
    const curr = currentData.find((d) => d.month === monthNum);
    const prev = previousData?.find((d) => d.month === monthNum);
    if (!curr && !prev) return null;
    return {
      month,
      monthNum,
      current: curr?.grossAmount,
      previous: prev?.grossAmount,
    };
  }).filter(Boolean) as TrendBarData[];
}

/** @internal Exported for testing */
export function TrendTooltipContent({
  active,
  payload,
  label,
  fiscalYear,
  showPreviousYear,
}: any) {
  if (!active || !payload?.length) return null;

  const current = payload.find((p: any) => p.dataKey === "current")?.value;
  const previous = payload.find((p: any) => p.dataKey === "previous")?.value;

  let deltaText = "";
  if (showPreviousYear && current != null && previous != null && previous > 0) {
    const delta = ((current - previous) / previous) * 100;
    deltaText = `Delta ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
  } else if (showPreviousYear && current != null && current > 0 && previous == null) {
    deltaText = "Nuovo";
  } else if (showPreviousYear && current == null && previous != null && previous > 0) {
    deltaText = "Delta -100%";
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <p className="font-semibold text-slate-900">{label}</p>
      {current != null && (
        <p className="text-teal-600">
          {fiscalYear}: {formatCurrency(current)}
        </p>
      )}
      {showPreviousYear && previous != null && (
        <p className="text-slate-500">
          {fiscalYear - 1}: {formatCurrency(previous)}
        </p>
      )}
      {deltaText && (
        <p className="text-slate-700 font-medium mt-1">{deltaText}</p>
      )}
    </div>
  );
}

export function ClientMonthlyTrendChart({
  clientId,
  clientName,
  fiscalYear,
}: ClientMonthlyTrendChartProps) {
  const [showPreviousYear, setShowPreviousYear] = useState(false);

  const { data: currentData, isLoading: currentLoading } =
    useClientMonthlyTrend(fiscalYear, clientId);

  const { data: previousData, isLoading: previousLoading } =
    useClientMonthlyTrend(
      fiscalYear - 1,
      showPreviousYear ? clientId : undefined,
    );

  const isLoading = currentLoading || (showPreviousYear && previousLoading);

  const trendData = useMemo(
    () => buildTrendData(currentData ?? [], showPreviousYear ? previousData : undefined),
    [currentData, previousData, showPreviousYear],
  );

  const currentMonth = new Date().getMonth() + 1;

  if (isLoading) {
    return (
      <div data-testid="trend-loading" className="flex items-center justify-center h-[200px]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  if (!currentData?.length && !previousData?.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
        Nessun dato disponibile per {clientName}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle YoY */}
      <div className="flex items-center gap-2">
        <Switch
          id={`yoy-toggle-${clientId ?? "null"}`}
          checked={showPreviousYear}
          onCheckedChange={setShowPreviousYear}
        />
        <Label
          htmlFor={`yoy-toggle-${clientId ?? "null"}`}
          className="text-sm text-slate-600 cursor-pointer"
        >
          Confronta con {fiscalYear - 1}
        </Label>
      </div>

      {/* Bar Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
            width={45}
          />
          <Tooltip
            content={
              <TrendTooltipContent
                fiscalYear={fiscalYear}
                showPreviousYear={showPreviousYear}
              />
            }
          />
          <Bar dataKey="current" radius={[4, 4, 0, 0]}>
            {trendData.map((entry, index) => (
              <Cell
                key={index}
                fill="#14b8a6"
                stroke={entry.monthNum === currentMonth ? "#0d9488" : "none"}
                strokeWidth={entry.monthNum === currentMonth ? 2 : 0}
              />
            ))}
          </Bar>
          {showPreviousYear && (
            <Bar dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
