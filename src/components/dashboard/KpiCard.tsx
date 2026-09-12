import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Squircle } from "@/components/ui/squircle";
import { InfoToggletip } from "@/components/ui/info-toggletip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Maps accentColor Tailwind class keys to rgba gradient colors.
 * The gradient is diagonal (bottom-left → top-right), calibrated at ~30% opacity.
 */
const ACCENT_GRADIENTS: Record<string, string> = {
  "border-l-blue-300": "rgba(147, 197, 253, 0.30)",
  "border-l-amber-400": "rgba(251, 191, 36, 0.30)",
  "border-l-violet-400": "rgba(167, 139, 250, 0.30)",
};

/**
 * Pure helper: computes the inline-style for a KpiCard inner Squircle background.
 * Uses longhand `backgroundImage` + `backgroundColor` (instead of `background`
 * shorthand) so the value is testable in jsdom and equivalent at runtime.
 *
 * Exported for unit testing — the real KpiCard renders this object on the
 * inner `<Squircle>`. Epic 81 — Story 81-2.
 */
export function getKpiCardBackgroundStyle(
  accentColor: string | undefined,
): React.CSSProperties {
  const gradientColor = accentColor ? ACCENT_GRADIENTS[accentColor] ?? "transparent" : "transparent";
  if (gradientColor === "transparent") {
    return { backgroundColor: "white" };
  }
  return {
    backgroundImage: `linear-gradient(to top right, ${gradientColor} 0%, transparent 55%)`,
    backgroundColor: "white",
  };
}

interface KpiCardProps {
  label: string;
  value: string;
  /** Key for the diagonal gradient color (e.g. "border-l-blue-300"). Maps via ACCENT_GRADIENTS. */
  accentColor?: string;
  /** Tailwind text color class for the value (e.g. "text-amber-700") */
  valueColor?: string;
  /** Tooltip text for the info icon */
  helpText?: string;
  /** Full breakdown content rendered inside the sheet */
  breakdownContent?: React.ReactNode;
  /** Sheet title (defaults to label) */
  breakdownTitle?: string;
  /** Subtitle shown below the Sheet title */
  breakdownSubtitle?: string;
  /** Short subtitle below the card label (e.g. temporal context) */
  subtitle?: string;
  /** Click handler (used instead of sheet if provided) */
  onClick?: () => void;
  /** Always-visible extra content below the value */
  alwaysVisibleContent?: React.ReactNode;
  className?: string;
  /** @deprecated — kept for backward compat, ignored in v3 uniform layout */
  variant?: "hero" | "secondary";
  /** @deprecated — kept for backward compat, ignored in v3 */
  heroSubline?: string;
  /** @deprecated — kept for backward compat, ignored in v3 */
  animationDelay?: number;
}

export function KpiCard({
  label,
  value,
  accentColor,
  valueColor,
  helpText,
  breakdownContent,
  breakdownTitle,
  breakdownSubtitle,
  subtitle,
  onClick,
  alwaysVisibleContent,
  className,
}: KpiCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasSheet = !!breakdownContent && !onClick;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (hasSheet) {
      setSheetOpen(true);
    }
  };

  const keyHandler = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const sheetMarkup = hasSheet ? (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{breakdownTitle || label}</SheetTitle>
          {breakdownSubtitle && <p className="text-sm text-muted-foreground mt-1">{breakdownSubtitle}</p>}
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {breakdownContent}
        </div>
      </SheetContent>
    </Sheet>
  ) : null;

  const cardBackgroundStyle = getKpiCardBackgroundStyle(accentColor);
  const isInteractive = hasSheet || !!onClick;

  return (
    <>
      {/*
        Epic 81 — Squircle wrapper pattern:
        outer <div> retains ring shadow + hover + focus + click handlers
        (clip-path on inner Squircle would clip the ring shadow). Inner
        <Squircle> renders the diagonal gradient background + padding inside
        the iOS-style superellipse shape. Background gradient is a CSS
        property of the inner element so it is rendered within the squircle
        clip — NOT clipped away.
      */}
      <div
        className={cn(
          "rounded-2xl border-0",
          "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]",
          "transition-all duration-150",
          isInteractive
            ? "hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(23,23,23,0.08)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            : null,
          className,
        )}
        data-testid={`kpi-${label}`}
        onClick={isInteractive ? handleClick : undefined}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={isInteractive ? keyHandler : undefined}
      >
        <Squircle
          radius={16}
          smoothing={0.6}
          className="p-4 sm:p-5 flex flex-col justify-center"
          style={cardBackgroundStyle}
        >
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-1">
            <p className={cn("text-xl font-bold tabular-nums leading-tight", valueColor || "text-slate-800")}>{value}</p>
            {helpText && (
              <InfoToggletip content={<p className="text-sm">{helpText}</p>}>
                <button
                  type="button"
                  className="rounded-full min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-slate-500 hover:text-slate-700 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label="Informazioni"
                >
                  <Info className="h-3 w-3" />
                </button>
              </InfoToggletip>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1.5 leading-snug">{label}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{subtitle}</p>}
          {alwaysVisibleContent}
        </CardContent>
        </Squircle>
      </div>
      {sheetMarkup}
    </>
  );
}
