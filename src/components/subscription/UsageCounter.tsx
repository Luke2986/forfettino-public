import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt, FileUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageCounterProps {
  className?: string;
  /** Versione compatta senza card wrapper — per embedding dentro altri container */
  compact?: boolean;
}

export function UsageCounter({ className, compact }: UsageCounterProps) {
  const { isPro, isStudio, receiptsUsed, receiptsLimit, importsUsed, importsLimit } = useSubscription();

  // Don't show for paid plans (Pro or Studio)
  if (isPro || isStudio) return null;

  const content = (
    <div className="space-y-3">
      <UsageBar
        label="Incassi totali"
        icon={Receipt}
        used={receiptsUsed}
        limit={receiptsLimit}
      />
      <UsageBar
        label="Import XML"
        icon={FileUp}
        used={importsUsed}
        limit={importsLimit}
      />
    </div>
  );

  if (compact) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-4 pb-4">
        {content}
      </CardContent>
    </Card>
  );
}

interface UsageBarProps {
  label: string;
  icon: LucideIcon;
  used: number;
  limit: number;
}

function UsageBar({ label, icon: Icon, used, limit }: UsageBarProps) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const colorClass =
    percent >= 90
      ? "bg-destructive"
      : percent >= 60
      ? "bg-warning"
      : "bg-success";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {used} / {isFinite(limit) ? limit : "∞"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            colorClass
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
