import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConcentrationLevel } from "@/lib/client-analytics";

interface ConcentrationAlertProps {
  concentration: ConcentrationLevel;
  topClientPct: number;
  topClientName: string;
  entityLabel?: string;
}

export function ConcentrationAlert({
  concentration,
  topClientPct,
  topClientName,
  entityLabel = "cliente",
}: ConcentrationAlertProps) {
  const [animated, setAnimated] = useState(false);
  const pct = Math.round(topClientPct);
  const isVisible =
    concentration === "molto_concentrato" || concentration === "concentrato";

  useEffect(() => {
    if (!isVisible) return;
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const barColor =
    pct >= 75 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-teal-400";

  return (
    <div className="flex items-start gap-3 rounded-lg px-4 py-3 bg-amber-50 border border-amber-200/60">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-amber-800">
          {concentration === "molto_concentrato" ? (
            <>
              Il {pct}% del fatturato dipende da{" "}
              <span className="font-semibold">{topClientName}</span>.
            </>
          ) : (
            <>
              <span className="font-semibold">{topClientName}</span>{" "}
              rappresenta il {pct}% del fatturato.
            </>
          )}
        </p>
        <div
          className="h-2 rounded-full bg-slate-100 overflow-hidden"
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Concentrazione: ${pct}% del fatturato dal primo ${entityLabel}`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              barColor
            )}
            style={{ width: animated ? `${pct}%` : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}
