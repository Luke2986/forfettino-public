import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { track } from "@/lib/analytics";

const SURVEY_KEY = "pricing_van_westendorp_v1";

interface PricingSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface FormData {
  tooCheap: string;
  goodValue: string;
  expensiveOk: string;
  tooExpensive: string;
  freeText: string;
}

const QUESTIONS = [
  {
    key: "tooCheap" as const,
    label:
      "A quale prezzo annuale Forfettino ti sembrerebbe troppo economico, al punto da dubitare della qualità?",
    helper: "Sotto questo prezzo penseresti: è troppo poco, non può funzionare bene",
    placeholder: "es. 10",
  },
  {
    key: "goodValue" as const,
    label: "A quale prezzo annuale Forfettino ti sembrerebbe un buon affare?",
    helper: "Un prezzo giusto: lo pagheresti senza pensarci",
    placeholder: "es. 50",
  },
  {
    key: "expensiveOk" as const,
    label:
      "A quale prezzo annuale Forfettino inizierebbe a sembrarti caro, ma lo considereresti comunque?",
    helper: "Costa, ma il valore che ti dà potrebbe giustificarlo",
    placeholder: "es. 100",
  },
  {
    key: "tooExpensive" as const,
    label:
      "A quale prezzo annuale Forfettino sarebbe troppo caro e non lo pagheresti?",
    helper: "Oltre questo prezzo: no grazie, non importa quanto è utile",
    placeholder: "es. 200",
  },
] as const;

export function PricingSurveyDialog({
  open,
  onOpenChange,
  onComplete,
}: PricingSurveyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormData>({
    tooCheap: "",
    goodValue: "",
    expensiveOk: "",
    tooExpensive: "",
    freeText: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  /** Parse Italian-locale numbers: "10,50" → 10.5 */
  const parseNum = (v: string) => parseFloat(v.replace(",", ".")) || 0;

  const numericValues = {
    tooCheap: parseNum(form.tooCheap),
    goodValue: parseNum(form.goodValue),
    expensiveOk: parseNum(form.expensiveOk),
    tooExpensive: parseNum(form.tooExpensive),
  };

  const allFilled =
    numericValues.tooCheap > 0 &&
    numericValues.goodValue > 0 &&
    numericValues.expensiveOk > 0 &&
    numericValues.tooExpensive > 0;

  // Soft warning: "too cheap" > "good value" is unusual
  const showWarning =
    numericValues.tooCheap > 0 &&
    numericValues.goodValue > 0 &&
    numericValues.tooCheap > numericValues.goodValue;

  const handleChange = (key: keyof FormData, value: string) => {
    // For numeric fields: allow only digits, dot and comma
    if (key !== "freeText") {
      const sanitized = value.replace(/[^0-9.,]/g, "");
      setForm((prev) => ({ ...prev, [key]: sanitized }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!user || !allFilled) return;
    setSubmitting(true);
    setSubmitError(false);

    try {
      // 0. Guard against duplicates — check if user already responded
      const { data: existing } = await (supabase as any)
        .from("survey_responses")
        .select("id")
        .eq("user_id", user.id)
        .eq("survey_key", SURVEY_KEY)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already responded — skip insert, show success
        setSubmitted(true);
        setPointsAwarded(false);
        setTimeout(() => {
          onOpenChange(false);
          onComplete();
        }, 3000);
        return;
      }

      // 1. Save survey response
      const { error: insertError } = await (supabase as any)
        .from("survey_responses")
        .insert({
          user_id: user.id,
          survey_key: SURVEY_KEY,
          selected_reason: JSON.stringify({
            too_cheap: numericValues.tooCheap,
            good_value: numericValues.goodValue,
            expensive_ok: numericValues.expensiveOk,
            too_expensive: numericValues.tooExpensive,
          }),
          free_text: form.freeText.trim() || null,
        });

      // Unique constraint violation (duplicate) — treat as success
      if (insertError?.code === "23505") {
        setSubmitted(true);
        setPointsAwarded(false);
        setTimeout(() => {
          onOpenChange(false);
          onComplete();
        }, 3000);
        return;
      }
      if (insertError) throw insertError;

      // 2. Update last_survey_completed_at for 60-day budget
      await supabase
        .from("profiles")
        .update({ last_survey_completed_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);

      // 3. Award contribution points
      const { data: awarded } = await supabase.rpc(
        "record_pricing_survey_contribution" as any,
      );
      setPointsAwarded(awarded === true);

      // 4. Track event
      track("pricing_survey_submitted", {
        too_cheap: numericValues.tooCheap,
        good_value: numericValues.goodValue,
        expensive_ok: numericValues.expensiveOk,
        too_expensive: numericValues.tooExpensive,
        has_free_text: form.freeText.trim().length > 0,
      });

      // 5. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["survey_responded"] });
      queryClient.invalidateQueries({ queryKey: ["my-contributions"] });
      queryClient.invalidateQueries({ queryKey: ["survey-budget"] });

      setSubmitted(true);

      // Auto-close after 3 seconds
      setTimeout(() => {
        onOpenChange(false);
        onComplete();
      }, 3000);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitted) {
      // Reset form on close without submit
      setForm({
        tooCheap: "",
        goodValue: "",
        expensiveOk: "",
        tooExpensive: "",
        freeText: "",
      });
      setSubmitError(false);
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Quanto vale Forfettino Pro per te?</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground" asChild>
            <div>
              <p>Il tuo cruscotto fiscale resterà sempre gratuito. Sto però costruendo Forfettino Pro, il livello successivo per chi vuole zero ansia. Sbloccherà:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Incassi illimitati e visualizzazione multi-anno fatturato</li>
                <li>Sincronizzazione scadenze su Google/Apple Calendar</li>
                <li>Simulatore "Cosa succede se..." per i nuovi preventivi</li>
                <li>Archivio di guide e template salva-vita anti-burocrazia</li>
              </ul>
              <p className="mt-2">Aiutami a capire: qual è il prezzo annuale giusto per questo pacchetto Pro? Le risposte sono anonime.</p>
            </div>
          </SheetDescription>
        </SheetHeader>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Grazie!
              {pointsAwarded && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                  +10 punti
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Le tue risposte mi aiuteranno a costruire un Forfettino
              sostenibile.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {QUESTIONS.map((q, idx) => (
              <div key={q.key} className="space-y-1.5">
                <Label
                  htmlFor={`pricing-${q.key}`}
                  className="text-sm font-medium leading-snug"
                >
                  {idx + 1}. {q.label}
                </Label>
                <div className="relative">
                  <Input
                    id={`pricing-${q.key}`}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    placeholder={q.placeholder}
                    value={form[q.key]}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                    className="pr-20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    EUR/anno
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{q.helper}</p>
              </div>
            ))}

            {showWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Sicuro? Di solito il prezzo troppo economico è più basso del
                  buon affare
                </p>
              </div>
            )}

            {/* Optional textarea */}
            <div className="space-y-1.5">
              <Label htmlFor="pricing-freetext" className="text-sm font-medium">
                Vuoi aggiungere qualcosa?
              </Label>
              <Textarea
                id="pricing-freetext"
                placeholder="Preferenze sul modello (mensile, annuale, lifetime...), cosa ti farebbe pagare di più, dubbi..."
                value={form.freeText}
                onChange={(e) => handleChange("freeText", e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800">
                  Invio fallito — riprova tra qualche secondo
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!allFilled || submitting}
            >
              {submitting ? "Invio..." : "Invia"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
