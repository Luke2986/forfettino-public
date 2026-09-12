import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import type { InstallmentPlanWithProgress } from "@/hooks/useInstallmentPlans";

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: InstallmentPlanWithProgress | null;
  onConfirm: (planId: string, deadlineId: string, importo: number, dataIncasso: Date, note?: string) => void;
  isPending: boolean;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  plan,
  onConfirm,
  isPending,
}: RegisterPaymentDialogProps) {
  const [importo, setImporto] = useState("");
  const [dataIncasso, setDataIncasso] = useState<Date>(new Date());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const residuo = plan ? plan.residuo : 0;
  const nextDeadline = plan?.nextDeadline;

  // Reset form when plan changes
  useEffect(() => {
    if (plan && open) {
      // Pre-fill with next deadline amount, or residuo
      const prefillAmount = nextDeadline
        ? nextDeadline.expected_amount
        : residuo;
      setImporto(prefillAmount > 0 ? prefillAmount.toFixed(2) : "");
      setDataIncasso(new Date());
      setNote("");
      setError(null);
    }
  }, [plan?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) return null;

  const handleConfirm = () => {
    const value = parseFloat(importo);
    if (isNaN(value) || value <= 0) {
      setError("L'importo deve essere maggiore di zero");
      return;
    }
    // Confronto in centesimi per evitare floating point issues
    // Coerente con hook registerPaymentMutation che fa: gross > plan.residuo
    if (Math.round(value * 100) > Math.round(residuo * 100)) {
      setError(
        `L'importo supera il residuo di ${formatCurrency(residuo)}`
      );
      return;
    }
    setError(null);

    // deadlineId: se c'è una deadline non pagata, la usiamo.
    // Se non c'è (piano senza deadlines predefinite), la pagina chiamante
    // deve gestire deadlineId="" creando una nuova deadline on-the-fly.
    const deadlineId = nextDeadline?.id ?? "";
    onConfirm(plan.id, deadlineId, value, dataIncasso, note.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registra pagamento</DialogTitle>
          <DialogDescription>
            Registra un pagamento per {plan.client_name || "questo incasso a rate"}.
            Residuo: {formatCurrency(residuo)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Importo (€) *</Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={importo}
              onChange={(e) => {
                setImporto(e.target.value);
                setError(null);
              }}
              data-testid="payment-amount"
            />
            {error && (
              <p className="text-sm text-destructive" data-testid="payment-error">
                {error}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Data incasso *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataIncasso && "text-muted-foreground"
                  )}
                  data-testid="payment-date-trigger"
                  aria-label={dataIncasso ? `Data incasso: ${format(dataIncasso, "PPP", { locale: it })}` : "Seleziona data incasso"}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {dataIncasso
                    ? format(dataIncasso, "PPP", { locale: it })
                    : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataIncasso}
                  onSelect={(d) => d && setDataIncasso(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-note">Note (opzionali)</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Es. Seconda rata progetto..."
              data-testid="payment-note"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !importo}
            data-testid="confirm-payment"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registra pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
