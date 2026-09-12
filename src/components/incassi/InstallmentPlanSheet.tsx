import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { InstallmentProgressBar } from "./InstallmentProgressBar";
import { InstallmentDeadlineItem } from "./InstallmentDeadlineItem";
import { cn } from "@/lib/utils";
import type { InstallmentPlanWithProgress } from "@/hooks/useInstallmentPlans";

interface InstallmentPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: InstallmentPlanWithProgress | null;
  onRegisterPayment: (plan: InstallmentPlanWithProgress) => void;
}

export function InstallmentPlanSheet({
  open,
  onOpenChange,
  plan,
  onRegisterPayment,
}: InstallmentPlanSheetProps) {
  if (!plan) return null;

  const isActive = plan.status === "in_corso";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {plan.client_name || "Dettaglio incasso a rate"}
          </SheetTitle>
          <SheetDescription>
            <span>Dettaglio piano rate — <span className="tabular-nums">{formatCurrency(plan.total_amount)}</span></span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Riepilogo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  isActive
                    ? "bg-info-muted text-info"
                    : "bg-success-muted text-success"
                )}
              >
                {isActive ? "In corso" : "Completato"}
              </Badge>
            </div>
            {plan.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">Descrizione: </span>
                <span>{plan.description}</span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Importo totale: </span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(plan.total_amount)}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Data inizio: </span>
              <span>
                {new Date(plan.start_date + "T00:00:00").toLocaleDateString("it-IT")}
              </span>
            </div>
            {plan.residuo > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Residuo: </span>
                <span className="font-semibold text-info tabular-nums">
                  {formatCurrency(plan.residuo)}
                </span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {plan.paidCount > 0 && (
            <InstallmentProgressBar
              totalAmount={plan.total_amount}
              collectedAmount={plan.totalPaid}
            />
          )}

          {/* Scadenze rate */}
          {plan.deadlines.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Scadenze rate</h4>
              <div className="space-y-2">
                {plan.deadlines.map((dl) => (
                  <InstallmentDeadlineItem key={dl.id} deadline={dl} />
                ))}
              </div>
            </div>
          )}

          {plan.deadlines.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Nessuna rata definita. Registra i pagamenti man mano che arrivano.
            </div>
          )}

          {/* Bottone registra pagamento */}
          {plan.residuo > 0 && (
            <Button
              onClick={() => onRegisterPayment(plan)}
              className="w-full min-h-[44px]"
              data-testid="detail-register-payment"
            >
              Registra pagamento
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
