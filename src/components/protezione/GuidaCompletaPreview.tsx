import { useRef, useEffect } from "react";
import { ChevronLeft, BookOpen, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtezioneDisclaimer } from "./ProtezioneDisclaimer";
import { guidaCompletaCapitoli } from "@/data/protezione-content";
import { trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";

interface GuidaCompletaPreviewProps {
  onBack: () => void;
}

export function GuidaCompletaPreview({ onBack }: GuidaCompletaPreviewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    trackAnonymous(ANALYTICS_EVENTS.GUIDE_PDF_PREVIEW_VIEWED);
  }, []);

  return (
    <div className="space-y-8">
      {/* Back button + title */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Torna indietro
        </Button>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-50 p-2.5 flex-shrink-0">
            <BookOpen className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-bold text-slate-900 outline-none"
            >
              Guida Completa alla Protezione Freelancer
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 mt-1">
              <Sparkles className="h-3 w-3" /> Pro
            </span>
          </div>
        </div>
      </div>

      {/* Indice capitoli (preview read-only) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Contenuto della guida
        </h3>
        <div className="space-y-2">
          {guidaCompletaCapitoli.map((cap) => (
            <div
              key={cap.num}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
            >
              <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                {cap.num}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">
                  {cap.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Pro upgrade */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
        <Lock className="h-5 w-5 text-slate-500 shrink-0" />
        <div>
          <p className="font-medium text-slate-800">Scarica la Guida Completa (PDF)</p>
          <p className="text-sm text-slate-500">
            Funzionalità in arrivo per la community dei Forfettini.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <ProtezioneDisclaimer />
    </div>
  );
}
