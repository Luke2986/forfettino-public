import type { ReactNode } from "react";
import { glossarioTermini } from "@/data/protezione-content";
import { InfoToggletip } from "@/components/ui/info-toggletip";

interface GlossarioTooltipProps {
  term: string;
  children: ReactNode;
}

/**
 * Glossario pop-up "Forfettarese" — traduce termini assicurativi in italiano potabile.
 * Desktop: Tooltip (hover). Mobile: Popover (tap).
 * Fallback: se il termine non è nel dizionario, renderizza solo i children.
 *
 * Story 87-1: il branch Tooltip/Popover che viveva qui è stato estratto in
 * InfoToggletip, così il pattern esiste una volta sola ed è riusabile.
 */
export function GlossarioTooltip({ term, children }: GlossarioTooltipProps) {
  const definition = glossarioTermini[term.toLowerCase()];

  if (!definition) {
    return <>{children}</>;
  }

  return (
    <InfoToggletip
      side="top"
      contentClassName="w-64 text-sm"
      content={
        <>
          <p className="font-semibold text-slate-700 mb-1 capitalize">{term}</p>
          <p className="text-slate-600 leading-relaxed">{definition}</p>
        </>
      }
    >
      <span className="border-b border-dashed border-slate-400 cursor-help">
        {children}
      </span>
    </InfoToggletip>
  );
}
