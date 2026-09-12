import { Progress } from "@/components/ui/progress";
import { countInpsFixedRates } from "@/lib/schedule-helpers";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

interface InpsFixedRatesProgressProps {
  schedules: TaxScheduleRow[];
}

export function InpsFixedRatesProgress({ schedules }: InpsFixedRatesProgressProps) {
  const { total, paid } = countInpsFixedRates(schedules);

  if (total === 0) return null;

  const percentage = (paid / total) * 100;

  return (
    <div className="space-y-1.5" data-testid="inps-fixed-progress">
      <div className="flex justify-between text-sm">
        <span className="font-medium">Rate INPS fisse</span>
        <span className="text-muted-foreground">
          {paid} su {total} rate pagate
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-2"
        role="progressbar"
        aria-valuenow={paid}
        aria-valuemax={total}
        aria-label="Copertura rate INPS fisse"
      />
    </div>
  );
}
