import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { bucketToLabel, formatDateIT, daysUntil } from "@/lib/schedule-helpers";
import { classifyDelta, shouldAskReason } from "@/lib/tolerance";
import { REASON_OPTIONS, type DiscrepancyReasonCode } from "@/lib/discrepancy";
import {
  getPaymentWindows,
  classifyPaymentWindow,
  type PaymentWindowCode,
} from "@/lib/fiscal-engine";
import { track } from "@/lib/analytics";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

// Contesto di tracking che il componente passa al consumer nel callback di
// conferma. Il consumer (useMarkAsPaid) lo inoltra a PostHog/event_logs nel
// `mark_as_paid_confirmed` per arricchire l'evento con metadata comportamentale
// che NON si calcolano lato hook (es. tempo speso nel dialog).
export interface MarkAsPaidTrackingContext {
  source: string;
  timeInDialogMs: number | null;
  daysToDue: number;
}

/** Payload completo della conferma: importo reale, motivo, nota + tracking. */
export interface MarkAsPaidConfirmPayload {
  amountPaidCents: number;
  reasonCode: DiscrepancyReasonCode | null;
  note: string | null;
  /** Finestra di versamento scelta (solo rata `june` in anni con proroga); null altrimenti. */
  paymentWindow: PaymentWindowCode | null;
  /** Maggiorazione legale della finestra in centesimi (0 salvo differimento). */
  surchargeCents: number;
  context: MarkAsPaidTrackingContext;
}

export interface MarkAsPaidButtonProps {
  schedule: TaxScheduleRow;
  onConfirm: (
    paymentDate: string,
    payload: MarkAsPaidConfirmPayload,
  ) => void;
  isPending?: boolean;
  /**
   * Origine della chiamata per telemetria (prop `source` su eventi PostHog).
   */
  source?: string;
  /**
   * Callback per annullare il "segna come pagata" su una rata già pagata.
   * Se omesso, una rata pagata non mostra alcun controllo (backward compat
   * con consumer/test legacy). Il consumer possiede `useUnmarkAsPaid`.
   */
  onUndo?: (scheduleId: string) => void;
  /** True mentre l'annullamento è in corso (disabilita il bottone conferma). */
  isUndoing?: boolean;
}

/** Format a Date as YYYY-MM-DD using local time (avoids UTC shift) */
function toLocalISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Min selectable date: -10 years from today */
function minDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d;
}

