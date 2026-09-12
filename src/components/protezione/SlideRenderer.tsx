import type { ReactNode } from "react";
import { glossarioTermini } from "@/data/protezione-content";
import type { SlideContentData } from "@/data/protezione-content";
import { GlossarioTooltip } from "./GlossarioTooltip";

// ── Glossario auto-enrichment — wraps matching terms with GlossarioTooltip ──
// NOTE: regex compiled once at module load — safe because glossarioTermini is
// a static const (no dynamic/admin terms). If it ever becomes dynamic, convert
// to a memoised factory function.

const glossarioTerms = Object.keys(glossarioTermini).sort((a, b) => b.length - a.length);
const glossarioRegex = new RegExp(`\\b(${glossarioTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");

/**
 * Prende una stringa e restituisce un array di ReactNode con i termini
 * del glossario wrappati in GlossarioTooltip. Ogni termine viene wrappato
 * solo alla prima occorrenza nel paragrafo.
 */
export function enrichWithGlossario(text: string): ReactNode {
  const matched = new Set<string>();
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(glossarioRegex)) {
    const termLower = match[0].toLowerCase();
    if (matched.has(termLower)) continue;
    matched.add(termLower);

    const idx = match.index;
    if (idx === undefined) continue;
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <GlossarioTooltip key={`g-${idx}`} term={termLower}>
        {match[0]}
      </GlossarioTooltip>,
    );
    lastIndex = idx + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

// ── Slide renderer — trasforma i dati in JSX con GlossarioTooltip ──

interface SlideContentProps {
  slide: SlideContentData;
  /** Callback per navigare alla Checklist di Protezione (dalla slide CTA) */
  onNavigateToChecklist?: () => void;
}

export function SlideContent({ slide, onNavigateToChecklist }: SlideContentProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        {slide.emoji && <span className="text-3xl">{slide.emoji}</span>}
        <h3 className="text-lg font-bold text-slate-900">{slide.title}</h3>
        {slide.subtitle && (
          <p className="text-sm text-slate-500">{slide.subtitle}</p>
        )}
      </div>

      {/* Paragraphs — con auto-enrichment glossario */}
      {slide.paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-slate-700 leading-relaxed">
          {enrichWithGlossario(p)}
        </p>
      ))}

      {/* Highlight box */}
      {slide.highlight && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 p-4">
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">
            {slide.highlight.label}
          </p>
          <p className="text-sm text-teal-800 leading-relaxed">
            {enrichWithGlossario(slide.highlight.value)}
          </p>
        </div>
      )}

      {/* Table */}
      {slide.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {slide.table.headers.map((h) => (
                  <th
                    key={h}
                    className="py-2 pr-4 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.table.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="py-2 pr-4 text-slate-700"
                    >
                      {enrichWithGlossario(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note */}
      {slide.note && (
        <p className="text-xs text-slate-500 italic">{slide.note}</p>
      )}

      {/* CTA dell'ultima scheda — solo testo + "parlane col commercialista" */}
      {slide.cta && (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-500 text-center">
            Parlane con il tuo commercialista per scegliere la soluzione più adatta.
          </p>
        </div>
      )}
    </div>
  );
}
