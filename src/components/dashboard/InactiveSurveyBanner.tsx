import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIncomeStats } from "@/hooks/useIncomeStats";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { MessageCircleQuestion, X } from "lucide-react";

const SURVEY_KEY = "inactive_0_income_v1";
const COOLDOWN_DAYS = 30;
const TRIGGER_HOURS = 72;

const REASONS = [
  { value: "no_time", label: "Non ho tempo ora" },
  { value: "use_excel", label: "Uso già Excel" },
  { value: "dont_understand", label: "Non capisco da dove iniziare" },
  { value: "dont_trust", label: "Non mi fido delle stime" },
  { value: "expected_different", label: "Mi aspettavo altro" },
] as const;

export function InactiveSurveyBanner() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: incomeStats } = useIncomeStats();
  const queryClient = useQueryClient();

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if user has already responded within cooldown period
  const { data: recentResponse, isLoading: checkingResponse } = useQuery({
    queryKey: ["survey_cooldown", user?.id, SURVEY_KEY],
    queryFn: async () => {
      if (!user) return null;
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - COOLDOWN_DAYS);

      const { data } = await (supabase as any)
        .from("survey_responses")
        .select("id")
        .eq("user_id", user.id)
        .eq("survey_key", SURVEY_KEY)
        .gte("created_at", cooldownDate.toISOString())
        .limit(1);

      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!user,
  });

  // Determine if we should show the survey
  const shouldShow = (() => {
    if (!user || !profile || !incomeStats || checkingResponse) return false;
    if (dismissed || submitted) return false;
    if (recentResponse) return false; // already responded within cooldown

    // Must have 0 incassi
    if (incomeStats.count_total > 0) return false;

    // Must have completed onboarding
    if (!profile.onboarding_completed) return false;

    // Must be at least 72 hours since profile creation (proxy for signup)
    const profileCreated = new Date(profile.created_at);
    const hoursSinceSignup = (Date.now() - profileCreated.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSignup < TRIGGER_HOURS) return false;

    return true;
  })();

  // Track survey shown (once)
  const trackedRef = useRef(false);
  useEffect(() => {
    if (shouldShow && !trackedRef.current) {
      trackedRef.current = true;
      track("inactive_survey_shown", {});
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  const handleSubmit = async () => {
    if (!user || !selectedReason) return;
    setSubmitting(true);

    try {
      await (supabase as any).from("survey_responses").insert({
        user_id: user.id,
        survey_key: SURVEY_KEY,
        selected_reason: selectedReason,
        free_text: freeText.trim() || null,
      });

      track("inactive_survey_submitted", {
        selected_reason: selectedReason,
        has_free_text: freeText.trim().length > 0,
      });

      queryClient.invalidateQueries({ queryKey: ["survey_cooldown"] });
      setSubmitted(true);

      // Auto-hide after 3 seconds
      setTimeout(() => setDismissed(true), 3000);
    } catch {
      // fail-silent
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="squircle-md border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-4 text-center">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Grazie per il feedback!
        </p>
      </div>
    );
  }

  return (
    <div className="squircle-md border bg-muted/30 p-4 space-y-3 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Chiudi"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-primary shrink-0" />
        <p className="font-medium text-sm">Ti sei fermato? Dimmi cosa ti blocca</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REASONS.map((reason) => (
          <button
            key={reason.value}
            onClick={() => setSelectedReason(
              selectedReason === reason.value ? null : reason.value
            )}
            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
              selectedReason === reason.value
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border hover:border-primary/50 text-muted-foreground"
            }`}
          >
            {reason.label}
          </button>
        ))}
      </div>

      {selectedReason && (
        <div className="space-y-2">
          <Textarea
            placeholder="Altro (opzionale)"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Invio..." : "Invia"}
          </Button>
        </div>
      )}
    </div>
  );
}
