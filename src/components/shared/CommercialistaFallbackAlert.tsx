import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FallbackTrigger = "expired_rates_30d" | "settings_variation" | "gestione_blocked";

interface CommercialistaFallbackAlertProps {
  trigger: FallbackTrigger;
  isDismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const TRIGGER_MESSAGES: Record<FallbackTrigger, { title: string; body: string }> = {
  expired_rates_30d: {
    title: "Verifica con il tuo commercialista",
    body: "Hai rate scadute da più di un mese. Verifica con il tuo commercialista per non rischiare sanzioni.",
  },
  settings_variation: {
    title: "Verifica con il tuo commercialista",
    body: "I calcoli sono stati aggiornati. Per le rate già pagate, verifica la situazione col tuo commercialista.",
  },
  gestione_blocked: {
    title: "Verifica con il tuo commercialista",
    body: "Non è possibile cambiare gestione INPS a metà anno con incassi registrati. Verifica con il tuo commercialista le implicazioni fiscali.",
  },
};

export function CommercialistaFallbackAlert({
  trigger,
  isDismissible = true,
  onDismiss,
  className,
}: CommercialistaFallbackAlertProps) {
  const message = TRIGGER_MESSAGES[trigger];
  if (!message) return null;

  return (
    <Card
      role="region"
      aria-label="Avviso commercialista"
      aria-live="polite"
      className={cn(
        "bg-warning-muted border-warning-muted text-warning p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">{message.title}</p>
          <p className="text-xs">{message.body}</p>
        </div>
        {isDismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Chiudi avviso"
            className="shrink-0 text-warning"
            onClick={onDismiss}
          >
            Nascondi questo avviso
          </Button>
        )}
      </div>
    </Card>
  );
}
