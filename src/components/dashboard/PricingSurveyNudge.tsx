import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIncomeStats } from "@/hooks/useIncomeStats";
import { Button } from "@/components/ui/button";
import { MessageCircleHeart } from "lucide-react";
import { PricingSurveyDialog } from "./PricingSurveyDialog";
import { useNpsEligibility } from "@/hooks/useNpsEligibility";

const SURVEY_KEY = "pricing_van_westendorp_v1";
const MIN_DAYS_REGISTERED = 14;
const MAX_DISMISS_COUNT = 3;
const DISMISS_COOLDOWN_DAYS = 7;

const LS_DISMISS_COUNT = "forfettino:pricing-nudge-dismiss-count";
const LS_DISMISS_AT = "forfettino:pricing-nudge-dismiss-at";

function getDismissCount(): number {
  try {
    return parseInt(localStorage.getItem(LS_DISMISS_COUNT) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function getDismissAt(): number {
  try {
    return parseInt(localStorage.getItem(LS_DISMISS_AT) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function PricingSurveyNudge() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: incomeStats } = useIncomeStats();

  // NPS campaign takes priority over pricing nudge — hide if NPS campaign is active
  const { activeCampaign: npsActiveCampaign, isLoading: npsLoading } = useNpsEligibility();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Check if user already responded to pricing survey (ever — no cooldown, one-time)
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
      if (error) return true; // fail-closed: hide nudge if query fails (showing it to someone who already responded is worse)
      return data && data.length > 0;
    },
    enabled: !!user,
  });

  const shouldShow = (() => {
    if (!user || !profile || !incomeStats || checkingResponse || npsLoading) return false;
    if (dismissed || completed) return false;
    if (hasResponded) return false;
    // NPS campaign active → pricing nudge yields priority
    if (npsActiveCampaign) return false;

    // Must have at least 3 incassi (validated active user, not just a curious visitor)
    if (incomeStats.count_total < 3) return false;

    // Must be registered for at least 14 days
    // created_at may be "2026-01-01" or "2026-01-01T14:30:00+00:00" — normalize.
    // Guard against profile loaded with missing created_at (e.g. partial fetch in tests).
    if (!profile.created_at) return false;
    const profileCreated = new Date(profile.created_at.split("T")[0] + "T00:00:00");
    const daysSinceSignup = (Date.now() - profileCreated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSignup < MIN_DAYS_REGISTERED) return false;

    // localStorage dismiss checks
    const dismissCount = getDismissCount();
    if (dismissCount >= MAX_DISMISS_COUNT) return false;

    const dismissAt = getDismissAt();
    if (dismissAt > 0) {
      const daysSinceDismiss = (Date.now() - dismissAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < DISMISS_COOLDOWN_DAYS) return false;
    }

    return true;
  })();

  if (!shouldShow) return null;

  const handleDismiss = () => {
    try {
      const currentCount = getDismissCount();
      localStorage.setItem(LS_DISMISS_COUNT, String(currentCount + 1));
      localStorage.setItem(LS_DISMISS_AT, String(Date.now()));
    } catch {
      // localStorage unavailable — dismiss anyway
    }
    setDismissed(true);
  };

  const handleComplete = () => {
    setCompleted(true);
  };

  return (
    <>
      <div
        className="squircle-md border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-4"
        role="region"
        aria-label="Survey sul prezzo"
      >
        <div className="flex items-start gap-3">
          <MessageCircleHeart className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Forfettino resterà gratuito. Sto costruendo il Pro.
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Incassi illimitati, visualizzazione multi-anno fatturato, sync calendario, simulatore preventivi e altro. Mi aiuti a trovare il prezzo giusto? (30 sec)
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="default"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                Rispondi
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
              >
                Non ora
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PricingSurveyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onComplete={handleComplete}
      />
    </>
  );
}
