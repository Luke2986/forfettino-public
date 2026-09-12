import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { X, Calendar } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const SURVEY_KEY = "calendar_usage_v1";
const MAX_DISMISS_COUNT = 3;
const LS_DISMISS_COUNT = "forfettino:calendar-survey-dismiss-count";

type CalendarProvider = "google_calendar" | "apple_calendar" | "outlook" | "other" | "no";

const PROVIDER_OPTIONS: { value: CalendarProvider; label: string }[] = [
  { value: "google_calendar", label: "Google Calendar" },
  { value: "apple_calendar", label: "Apple Calendar" },
  { value: "outlook", label: "Outlook" },
  { value: "other", label: "Altro" },
  { value: "no", label: "No" },
];

function getDismissCount(): number {
  try {
    return parseInt(localStorage.getItem(LS_DISMISS_COUNT) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function CalendarSurveyBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherText, setOtherText] = useState("");

  // Check if user already responded
  const { data: hasResponded, isLoading: checkingResponse } = useQuery({
    queryKey: ["survey_responded", user?.id, SURVEY_KEY],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await (supabase as any)
        .from("survey_responses")
        .select("id")
        .eq("user_id", user.id)
        .eq("survey_key", SURVEY_KEY)
        .limit(1);
      if (error) return false;
      return data && data.length > 0;
    },
    enabled: !!user,
  });

  const shouldShow = (() => {
    if (!user || checkingResponse) return false;
    if (dismissed || submitted) return false;
    if (hasResponded) return false;

    const dismissCount = getDismissCount();
    if (dismissCount >= MAX_DISMISS_COUNT) return false;

    return true;
  })();

  if (!shouldShow) return null;

  const handleDismiss = () => {
    try {
      const currentCount = getDismissCount();
      localStorage.setItem(LS_DISMISS_COUNT, String(currentCount + 1));
    } catch {
      // localStorage unavailable
    }
    track("calendar_survey_dismissed", { dismiss_count: getDismissCount() });
    setDismissed(true);
  };

  const handleSelectProvider = async (provider: CalendarProvider, freeText?: string) => {
    if (!user || submitting) return;

    // If "other" is clicked and we haven't shown the input yet, show it
    if (provider === "other" && !showOtherInput) {
      setShowOtherInput(true);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Save survey response
      const { error: insertError } = await (supabase as any)
        .from("survey_responses")
        .insert({
          user_id: user.id,
          survey_key: SURVEY_KEY,
          selected_reason: JSON.stringify({ provider }),
          free_text: freeText?.trim() || null,
        });

      if (insertError) throw insertError;

      // 2. Update last_survey_completed_at for 60-day budget
      await supabase
        .from("profiles")
        .update({ last_survey_completed_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);

      // 3. Award contribution points
      try {
        await supabase.rpc("record_calendar_survey_contribution" as any);
      } catch {
        // fail-silent: contribution is a nice-to-have
      }

      // 4. Track analytics event
      track("calendar_survey_submitted", { provider });

      // 5. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["survey_responded"] });
      queryClient.invalidateQueries({ queryKey: ["my-contributions"] });
      queryClient.invalidateQueries({ queryKey: ["survey-budget"] });

      setSubmitted(true);
    } catch {
      // fail-silent: don't block the user
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "relative bg-slate-50 border border-slate-200/40 rounded-2xl p-5",
        "transition-opacity duration-300",
        submitting && "opacity-60 pointer-events-none"
      )}
      role="region"
      aria-label="Survey utilizzo calendario"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-slate-500 hover:text-slate-600 transition-colors"
        aria-label="Chiudi survey"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Calendar className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Usi un calendario digitale per la tua attività?
          </p>
          <p className="text-sm text-slate-600 mt-1">
            Stiamo valutando l'integrazione con i calendari esterni. La tua risposta ci aiuta a decidere.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {PROVIDER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className={cn(
                  "bg-white border-slate-200 hover:bg-slate-100 text-sm",
                  showOtherInput && option.value === "other" && "ring-2 ring-slate-400"
                )}
                onClick={() => handleSelectProvider(option.value)}
                disabled={submitting}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {showOtherInput && (
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Quale calendario usi?"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
                autoFocus
                disabled={submitting}
              />
              <Button
                size="sm"
                className="text-sm"
                onClick={() => handleSelectProvider("other", otherText)}
                disabled={submitting || !otherText.trim()}
              >
                Invia
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
