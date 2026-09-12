import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { Check, Clock } from "lucide-react";
import type { InstallmentDeadlineRow } from "@/hooks/useInstallmentPlans";

interface InstallmentDeadlineItemProps {
  deadline: InstallmentDeadlineRow;
}

export function InstallmentDeadlineItem({ deadline }: InstallmentDeadlineItemProps) {
  const dateStr = deadline.due_date
    ? new Date(deadline.due_date + "T00:00:00").toLocaleDateString("it-IT")
    : "Data non definita";

  return (
    <div
      className="flex items-center justify-between rounded-md border p-3 text-sm"
      data-testid={`deadline-${deadline.id}`}
    >
      <div className="flex items-center gap-3">
        {deadline.is_paid ? (
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="space-y-0.5">
          <div className="font-medium">{dateStr}</div>
          <div className="text-xs text-muted-foreground">{deadline.label}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">
          {formatCurrency(deadline.expected_amount)}
        </span>
        {deadline.is_paid ? (
          <Badge className="bg-emerald-100 text-emerald-800 text-xs">Pagata</Badge>
        ) : (
          <Badge variant="outline" className="text-xs">In attesa</Badge>
        )}
      </div>
    </div>
  );
}
