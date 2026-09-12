import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StorySlideRendered {
  id: string;
  content: ReactNode;
}

interface StoryCardProps {
  slides: StorySlideRendered[];
  onBack?: () => void;
  onComplete?: () => void;
}

/**
 * Componente riutilizzabile per percorsi a micro-schede (Stories tap-to-advance).
 * Stato semplice con CSS transitions — testabile, prevedibile per altezze variabili.
 * Riusabile per Story 21.3 (RC Professionale).
 */
export function StoryCard({ slides, onBack, onComplete }: StoryCardProps) {
  const [current, setCurrent] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Bound current to valid range when slides change
  const safeCurrent = Math.min(current, Math.max(slides.length - 1, 0));
  if (safeCurrent !== current) setCurrent(safeCurrent);

  useEffect(() => {
    contentRef.current?.focus();
  }, [current]);

  // Keyboard navigation for ARIA tablist
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (safeCurrent < slides.length - 1) setCurrent(safeCurrent + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (safeCurrent > 0) setCurrent(safeCurrent - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setCurrent(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setCurrent(slides.length - 1);
    }
  };

  if (slides.length === 0) return null;

  const isFirst = safeCurrent === 0;
  const isLast = safeCurrent === slides.length - 1;

  const goNext = () => {
    if (!isLast) setCurrent((c) => c + 1);
  };
  const goPrev = () => {
    if (!isFirst) setCurrent((c) => c - 1);
  };

  return (
    <div className="space-y-6">
      {/* Indicatore progresso — pallini */}
      <div
        className="flex items-center justify-center gap-2"
        role="tablist"
        aria-label="Progresso schede"
        onKeyDown={handleKeyDown}
      >
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            tabIndex={i === safeCurrent ? 0 : -1}
            aria-selected={i === safeCurrent}
            aria-label={`Scheda ${i + 1} di ${slides.length}`}
            onClick={() => setCurrent(i)}
            className={cn(
              "h-2.5 rounded-full transition-all duration-300",
              i === safeCurrent
                ? "w-8 bg-teal-500"
                : "w-2.5 bg-slate-300 hover:bg-slate-400",
            )}
          />
        ))}
      </div>

      {/* Contenuto scheda — fade transition via key remount */}
      <div
        key={slides[safeCurrent].id}
        ref={contentRef}
        tabIndex={-1}
        className="outline-none rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[200px] animate-fade-in"
        role="tabpanel"
        aria-label={`Scheda ${safeCurrent + 1}`}
      >
        {slides[safeCurrent].content}
      </div>

      {/* Navigazione */}
      <div className="flex items-center justify-between">
        {onBack && isFirst ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Torna indietro
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={isFirst}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Indietro
          </Button>
        )}

        <span className="text-xs text-slate-500">
          {safeCurrent + 1} / {slides.length}
        </span>

        {isLast && (onBack || onComplete) ? (
          <Button variant="ghost" size="sm" onClick={() => { onComplete?.(); onBack?.(); }}>
            Chiudi
          </Button>
        ) : !isLast ? (
          <Button variant="default" size="sm" onClick={goNext}>
            Avanti
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
