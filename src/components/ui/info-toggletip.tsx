import { useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface InfoToggletipProps {
  /** Contenuto informativo mostrato al tap (mobile) o all'hover (desktop) */
  content: ReactNode;
  /** Il trigger: deve essere un singolo elemento focusabile (passato via asChild) */
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Classi del contenuto; default allineati al precedente GlossarioTooltip */
  contentClassName?: string;
}

/**
 * InfoToggletip — informazione contestuale che funziona anche al tocco.
 *
 * Desktop: Tooltip (hover). Mobile: Popover (tap).
 *
 * PERCHE' ESISTE: Radix Tooltip ignora il touch BY DESIGN. Su touch apre sul
 * pointerenter sintetizzato e lo chiude subito col proprio onPointerDown sul
 * Trigger — l'utente vede il contenuto per una frazione di secondo. Non esiste
 * prop che lo abiliti. Il maintainer Radix lo conferma in
 * radix-ui/primitives#955 ("Tooltips are problematic on touch devices because
 * there is no hover interaction" / "a Popover is probably more appropriate
 * then") e l'issue #2589 e' chiusa come "Resolution: Expected Behaviour".
 * NB: i doc ufficiali Radix non menzionano il touch: e' guidance del
 * maintainer in triage, non policy documentata.
 *
 * "Toggletip" e non "tooltip" perche' e' il nome corretto del pattern
 * tap-to-reveal: il contenuto resta finche' non lo si chiude.
 *
 * Story 87-1 (feedback tester DD26264GD). Estratto da GlossarioTooltip.
 *
 * ATTENZIONE: il trigger deve essere focusabile (un <button>, non uno <span>):
 * su mobile e' l'unico modo per aprire il contenuto.
 */
export function InfoToggletip({
  content,
  children,
  side = "top",
  contentClassName = "max-w-xs text-sm",
}: InfoToggletipProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Il toggletip vive spesso dentro card cliccabili: il tap non deve far
  // scattare l'azione del contenitore. Il Popover interagisce in fase
  // pointerdown, quindi fermare il solo click non basta.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild onClick={stop} onPointerDown={stop}>
          {children}
        </PopoverTrigger>
        <PopoverContent className={contentClassName} side={side} onClick={stop}>
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild onClick={stop} onPointerDown={stop}>
          {children}
        </TooltipTrigger>
        <TooltipContent className={contentClassName} side={side}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
