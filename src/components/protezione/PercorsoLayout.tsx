import { useMemo } from "react";
import type { SlideContentData, FaqItem } from "@/data/protezione-content";
import type { StorySlideRendered } from "./StoryCard";
import { StoryCard } from "./StoryCard";
import { FaqSection } from "./FaqSection";
import { SlideContent } from "./SlideRenderer";
import { ProtezioneDisclaimer } from "./ProtezioneDisclaimer";

interface PercorsoLayoutProps {
  title: string;
  subtitle: string;
  slides: SlideContentData[];
  faqs: FaqItem[];
  onBack: () => void;
  /** Callback per navigare alla Checklist dalla slide CTA */
  onNavigateToChecklist?: () => void;
}

/**
 * Layout condiviso per tutti i percorsi educativi (infortuni, RC, pensione…).
 * Compone: titolo → StoryCard → glossario hint → FaqSection → ProtezioneDisclaimer.
 */
export function PercorsoLayout({
  title,
  subtitle,
  slides,
  faqs,
  onBack,
  onNavigateToChecklist,
}: PercorsoLayoutProps) {
  const renderedSlides: StorySlideRendered[] = useMemo(
    () =>
      slides.map((slide) => ({
        id: slide.id,
        content: <SlideContent slide={slide} onNavigateToChecklist={onNavigateToChecklist} />,
      })),
    [slides, onNavigateToChecklist],
  );

  return (
    <div className="space-y-8">
      {/* Titolo percorso */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      {/* Micro-schede Stories */}
      <StoryCard slides={renderedSlides} onBack={onBack} />

      {/* Glossario inline hint */}
      <div className="text-center">
        <p className="text-xs text-slate-500">
          Termini{" "}
          <span className="border-b border-dashed border-slate-400">
            sottolineati
          </span>
          ? Tocca o passa il mouse per la definizione.
        </p>
      </div>

      {/* FAQ */}
      <FaqSection faqs={faqs} />

      {/* Disclaimer */}
      <ProtezioneDisclaimer />
    </div>
  );
}
