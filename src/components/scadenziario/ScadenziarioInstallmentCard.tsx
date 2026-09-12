import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { formatDateIT, daysUntil } from "@/lib/schedule-helpers";
import type { InstallmentDeadlineRow, InstallmentPlanRow } from "@/hooks/useInstallmentPlans";

interface ScadenziarioInstallmentCardProps {
  deadline: InstallmentDeadlineRow & { plan: InstallmentPlanRow };
  onRegisterPayment?: (deadline: InstallmentDeadlineRow & { plan: InstallmentPlanRow }) => void;
}

export function ScadenziarioInstallmentCard({
  deadline,
  onRegisterPayment,
}: ScadenziarioInstallmentCardProps) {
  const days = daysUntil(deadline.due_date);
  const isOverdue = days < 0;
  const isSoon = days >= 0 && days <= 7;

  return (
    <Card
      className="border-info-muted bg-info-muted"
      data-testid={`installment-deadline-${deadline.id}`}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-info-muted p-2 shrink-0">
              <Wallet className="h-4 w-4 text-info" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {deadline.label}
                </span>
                <Badge className="bg-info-muted text-info text-xs">
                  Rata cliente
                </Badge>
                {isOverdue && (
                  <Badge className="bg-destructive-muted text-destructive text-xs">
                    Scaduta
                  </Badge>
                )}
                {isSoon && !isOverdue && (
                  <Badge className="bg-warning-muted text-warning text-xs">
                    {days === 0 ? "Oggi" : `Tra ${days} giorni`}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {deadline.plan.client_name || "Incasso a rate"} — Scadenza: {formatDateIT(deadline.due_date)}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold text-info tabular-nums">
              {formatCurrency(deadline.expected_amount)}
            </div>
          </div>
        </div>
        {onRegisterPayment && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full gap-2 border-info-muted text-info hover:bg-info-muted"
            onClick={() => onRegisterPayment(deadline)}
          >
            <CreditCard className="h-4 w-4" />
            Registra pagamento
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