/** Max selectable date: +1 year from today */
function maxDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function MarkAsPaidButton({
  schedule,
  onConfirm,
  isPending = false,
  source = "scadenziario",
  onUndo,
  isUndoing = false,
}: MarkAsPaidButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [reasonCode, setReasonCode] = useState<DiscrepancyReasonCode | null>(null);
  const [note, setNote] = useState("");
  // Finestra di versamento scelta (rata `june` in anni con proroga).
  const [paymentWindow, setPaymentWindow] = useState<PaymentWindowCode | null>(null);

  // Ref al timestamp di apertura dialog per calcolare time_in_dialog_ms.
  const openedAtRef = useRef<number | null>(null);
  const cancelMethodRef = useRef<"button" | "esc" | "backdrop" | null>(null);
  const isConfirmingRef = useRef(false);

  // Rate a importo nullo: nessun controllo (né pagamento né annullamento)
  if (Number(schedule.total_expected) <= 0) {
    return null;
  }

  // Rata già pagata → consenti l'annullamento di "segna come pagata".
  if (schedule.status === "paid") {
    if (!onUndo) return null;

    const handleUndoConfirm = () => {
      track("mark_as_paid_undo_confirmed", {
        schedule_id: schedule.id,
        bucket: schedule.bucket,
        amount: Number(schedule.total_expected),
        due_date: schedule.due_date,
        source,
      });
      onUndo(schedule.id);
      setUndoDialogOpen(false);
    };

    return (
      <>
        <Button
          variant="outline"
          className="w-full min-h-[44px]"
          onClick={() => {
            track("mark_as_paid_undo_intent", {
              schedule_id: schedule.id,
              bucket: schedule.bucket,
              amount: Number(schedule.total_expected),
              due_date: schedule.due_date,
              source,
            });
            setUndoDialogOpen(true);
          }}
        >
          Annulla pagamento
        </Button>

        <Dialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Annullare il pagamento?</DialogTitle>
              <DialogDescription>
                Questa rata tornerà tra le scadenze da pagare. Potrai segnarla
                come pagata di nuovo in qualsiasi momento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span>{bucketToLabel(schedule.bucket, schedule.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Importo</span>
                <span className="font-medium">
                  {formatCurrency(Number(schedule.total_expected))}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUndoDialogOpen(false)}
                disabled={isUndoing}
              >
                Mantieni pagata
              </Button>
              <Button
                variant="destructive"
                onClick={handleUndoConfirm}
                disabled={isUndoing}
              >
                {isUndoing ? "Annullamento…" : "Annulla pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const dateValid = selectedDate != null;
  const paymentDateISO = selectedDate ? toLocalISO(selectedDate) : "";

  // === Finestre di versamento (solo rata `june` in anni con proroga) ===
  // Per il saldo + 1° acconto di un anno con proroga l'utente sceglie la
  // finestra (entro 30/06 · 1-20/7 · 21/7-20/8 +0,80% · oltre). Le altre rate
  // e gli anni senza proroga mantengono invariato il flusso classico.
  const windows = getPaymentWindows(schedule.payment_year);
  const isJuneProroga = schedule.bucket === "june" && windows !== null;
  const selectedWindowOption = windows?.find((w) => w.code === paymentWindow);

  // === Importo reale + classificazione banda (live) ===
  const estimatedCents = Math.round(Number(schedule.total_expected) * 100);

  // Maggiorazione legale della finestra in centesimi (0 salvo differimento).
  const surchargeForWindow = (code: PaymentWindowCode | null): number => {
    if (!isJuneProroga || !code) return 0;
    const opt = windows?.find((w) => w.code === code);
    return opt ? Math.round(estimatedCents * opt.maggiorazione) : 0;
  };
  const windowSurchargeCents = surchargeForWindow(paymentWindow);
  // L'atteso DELLA FINESTRA (stima + maggiorazione) governa prefill e banda: un
  // differimento pagato correttamente risulta VERDE, non giallo.
  const expectedForBandCents = estimatedCents + windowSurchargeCents;

  const parsedPaid = parseFloat(amountInput.replace(",", "."));
  const amountValid = !isNaN(parsedPaid) && parsedPaid > 0;
  const paidCents = amountValid ? Math.round(parsedPaid * 100) : expectedForBandCents;
  const { band, deltaCents } = classifyDelta(expectedForBandCents, paidCents);
  // Motivo richiesto fuori banda verde; per `late` lo chiediamo sempre (ravvedimento).
  const askReason =
    (amountValid && shouldAskReason(band)) || (isJuneProroga && paymentWindow === "late");

  // Cambio finestra dal selettore: aggiorna finestra, riallinea l'importo
  // suggerito (1-tap corretto) e la data al termine della finestra; `late`
  // propone il ravvedimento, uscendone azzera il motivo auto-impostato.
  const selectWindow = (code: PaymentWindowCode) => {
    setPaymentWindow(code);
    setAmountInput(((estimatedCents + surchargeForWindow(code)) / 100).toFixed(2));
    const opt = windows?.find((w) => w.code === code);
    if (opt) setSelectedDate(new Date(`${opt.isoDate}T00:00:00`));
    if (code === "late") setReasonCode("ravvedimento");
    else if (reasonCode === "ravvedimento") setReasonCode(null);
  };

  const baseTrackingProps = {
    schedule_id: schedule.id,
    bucket: schedule.bucket,
    amount: Number(schedule.total_expected),
    due_date: schedule.due_date,
    days_to_due: daysUntil(schedule.due_date),
    source,
  };

  const handleConfirm = () => {
    if (!dateValid || !amountValid) return;
    // Rata giugno con proroga: la finestra è obbligatoria.
    if (isJuneProroga && !paymentWindow) return;
    isConfirmingRef.current = true;
    const timeInDialogMs = openedAtRef.current != null
      ? Date.now() - openedAtRef.current
      : null;
    onConfirm(paymentDateISO, {
      amountPaidCents: paidCents,
      reasonCode: askReason ? reasonCode : null,
      note: askReason && note.trim() ? note.trim() : null,
      paymentWindow: isJuneProroga ? paymentWindow : null,
      surchargeCents: windowSurchargeCents,
      context: {
        source,
        timeInDialogMs,
        daysToDue: baseTrackingProps.days_to_due,
      },
    });
    setDialogOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Reset stato form all'apertura
      const now = new Date();
      setSelectedDate(now);
      // Finestra di default = quella in cui cade oggi (1-tap nel caso comune).
      const defaultWindow = isJuneProroga
        ? classifyPaymentWindow(schedule.payment_year, toLocalISO(now))
        : null;
      setPaymentWindow(defaultWindow);
      // Precompila l'importo con l'atteso della finestra (stima + maggiorazione).
      const surcharge = surchargeForWindow(defaultWindow);
      setAmountInput(((estimatedCents + surcharge) / 100).toFixed(2));
      setReasonCode(defaultWindow === "late" ? "ravvedimento" : null);
      setNote("");
      openedAtRef.current = Date.now();
      cancelMethodRef.current = null;
      isConfirmingRef.current = false;
      track("mark_as_paid_intent", baseTrackingProps);
    } else if (dialogOpen && !isConfirmingRef.current) {
      const method = cancelMethodRef.current ?? "button";
      const timeInDialogMs = openedAtRef.current != null
        ? Date.now() - openedAtRef.current
        : null;
      track("mark_as_paid_cancelled", {
        ...baseTrackingProps,
        cancel_method: method,
        time_in_dialog_ms: timeInDialogMs,
      });
    }
    setDialogOpen(open);
  };

  return (
    <>
      <Button
        variant="default"
        className="w-full min-h-[44px]"
        onClick={() => handleOpenChange(true)}
      >
        Segna come pagata
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          onEscapeKeyDown={() => {
            cancelMethodRef.current = "esc";
          }}
          onPointerDownOutside={() => {
            cancelMethodRef.current = "backdrop";
          }}
        >
          <DialogHeader>
            <DialogTitle>Conferma pagamento</DialogTitle>
            <DialogDescription>
              Stai per segnare questa rata come già pagata.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span>{bucketToLabel(schedule.bucket, schedule.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stima Forfettino</span>
                <span className="font-medium">
                  {formatCurrency(Number(schedule.total_expected))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scadenza</span>
                <span>{formatDateIT(schedule.due_date)}</span>
              </div>
            </div>

            {/* Finestra di versamento (solo rata giugno in anni con proroga) */}
            {isJuneProroga && windows && (
              <div className="space-y-2 pt-2 border-t" data-testid="payment-window">
                <Label>Quando hai saldato? *</Label>
                <ToggleGroup
                  type="single"
                  value={paymentWindow ?? ""}
                  onValueChange={(v) => {
                    if (v) selectWindow(v as PaymentWindowCode);
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  {windows.map((w) => (
                    <ToggleGroupItem
                      key={w.code}
                      value={w.code}
                      variant="outline"
                      className="h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left data-[state=on]:bg-teal-50 data-[state=on]:text-teal-700 data-[state=on]:border-teal-300"
                    >
                      <span className="text-sm font-medium">{w.labelShort}</span>
                      {w.maggiorazione > 0 && (
                        <span className="text-xs text-amber-700">
                          +{(w.maggiorazione * 100).toLocaleString("it-IT", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          %
                        </span>
                      )}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {paymentWindow === "differimento" && selectedWindowOption && (
                  <p className="text-sm text-amber-700" data-testid="differimento-note">
                    Differimento {selectedWindowOption.labelRange}: maggiorazione +
                    {(selectedWindowOption.maggiorazione * 100).toLocaleString("it-IT", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    % → totale stimato{" "}
                    <span className="font-medium">
                      {formatCurrency(expectedForBandCents / 100)}
                    </span>
                    .
                  </p>
                )}
                {paymentWindow === "late" && (
                  <p className="text-sm text-muted-foreground" data-testid="late-note">
                    Versamento oltre il termine: ricordati sanzioni e interessi
                    (ravvedimento operoso). Indica l'importo realmente versato.
                  </p>
                )}
              </div>
            )}

            {/* Importo realmente pagato — precompilato con la stima */}
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="amount-paid">Quanto hai pagato davvero? *</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">€</span>
                <Input
                  id="amount-paid"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="flex-1"
                  data-testid="amount-paid"
                />
              </div>
              {!amountValid && (
                <p className="text-sm text-destructive">
                  Inserisci l'importo pagato (maggiore di zero).
                </p>
              )}
            </div>

            {/* Data pagamento */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Data pagamento</span>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                    aria-label={selectedDate ? `Data pagamento: ${format(selectedDate, "dd/MM/yyyy", { locale: it })}` : "Seleziona data pagamento"}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      // Mantieni finestra↔data coerenti: riclassifica dalla nuova data.
                      if (isJuneProroga && date) {
                        const code = classifyPaymentWindow(
                          schedule.payment_year,
                          toLocalISO(date),
                        );
                        setPaymentWindow(code);
                        if (code === "late") setReasonCode("ravvedimento");
                        else if (reasonCode === "ravvedimento") setReasonCode(null);
                      }
                      setPopoverOpen(false);
                    }}
                    locale={it}
                    fromDate={minDate()}
                    toDate={maxDate()}
                    defaultMonth={selectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Scostamento fuori tolleranza → chiedi il motivo (non blocca) */}
            {askReason && (
              <div
                className={cn(
                  "space-y-3 squircle-md p-3 border",
                  band === "red"
                    ? "border-destructive-muted bg-destructive-muted"
                    : "border-warning-muted bg-warning-muted",
                )}
                data-testid="discrepancy-reason"
              >
                {isJuneProroga && paymentWindow === "late" ? (
                  <p className="text-sm">
                    Hai versato oltre il termine: se hai usato il ravvedimento operoso
                    l'importo include sanzioni e interessi. Confermaci il motivo.
                  </p>
                ) : (
                  <p className="text-sm">
                    Hai indicato{" "}
                    <span className="font-medium">{formatCurrency(paidCents / 100)}</span>,
                    noi stimavamo{" "}
                    <span className="font-medium">{formatCurrency(expectedForBandCents / 100)}</span>{" "}
                    ({deltaCents > 0 ? "+" : ""}{formatCurrency(deltaCents / 100)}).
                    Aggiorniamo i tuoi conti — ci aiuti a capire perché?
                  </p>
                )}
                <ToggleGroup
                  type="single"
                  value={reasonCode ?? ""}
                  onValueChange={(v) => setReasonCode((v || null) as DiscrepancyReasonCode | null)}
                  className="flex flex-wrap justify-start gap-2"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <ToggleGroupItem
                      key={opt.code}
                      value={opt.code}
                      variant="outline"
                      className="h-auto whitespace-normal px-3 py-2 text-left text-sm data-[state=on]:bg-teal-50 data-[state=on]:text-teal-700 data-[state=on]:border-teal-300"
                    >
                      {opt.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Aggiungi un dettaglio (opzionale)…"
                  data-testid="discrepancy-note"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Annulla
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                isPending ||
                !dateValid ||
                !amountValid ||
                (isJuneProroga && !paymentWindow)
              }
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
