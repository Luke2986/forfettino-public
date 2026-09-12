import { BookOpen, Sparkles } from "lucide-react";
import { GUIDA_COMPLETA_CONFIG } from "@/data/protezione-content";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

interface GuidaCompletaCtaProps {
  canExport: boolean;
  source: string;
}

export function GuidaCompletaCta({ canExport, source }: GuidaCompletaCtaProps) {
  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <p className="text-sm text-slate-600 mb-2">Vuoi ancora più dettagli?</p>
      {canExport ? (
        <a
          href={GUIDA_COMPLETA_CONFIG.pdfPath}
          download="guida-protezione-freelancer.pdf"
          onClick={() =>
            track(ANALYTICS_EVENTS.GUIDE_PDF_DOWNLOADED, {
              version: GUIDA_COMPLETA_CONFIG.version,
              edition: GUIDA_COMPLETA_CONFIG.edition,
              source,
            })
          }
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          <BookOpen className="h-4 w-4" />
          Scarica la Guida Completa (PDF)
        </a>
      ) : (
        <span className="text-sm text-slate-500 inline-flex items-center gap-1">
          Guida Completa — disponibile per utenti Pro
          <span className="text-xs font-medium bg-amber-50 text-amber-700 rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5">
            <Sparkles className="h-2.5 w-2.5" /> Pro
          </span>
        </span>
      )}
    </div>
  );
}
