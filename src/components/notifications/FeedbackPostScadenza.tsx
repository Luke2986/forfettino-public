import { useState } from "react";
import { CalendarCheck, PartyPopper, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDeadlineFeedback } from "@/hooks/useDeadlineFeedback";
import { cn } from "@/lib/utils";

type Step = "question" | "yes_response" | "no_form";
type Reason = "no_money" | "forgot" | "unclear_amount" | "other";

const REASON_LABELS: Record<Reason, string> = {
  no_money: "Non avevo i soldi",
  forgot: "Mi sono dimenticato/a",
  unclear_amount: "Non capivo quanto dovevo pagare",
  other: "Altro",
};

interface FeedbackPostScadenzaProps {
  scadenzaName: string;
  scheduleEventId: string;
  notificationId: string;
  onComplete: () => void;
}

/**
 * Componente 2-step per feedback post-scadenza (Story 25.5).
 *
 * Vive dentro BlockingModal come children. NON gestisce il modal/overlay.
 * Step flow: question → yes_response | no_form → complete
 */
export function FeedbackPostScadenza({
  scadenzaName,
  scheduleEventId,
  notificationId,
  onComplete,
}: FeedbackPostScadenzaProps) {
  const [step, setStep] = useState<Step>("question");
  const [reason, setReason] = useState<Reason | null>(null);
  const [freeText, setFreeText] = useState("");

  const feedbackMutation = useDeadlineFeedback();

  const handleYes = () => {
    feedbackMutation.mutate(
      {
        scheduleEventId,
        notificationId,
        response: "yes",
      },
      {
        onSuccess: () => setStep("yes_response"),
      }
    );
  };

  const handleNo = () => {
    setStep("no_form");
  };

  const handleSubmitNo = () => {
    if (!reason) return;
    feedbackMutation.mutate(
      {
        scheduleEventId,
        notificationId,
        response: "no",
        reason,
        freeText: reason === "other" ? freeText : null,
      },
      {
        onSuccess: () => onComplete(),
      }
    );
  };

  const handleClose = () => {
    onComplete();
  };

  if (step === "question") {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <p className="text-sm text-center text-slate-600">
          La scadenza <span className="font-semibold">{scadenzaName}</span> è
          passata. Come è andata?
        </p>
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 min-h-[44px]"
            onClick={handleYes}
            disabled={feedbackMutation.isPending}
          >
            <CalendarCheck className="h-4 w-4 text-teal-600" />
            Sì, tutto ok!
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center gap-2 min-h-[44px]"
            onClick={handleNo}
          >
            <HeartHandshake className="h-4 w-4 text-slate-500" />
            No, ho avuto difficoltà
          </Button>
        </div>
      </div>
    );
  }

  if (step === "yes_response") {
    return (
      <div className="flex flex-col items-center gap-4" aria-live="polite">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
          <PartyPopper className="h-6 w-6 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">Ottimo lavoro!</p>
          <p className="text-sm text-slate-600 mt-1">
            Hai gestito tutto alla grande. Continua così!
          </p>
        </div>
        <Button className="w-full min-h-[44px]" onClick={handleClose}>
          Chiudi
        </Button>
      </div>
    );
  }

  // step === "no_form"
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="text-center">
        <p className="text-sm text-slate-600">
          Succede anche ai migliori. Aiutaci a capire cosa è andato storto.
        </p>
      </div>

      <RadioGroup
        value={reason ?? ""}
        onValueChange={(v) => setReason(v as Reason)}
        aria-label="Motivo della difficoltà"
      >
        {(Object.entries(REASON_LABELS) as [Reason, string][]).map(
          ([value, label]) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`reason-${value}`} />
              <Label
                htmlFor={`reason-${value}`}
                className="text-sm cursor-pointer"
              >
                {label}
              </Label>
            </div>
          )
        )}
      </RadioGroup>

      {reason === "other" && (
        <Textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value.slice(0, 200))}
          placeholder="Descrivi la tua difficoltà..."
          aria-label="Descrivi la tua difficoltà"
          className={cn("resize-none text-sm", freeText.length >= 200 && "border-amber-400")}
          rows={3}
          maxLength={200}
        />
      )}

      {reason === "other" && (
        <p className="text-xs text-slate-500 text-right -mt-2">
          {freeText.length}/200
        </p>
      )}

      <Button
        className="w-full min-h-[44px]"
        onClick={handleSubmitNo}
        disabled={!reason || feedbackMutation.isPending}
        aria-disabled={!reason}
      >
        {feedbackMutation.isPending ? "Invio in corso..." : "Invia e chiudi"}
      </Button>
    </div>
  );
}
