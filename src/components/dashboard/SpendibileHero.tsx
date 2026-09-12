import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Squircle } from "@/components/ui/squircle";
import { InfoToggletip } from "@/components/ui/info-toggletip";
import { Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";

/**
 * SpendibileHero — the primary dashboard component.
 *
 * Shows the net spendable amount prominently with:
 * - Soglia 85k gauge (integrated)
 * - Sheet breakdown on click (same pattern as KpiCard)
 *
 * Epic 13 — Dashboard Redesign 3-Zone Layout
 */

interface SpendibileHeroProps {
  /** Net spendable amount in euros */
  spendable: number;
  /** Soglia 85k: receipts total (for gauge) */
  sogliaIncassi: number;
  /** Soglia 85k: limit (default 85000) */
  sogliaLimite?: number;
  /** Full breakdown content for the sheet */
  breakdownContent?: React.ReactNode;
  /** Tooltip help text */
  helpText?: string;
  /** Highlight ring animation (first income) */
  shouldHighlight?: boolean;
  className?: string;
}

export function SpendibileHero({
  spendable,
  sogliaIncassi,
  sogliaLimite = 85000,
  breakdownContent,
  helpText,
  shouldHighlight = false,
  className,
}: SpendibileHeroProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasSheet = !!breakdownContent;

  // Soglia calculations
  const sogliaPercentuale = Math.min((sogliaIncassi / sogliaLimite) * 100, 100);
  const sogliaRimanenti = Math.max(sogliaLimite - sogliaIncassi, 0);
  const sogliaSuperato = sogliaIncassi > sogliaLimite;

  const sogliaBarColor = sogliaSuperato
    ? "bg-destructive"
    : sogliaPercentuale >= 85
      ? "bg-destructive"
      : sogliaPercentuale >= 70
        ? "bg-warning"
        : "bg-teal-500";

  const handleClick = () => {
    if (hasSheet) setSheetOpen(true);
  };

  const keyHandler = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <>
      {/*
        Epic 81 — Squircle wrapper pattern:
        outer <div> retains shadow + border + focus + click handlers (clip-path
        on inner Squircle would clip them); inner <Squircle> renders the
        gradient background + padding inside the iOS-style superellipse shape.
      */}
      <div
        className={cn(
          "rounded-3xl border border-slate-200/60",
          "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]",
          "transition-all duration-200",
          hasSheet
            ? "hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            : null,
          shouldHighlight && "ring-2 ring-teal-400 ring-offset-2 motion-safe:animate-pulse",
          className,
        )}
        data-testid="spendibile-hero"
        onClick={hasSheet ? handleClick : undefined}
        role={hasSheet ? "button" : undefined}
        tabIndex={hasSheet ? 0 : undefined}
        onKeyDown={hasSheet ? keyHandler : undefined}
        // Story 87-1: helpText non e' piu' ripiegato qui. Prima l'icona info
        // era aria-hidden e l'unico modo di annunciarne il contenuto era
        // includerlo nell'aria-label della card; ora e' un bottone focusabile,
        // quindi ripeterlo lo farebbe annunciare due volte.
        aria-label={
          hasSheet
            ? `Netto Spendibile ${formatCurrency(spendable)}. Apri dettagli.`
            : `Netto Spendibile ${formatCurrency(spendable)}.`
        }
      >
        <Squircle
          radius={24}
          smoothing={0.6}
          className="bg-gradient-to-br from-white via-white to-teal-50/30 p-6 sm:p-8"
        >
        <CardContent className="p-0 space-y-5">
          {/* Caption label + dettagli */}
          <div className="flex items-center justify-between">
            <span className="text-sm sm:text-base font-semibold text-teal-700 uppercase tracking-wider whitespace-nowrap">
              Netto Spendibile
            </span>
            <div className="flex items-center gap-3">
              {helpText && (
                <InfoToggletip content={<p className="text-sm">{helpText}</p>}>
                  <button
                    type="button"
                    className="rounded-full min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-slate-500 hover:text-slate-700 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label="Informazioni"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </InfoToggletip>
              )}
              {hasSheet && (
                <span className="text-sm text-slate-600 flex items-center gap-0.5 hover:text-slate-800 transition-colors">
                  Dettagli
                  <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>

          {/* Hero number — the star of the show */}
          <p className="text-4xl sm:text-5xl font-bold text-slate-900 tabular-nums leading-none tracking-tight">
            {formatCurrency(spendable)}
          </p>

          {/* Soglia 85k — minimal micro-gauge */}
          <div className="pt-1">
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-1.5 rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={Math.round(sogliaPercentuale)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Soglia 85k: ${Math.round(sogliaPercentuale)}% utilizzato`}
              >
                <div
                  className={cn("h-full rounded-full transition-all duration-500", sogliaBarColor)}
                  style={{ width: `${Math.min(sogliaPercentuale, 100)}%` }}
                  data-testid="soglia-bar"
                />
              </div>
              <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                {sogliaSuperato
                  ? "85k superato"
                  : `${sogliaPercentuale.toFixed(0)}% di 85k`}
              </span>
            </div>
          </div>

        </CardContent>
        </Squircle>
      </div>

      {/* Sheet breakdown (same pattern as KpiCard) */}
      {hasSheet && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Netto Spendibile</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {breakdownContent}
            </div>
          </SheetContent>
        </Sheet>
      )}

    </>
  );
}
