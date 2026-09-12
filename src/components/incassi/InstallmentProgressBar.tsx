import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/hooks/useFiscalCalculations";

interface InstallmentProgressBarProps {
  totalAmount: number; // euro
  collectedAmount: number; // euro
  compact?: boolean;
}

export function InstallmentProgressBar({
  totalAmount,
  collectedAmount,
  compact = false,
}: InstallmentProgressBarProps) {
  const percent = totalAmount > 0
    ? Math.min(100, Math.round((collectedAmount / totalAmount) * 100))
    : 0;
  const isComplete = percent >= 100;

  return (
    <div className="w-full">
      <Progress
        value={percent}
        className="h-2 bg-muted [&>div]:!bg-blue-500"
        aria-label={`Incassato ${formatCurrency(collectedAmount)} su ${formatCurrency(totalAmount)}`}
      />
      {!compact && (
        <p className="text-xs text-muted-foreground mt-1">
          {formatCurrency(collectedAmount)} / {formatCurrency(totalAmount)} incassati
          {isComplete && (
            <span className="ml-2 text-blue-600 font-medium">Completato</span>
          )}
        </p>
      )}
    </div>
  );
}
