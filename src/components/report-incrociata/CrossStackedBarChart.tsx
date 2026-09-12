/**
 * Story 55.4 — Stacked bar chart: fatturato per cliente, stack per servizio.
 * Toggle Tabella/Grafico. Recharts BarChart stacked.
 */

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CrossAnalysisData } from "@/hooks/useCrossAnalysis";
import { formatCurrency } from "@/lib/money";
import { capitalizeFirst } from "@/lib/string-utils";

interface Props {
  data: CrossAnalysisData;
}

export function CrossStackedBarChart({ data }: Props) {
  const { clients, categories, matrix } = data;

  const chartData = useMemo(() => {
    // Limit to top 10 clients
    const topClients = clients.slice(0, 10);
    return topClients.map((c) => {
      const ck = c.id ?? "__null__";
      const name = capitalizeFirst(c.name);
      const entry: Record<string, string | number> = {
        clientName: name.length > 12 ? name.slice(0, 12) + "…" : name,
        clientNameFull: name,
      };
      for (const cat of categories) {
        const catk = cat.id ?? "__null__";
        entry[catk] = matrix.get(ck)?.get(catk)?.totalGross ?? 0;
      }
      return entry;
    });
  }, [clients, categories, matrix]);

  if (chartData.length === 0) return null;

  return (
    <div>
      {clients.length > 10 && (
        <p className="text-sm text-slate-500 mb-3">
          Mostra solo i primi 10 clienti per fatturato
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="clientName"
            tick={{ fontSize: 12, fill: "#64748b" }}
            interval={0}
            angle={chartData.length > 5 ? -25 : 0}
            textAnchor={chartData.length > 5 ? "end" : "middle"}
            height={chartData.length > 5 ? 60 : 30}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
            width={50}
            allowDecimals={false}
            domain={[0, "auto"]}
            tickCount={5}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const cat = categories.find(
                (c) => (c.id ?? "__null__") === name,
              );
              return [formatCurrency(value), cat?.name ?? name];
            }}
            labelFormatter={(label: string) => {
              const item = chartData.find((d) => d.clientName === label);
              return (item?.clientNameFull as string) ?? label;
            }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend
            formatter={(value: string) => {
              const cat = categories.find(
                (c) => (c.id ?? "__null__") === value,
              );
              return cat?.name ?? value;
            }}
            wrapperStyle={{ fontSize: "12px" }}
          />
          {categories.map((cat) => (
            <Bar
              key={cat.id ?? "__null__"}
              dataKey={cat.id ?? "__null__"}
              stackId="a"
              fill={cat.color}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
