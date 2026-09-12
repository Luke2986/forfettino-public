import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface ExpiredRatesBannerProps {
  expiredCount: number;
  isDismissed: boolean;
  onDismiss: () => void;
  className?: string;
}

export function ExpiredRatesBanner({
  expiredCount,
  isDismissed,
  onDismiss,
  className,
}: ExpiredRatesBannerProps) {
  const navigate = useNavigate();

  if (expiredCount === 0 || isDismissed) return null;

  return (
    <Card
      role="alert"
      aria-live="polite"
      className={cn(
        // `!` Tailwind important modifier override su `rounded-2xl` hardcoded di Card primitive
        // (radius 24 → 16 per allineamento alert sistema, Story 81-6 Epic 81 Squircle Design System).
        // tw-merge non deduplica `rounded-*` vs `squircle-*` (utility custom): `!important` decide.
        "!squircle-lg bg-warning-muted border-warning-muted text-warning p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold">
            {expiredCount === 1
              ? "Hai 1 rata con scadenza passata"
              : `Hai ${expiredCount} rate con scadenza passata`}
          </p>
          <p className="text-xs">
            È normale se ti sei iscritto a metà anno. I calcoli tengono conto di
            {expiredCount === 1 ? " questa rata" : " queste rate"}.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="link"
              className="h-auto p-0 text-warning"
              onClick={() => {
                track("expired_rates_banner_cta_click", { expired_count: expiredCount });
                navigate("/scadenziario");
              }}
            >
              Vai allo Scadenziario →
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Chiudi avviso"
          className="shrink-0 text-warning"
          onClick={onDismiss}
        >
          Nascondi questo avviso
        </Button>
      </div>
    </Card>
  );
}
