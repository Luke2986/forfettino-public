import { useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { track } from "@/lib/analytics";

interface FirstIncomeBannerProps {
  spendable: number;
  futureObligations: number;
  nextYear: number;
  onDismiss: () => void;
}

export function FirstIncomeBanner({
  spendable,
  futureObligations,
  nextYear,
  onDismiss,
}: FirstIncomeBannerProps) {
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    track("aha_banner_shown", {
      spendable,
      futureObligations,
    });
  }, [spendable, futureObligations]);

  const hasObligations = futureObligations > 0;

  // Determine grid cols based on available data
  const visibleCards = 1 + (hasObligations ? 1 : 0);
  const gridClass =
    visibleCards === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1";

  return (
    <div
      className="relative squircle-md bg-gradient-to-r from-teal-50 to-amber-50 border border-teal-200/60 p-5"
      data-testid="first-income-banner"
    >
      {/* Dismiss X */}
      <button
        onClick={() => {
          track("aha_banner_dismissed");
          onDismiss();
        }}
        className="absolute top-3 right-3 rounded-full p-1 text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Chiudi banner"
        data-testid="aha-dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Title */}
      <div className="flex items-center gap-2 mb-4 pr-8">
        <Sparkles className="h-5 w-5 text-teal-600 shrink-0" />
        <h3 className="text-base font-semibold text-slate-800">
          Il tuo primo incasso è registrato!
        </h3>
      </div>

      {/* 3 mini-cards */}
      <div className={`grid ${gridClass} gap-3 mb-4`}>
        {/* Card 1: Netto Spendibile */}
        <div className="bg-white/80 rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-teal-700 tabular-nums">
            {formatCurrency(spendable)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Puoi spendere oggi</p>
        </div>

        {/* Card 2: Uscite future */}
        {hasObligations && (
          <div className="bg-white/80 rounded-lg p-4 text-center">
            <p className="text-xl font-bold text-amber-600 tabular-nums">
              {formatCurrency(futureObligations)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Pagherai nel {nextYear}
            </p>
          </div>
        )}

      </div>

      {/* Educational footer */}
      <p className="text-xs text-slate-500">
        {hasObligations
          ? "Nel forfettario le tasse si pagano l'anno dopo. Clicca sulle card sopra per esplorare i dettagli."
          : "Continua a registrare i tuoi incassi per vedere le proiezioni fiscali."}
      </p>
    </div>
  );
}
