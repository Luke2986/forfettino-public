import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ReceiptLimitBanner() {
  const { isPro, isStudio, receiptsUsed, receiptsLimit, canAddReceipt } = useSubscription();
  const navigate = useNavigate();

  // Don't show for paid plans (Pro or Studio)
  if (isPro || isStudio) return null;

  // Guard: infinite limit means no cap — never show banner
  if (!isFinite(receiptsLimit)) return null;

  // Show warning when close to limit (80%+)
  const usagePercent = (receiptsUsed / receiptsLimit) * 100;
  const showWarning = usagePercent >= 80;
  const atLimit = !canAddReceipt;

  if (!showWarning && !atLimit) return null;

  return (
    <Alert variant={atLimit ? "destructive" : "default"} className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <AlertDescription>
          {atLimit ? (
            <>
              Hai raggiunto il limite di <strong>{receiptsLimit}</strong> incassi per il piano Free.
            </>
          ) : (
            <>
              Hai usato <strong>{receiptsUsed}</strong> di <strong>{receiptsLimit}</strong> incassi disponibili.
            </>
          )}
        </AlertDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 shrink-0"
        onClick={() => navigate("/impostazioni?tab=abbonamento")}
      >
        <ArrowRight className="h-4 w-4" />
        Vedi piano
      </Button>
    </Alert>
  );
}
