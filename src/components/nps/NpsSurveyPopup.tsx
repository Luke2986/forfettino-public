import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { track } from "@/lib/analytics";

/** Contextual comment question based on NPS score range */
function getCommentQuestion(score: number): string {
  if (score <= 6) return "Cosa potremmo migliorare?";
  if (score <= 8) return "Cosa ci manca per essere un 9?";
  return "Cosa apprezzi di più?";
}

interface NpsSurveyPopupProps {
  onDismiss: () => void;
  onComplete: () => void;
  triggerSource: string;
  campaignId?: string | null;
}

type Step = "score" | "comment" | "thankyou";

export function NpsSurveyPopup({
  onDismiss,
  onComplete,
  triggerSource,
  campaignId,
}: NpsSurveyPopupProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("score");
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);

  // Auto-close thank-you after 3 seconds
  useEffect(() => {
    if (step !== "thankyou") return;
    const timer = setTimeout(() => onComplete(), 3000);
    return () => clearTimeout(timer);
  }, [step, onComplete]);

  const handleNext = () => {
    if (score === null) return;
    setStep("comment");
  };

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    setSubmitError(false);

    try {
      // 1. Persist NPS response via RPC
      await (supabase as any).rpc("record_nps_response", {
        p_score: score,
        p_comment: comment.trim() || null,
        p_trigger_source: triggerSource,
        p_campaign_id: campaignId ?? null,
      });

      // 2. Award contribution points
      const { data: awarded } = await (supabase as any).rpc(
        "record_nps_survey_contribution",
      );
      setPointsAwarded(awarded === true);

      // 3. Track analytics event
      track("nps_survey_submitted", {
        score,
        has_comment: comment.trim().length > 0,
        trigger_source: triggerSource,
      });

      // 4. Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["survey-budget"] });
      queryClient.invalidateQueries({ queryKey: ["my-contributions"] });
      queryClient.invalidateQueries({ queryKey: ["nps-responded"] });
      queryClient.invalidateQueries({ queryKey: ["nps-active-campaign"] });

      setStep("thankyou");
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Step 3: Thank-you ---
  if (step === "thankyou") {
    return (
      <div className="flex flex-col items-center text-center space-y-3 py-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Grazie!
          {pointsAwarded && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              +5 punti
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Con questo stai aiutando Forfettino a migliorare e renderlo un posto
          migliore
        </p>
      </div>
    );
  }

  // --- Step 2: Comment ---
  if (step === "comment" && score !== null) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">
          {getCommentQuestion(score)}
        </p>
        <Textarea
          placeholder="Scrivi qui (opzionale)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="text-sm"
        />
        {submitError && (
          <p className="text-sm text-red-600">
            Si è verificato un errore, riprova.
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Invio..." : "Invia"}
        </Button>
      </div>
    );
  }

  // --- Step 1: Score ---
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Quanto consiglieresti Forfettino? Anonimo. +5pt
      </p>

      <div
        className="flex justify-between gap-1"
        role="radiogroup"
        aria-label="Score NPS da 0 a 10"
      >
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={score === i}
            onClick={() => setScore(i)}
            className={`flex-1 min-w-0 h-9 rounded-lg text-sm font-medium transition-colors ${
              score === i
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500">La tua risposta è anonima</p>

      <Button
        className="w-full"
        onClick={handleNext}
        disabled={score === null}
      >
        Avanti
      </Button>
    </div>
  );
}
