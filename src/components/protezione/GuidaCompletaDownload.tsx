import { useRef, useEffect } from "react";
import { ChevronLeft, BookOpen, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtezioneDisclaimer } from "./ProtezioneDisclaimer";
import {
  GUIDA_COMPLETA_CONFIG,
  guidaCompletaCapitoli,
} from "@/data/protezione-content";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

interface GuidaCompletaDownloadProps {
  onBack: () => void;
}

export function GuidaCompletaDownload({ onBack }: GuidaCompletaDownloadProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleDownloadClick = () => {
    track(ANALYTICS_EVENTS.GUIDE_PDF_DOWNLOADED, {
      version: GUIDA_COMPLETA_CONFIG.version,
      edition: GUIDA_COMPLETA_CONFIG.edition,
      source: "download-page",
    });
  };

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
            <span className="text-xs font-medium bg-teal-50 text-teal-700 rounded-full px-2 py-0.5 mt-1 inline-block">
              Edizione: {GUIDA_COMPLETA_CONFIG.edition}
            </span>
          </div>
        </div>
      </div>

      {/* Indice capitoli */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Indice
        </h3>
        <div className="space-y-2">
          {guidaCompletaCapitoli.map((cap) => (
            <div
              key={cap.num}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3"
            >
              <span className="text-xs font-bold text-teal-600 bg-teal-50 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                {cap.num}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
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

      {/* Info */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span>
          {GUIDA_COMPLETA_CONFIG.pageCount} pagine &middot; Provider reali
          &middot; Link diretti &middot; Fasce prezzo
        </span>
      </div>

      {/* Download button */}
      <Button asChild className="w-full bg-teal-600 hover:bg-teal-700 active:scale-[0.98]">
        <a
          href={GUIDA_COMPLETA_CONFIG.pdfPath}
          download="guida-protezione-freelancer.pdf"
          onClick={handleDownloadClick}
        >
          <Download className="h-4 w-4" />
          Scarica la Guida (PDF)
        </a>
      </Button>

      {/* Disclaimer */}
      <ProtezioneDisclaimer />
    </div>
  );
}
