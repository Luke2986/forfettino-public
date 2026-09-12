import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import { bucketToLabel, formatDateIT } from "@/lib/schedule-helpers";
import type { Database } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

interface UnpaidSchedulesSummaryProps {
  schedules: TaxScheduleRow[];
  className?: string;
}

export function UnpaidSchedulesSummary({
  schedules,
  className,
}: UnpaidSchedulesSummaryProps) {
  const navigate = useNavigate();

  if (schedules.length === 0) return null;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Scadenze Passate Non Pagate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center justify-between text-sm"
            >
              <dt className="text-muted-foreground">
                {formatDateIT(schedule.due_date)} — {bucketToLabel(schedule.bucket, schedule.due_date)}
              </dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(schedule.total_expected)}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-muted-foreground italic pt-2">
          Questi importi potrebbero differire da quanto già concordato col tuo
          commercialista
        </p>

        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => {
            track("unpaid_summary_cta_click", { count: schedules.length });
            navigate("/scadenziario");
          }}
        >
          Vai allo Scadenziario →
        </Button>
      </CardContent>
    </Card>
  );
}
