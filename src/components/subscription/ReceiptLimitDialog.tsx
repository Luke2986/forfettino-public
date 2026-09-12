import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

interface ReceiptLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptLimitDialog({ open, onOpenChange }: ReceiptLimitDialogProps) {
  const { receiptsLimit } = useSubscription();
  const navigate = useNavigate();

  // Guard: limite infinito → dialog non ha senso, non mostrarlo
  const effectiveOpen = open && isFinite(receiptsLimit);

  return (
    <Dialog open={effectiveOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Limite incassi raggiunto</DialogTitle>
          <DialogDescription className="text-center">
            Hai raggiunto il limite di <strong>{receiptsLimit} incassi manuali</strong> per il piano Free.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Funzionalità avanzate arriveranno in futuro, quando la community dei Forfettini sarà più ampia.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={() => { onOpenChange(false); navigate("/impostazioni?tab=abbonamento"); }} className="w-full">
            Vedi il tuo piano
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full" data-testid="receipt-limit-close-btn">
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
