import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { MoreVertical, Pencil, Trash2, Eye, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallmentProgressBar } from "./InstallmentProgressBar";
import type { InstallmentPlanWithProgress } from "@/hooks/useInstallmentPlans";

interface InstallmentPlanCardProps {
  plan: InstallmentPlanWithProgress;
  onViewDetail: (plan: InstallmentPlanWithProgress) => void;
  onRegisterPayment: (plan: InstallmentPlanWithProgress) => void;
  onEdit: (plan: InstallmentPlanWithProgress) => void;
  onDelete: (plan: InstallmentPlanWithProgress) => void;
}

/** Logica condizionale delle azioni card — esportata per testabilità */
export function deriveCardActions(plan: InstallmentPlanWithProgress) {
  const isActive = plan.status === "in_corso";
  return {
    isActive,
    canEdit: isActive,
    canDelete: plan.paidCount === 0,
    hasResiduo: plan.residuo > 0,
  };
}

export function InstallmentPlanCard({
  plan,
  onViewDetail,
  onRegisterPayment,
  onEdit,
  onDelete,
}: InstallmentPlanCardProps) {
  const { isActive, canEdit, canDelete, hasResiduo } = deriveCardActions(plan);

  const nextDeadlineDate = plan.nextDeadline
    ? new Date(plan.nextDeadline.due_date + "T00:00:00").toLocaleDateString("it-IT")
    : null;

  return (
    <div
      data-testid={`plan-card-${plan.id}`}
      className={cn(
        "rounded-lg p-4 space-y-3 border",
        isActive
          ? "border-l-4 border-info bg-info-muted"
          : "border-muted bg-muted/20 opacity-70"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {plan.client_name || "Incasso a rate"}
            </span>
            <Badge
              className={cn(
                "text-xs",
                isActive
                  ? "bg-info-muted text-info"
                  : "bg-success-muted text-success"
              )}
            >
              {isActive ? "In corso" : "Completato"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {plan.description && (
              <span className="truncate max-w-[200px]">{plan.description}</span>
            )}
            <span>
              {new Date(plan.start_date + "T00:00:00").toLocaleDateString("it-IT")}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="font-semibold whitespace-nowrap tabular-nums">
            {formatCurrency(plan.total_amount)}
          </div>
          {plan.paidCount > 0 && (
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {plan.paidCount}/{plan.totalCount} rate pagate
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-w-[44px] min-h-[44px]"
              aria-label={`Azioni per piano ${plan.client_name || "senza nome"}`}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetail(plan)}>
              <Eye className="mr-2 h-4 w-4" />
              Vedi dettaglio
            </DropdownMenuItem>
            {hasResiduo && (
              <DropdownMenuItem onClick={() => onRegisterPayment(plan)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Registra pagamento
              </DropdownMenuItem>
            )}
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(plan)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifica
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(plan)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Elimina
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress bar */}
      {plan.paidCount > 0 && (
        <InstallmentProgressBar
          totalAmount={plan.total_amount}
          collectedAmount={plan.totalPaid}
          compact
        />
      )}

      {/* Next deadline hint */}
      {nextDeadlineDate && isActive && (
        <p className="text-xs text-muted-foreground">
          Prossima rata: {nextDeadlineDate} — {formatCurrency(plan.nextDeadline!.expected_amount)}
        </p>
      )}
    </div>
  );
}
