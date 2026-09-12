import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { checklistItems } from "@/data/protezione-content";
import type { ChecklistItem, Percorso } from "@/data/protezione-content";
import type { ChecklistState } from "@/lib/generateChecklistPdf";

const STORAGE_KEY = "checklist-protezione-states";

interface ChecklistProtezioneProps {
  onNavigate?: (percorso: Percorso) => void;
  /** Callback per scrollare alla sezione Pensione Integrativa (gestita dal parent) */
  onScrollToPensione?: () => void;
}

/** Segmented control: 3 pulsanti sempre visibili per ogni voce */
const segments: Array<{
  value: ChecklistState;
  label: string;
  activeClass: string;
}> = [
  {
    value: "ho",
    label: "Ce l'ho",
    activeClass: "bg-green-100 text-green-800 border-green-300 font-semibold",
  },
  {
    value: "non-so",
    label: "Non so",
    activeClass: "bg-slate-100 text-slate-700 border-slate-300 font-semibold",
  },
  {
    value: "non-ho",
    label: "Non ce l'ho",
    activeClass: "bg-red-100 text-red-800 border-red-300 font-semibold",
  },
];

const inactiveSegmentClass =
  "bg-white text-slate-500 border-transparent hover:bg-slate-50";

/** Border-left accent per categoria — stessi colori delle card nell'hub GuidePerTe */
const categoryAccent: Record<string, string> = {
  // Shield — Protezione del reddito (teal)
  infortuni: "border-l-[3px] border-l-teal-500",
  mutua: "border-l-[3px] border-l-teal-500",
  // Scale — Protezione del patrimonio (amber)
  rc: "border-l-[3px] border-l-amber-500",
  "tutela-legale": "border-l-[3px] border-l-amber-500",
  cyber: "border-l-[3px] border-l-amber-500",
  // Landmark — Previdenza (indigo)
  pensione: "border-l-[3px] border-l-indigo-500",
  // Heart — Famiglia (rose)
  tcm: "border-l-[3px] border-l-rose-500",
};

const defaultStates = (): Record<string, ChecklistState> =>
  Object.fromEntries(checklistItems.map((item) => [item.id, "non-so" as ChecklistState]));

export function ChecklistProtezione({ onNavigate, onScrollToPensione }: ChecklistProtezioneProps) {
  const [states, setStates] = useState<Record<string, ChecklistState>>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, ChecklistState>;
        if (checklistItems.every((item) => item.id in parsed)) return parsed;
      }
    } catch {
      /* ignore -- SSR or unavailable sessionStorage */
    }
    return defaultStates();
  });

  // Persist checklist state to sessionStorage so it survives navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch {
      /* ignore */
    }
  }, [states]);

  const activeCount = Object.values(states).filter((s) => s === "ho").length;

  const handleSetState = (id: string, value: ChecklistState) => {
    setStates((prev) => ({ ...prev, [id]: value }));
  };

  const handleLink = (item: ChecklistItem) => {
    if (item.linkType === "percorso" && item.linkTarget && onNavigate) {
      onNavigate(item.linkTarget);
    } else if (item.linkType === "pensione" && onScrollToPensione) {
      onScrollToPensione();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900">
          Checklist di Protezione
        </h2>
        <p className="text-sm text-slate-600">
          Indica lo stato di ogni copertura.
        </p>
      </div>

      {/* Badge contatore */}
      <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5">
        <CheckCircle className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-medium text-teal-700">
          {activeCount} su {checklistItems.length} coperture attive
        </span>
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {checklistItems.map((item) => {
          const state = states[item.id] ?? "non-so";

          return (
            <div
              key={item.id}
              className={`rounded-2xl bg-white p-4 overflow-hidden transition-colors
                shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]
                ${categoryAccent[item.id] ?? "border-l-[3px] border-l-slate-300"}
              `}
            >
              {/* Top row: label + price */}
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-slate-800">{item.label}</h3>
                <span className="text-xs text-slate-500 flex-shrink-0">{item.priceRange}</span>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600">{item.description}</p>

              {/* Educational text for coming-soon items */}
              {item.linkType === "coming-soon" && item.educationalText && (
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  {item.educationalText}
                </p>
              )}

              {/* Link */}
              <div className="mt-1.5">
                {item.linkType === "percorso" && (
                  <button
                    type="button"
                    onClick={() => handleLink(item)}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    {item.linkLabel ?? "Approfondisci nel percorso ->"}
                  </button>
                )}
                {item.linkType === "pensione" && (
                  <button
                    type="button"
                    onClick={() => handleLink(item)}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Vai alla sezione Pensione
                  </button>
                )}
                {item.linkType === "coming-soon" && (
                  <span role="status" className="text-sm text-slate-500">
                    Approfondimento in arrivo
                  </span>
                )}
              </div>

              {/* Segmented control */}
              <div
                role="group"
                aria-label={`Stato copertura: ${item.label}`}
                className="mt-3 flex rounded-xl border border-slate-200 overflow-hidden"
              >
                {segments.map((seg) => (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => handleSetState(item.id, seg.value)}
                    aria-pressed={state === seg.value}
                    aria-label={`${item.label}: ${seg.label}`}
                    className={`flex-1 min-h-[36px] py-2 text-sm transition-colors border-r border-slate-200 last:border-r-0
                      ${state === seg.value ? seg.activeClass : inactiveSegmentClass}
                    `}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
