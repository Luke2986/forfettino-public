import { useState, useEffect } from "react";
import { usePublicUserCount } from "@/hooks/usePublicUserCount";
import { cn } from "@/lib/utils";

export function UserCountBadge({ className }: { className?: string }) {
  const { count } = usePublicUserCount();
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    if (!count) return;

    // Respect prefers-reduced-motion: skip counter animation
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplayCount(count);
      return;
    }

    const duration = 1000;
    const steps = 30;
    const increment = count / steps;
    const stepTime = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= count) {
        setDisplayCount(count);
        clearInterval(timer);
      } else {
        setDisplayCount(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [count]);

  if (!count) return null;

  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs sm:text-sm font-semibold shadow-sm", className)}>
      <span className="relative flex h-2 w-2">
        <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      {displayCount} utenti
    </span>
  );
}
