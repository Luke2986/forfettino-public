import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SignupData {
  month: string;
  count: number;
}

interface AdminSignupChartProps {
  data: SignupData[];
}

export function AdminSignupChart({ data }: AdminSignupChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      signups: {
        label: "Nuovi Utenti",
        color: "hsl(var(--chart-1))",
      },
    }),
    []
  );

  const chartData = useMemo(
    () => data.map((d) => ({ month: d.month, signups: d.count })),
    [data]
  );

  // Calculate trend
  const currentMonth = data[data.length - 1]?.count || 0;
  const previousMonth = data[data.length - 2]?.count || 0;
  const trend = previousMonth > 0 
    ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100) 
    : currentMonth > 0 ? 100 : 0;

  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trend Registrazioni</CardTitle>
          <CardDescription>Ultimi 6 mesi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
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
            <CardTitle className="text-lg">Trend Registrazioni</CardTitle>
            <CardDescription>Ultimi 6 mesi</CardDescription>
          </div>
          {trend !== 0 && (
            <div className={`flex items-center gap-1 text-sm font-medium ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
              <TrendingUp className={`h-4 w-4 ${trend < 0 ? "rotate-180" : ""}`} />
              {trend > 0 ? "+" : ""}{trend}%
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `${value} registrazioni`}
                />
              }
            />
            <Bar dataKey="signups" fill="var(--color-signups)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
