import { useNavigate } from "react-router-dom";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import { X } from "lucide-react";
import { trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";

export function OnboardingBanner() {
  const { items, percentage, isComplete, isDismissed, isLoading, dismiss } =
    useOnboardingChecklist();
  const navigate = useNavigate();

  if (isLoading || isDismissed || isComplete || items.length === 0) {
    return null;
  }

  const completedCount = items.filter((i) => i.completed).length;

  const handleDismiss = () => {
    trackAnonymous(ANALYTICS_EVENTS.CHECKLIST_DISMISSED);
    dismiss();
  };

  return (
    <div className="relative squircle-lg bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/30 dark:to-background border border-border/60 shadow-md p-6 sm:p-8 mb-8">
      {/* Dismiss X — discreto, in alto a destra */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 rounded-full p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors"
        aria-label="Chiudi banner"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-8">
        {/* Testo a sinistra */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
            Benvenuto in Forfettino!
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
            Permettici di dare il nostro meglio, configura l'account con pochi clic e iniziamo.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
            {completedCount} di {items.length} completati ({percentage}%)
          </p>
        </div>

        {/* CTA a destra */}
        <button
          onClick={() => navigate("/impostazioni")}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          Cominciamo
        </button>
      </div>
    </div>
  );
}
