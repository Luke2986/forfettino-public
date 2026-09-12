import { useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SpotlightCard — mouse-tracking glow wrapper for dashboard cards.
 *
 * Adds a subtle radial gradient glow that follows the cursor along
 * the card border. Uses CSS custom properties + `::before`/`::after`
 * pseudo-elements with `mask-composite: intersect` for a border-only effect.
 *
 * Usage: wrap any card component, pass `glowColor` to pick the hue.
 *
 * Epic 13 — Dashboard Redesign / Spotlight Effect
 */

/** Available glow color presets */
export type GlowColor = "teal" | "blue" | "amber" | "violet" | "stone" | "slate";

/** HSL base/spread values per color */
const GLOW_COLORS: Record<GlowColor, { base: string; spread: string }> = {
  teal:   { base: "173, 65%, 40%", spread: "173, 50%, 70%" },
  blue:   { base: "217, 70%, 55%", spread: "217, 60%, 75%" },
  amber:  { base: "38, 85%, 50%",  spread: "38, 80%, 70%" },
  violet: { base: "263, 55%, 55%", spread: "263, 45%, 72%" },
  stone:  { base: "30, 10%, 50%",  spread: "30, 8%, 65%" },
  slate:  { base: "215, 16%, 55%", spread: "215, 12%, 70%" },
};

interface SpotlightCardProps {
  /** Which glow color to use */
  glowColor: GlowColor;
  /** Children — the actual card */
  children: ReactNode;
  /** Extra classes on the wrapper */
  className?: string;
}

export function SpotlightCard({ glowColor, children, className }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
  }, []);

  const colors = GLOW_COLORS[glowColor];

  return (
    <div
      ref={ref}
      className={cn("spotlight-card", className)}
      onPointerMove={handlePointerMove}
      style={{
        "--base": colors.base,
        "--spread": colors.spread,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
