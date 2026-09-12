import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CTAAnalyticsData } from "@/hooks/useAdminStats";

interface AdminCTAAnalyticsProps {
  data: CTAAnalyticsData[];
}

export function AdminCTAAnalytics({ data }: AdminCTAAnalyticsProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Funnel CTA
          </CardTitle>
          <CardDescription>Click e completamenti — ultimi 30 giorni</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessun dato CTA disponibile
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Funnel CTA
        </CardTitle>
        <CardDescription>
          Click e completamenti — ultimi 30 giorni
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption className="sr-only">Analisi CTA: click e completamenti</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Metrica</TableHead>
              <TableHead className="text-right">Oggi</TableHead>
              <TableHead className="text-right">7gg</TableHead>
              <TableHead className="text-right">30gg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.metricLabel}>
                <TableCell className="text-sm">{row.metricLabel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.today}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.week}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.month}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
