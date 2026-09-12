import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Shield,
  Scale,
  Landmark,
  Heart,
  ChevronRight,
  ClipboardCheck,
  BookOpen,
  Sparkles,
  Calculator,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { PercorsoInfortuni } from "@/components/protezione/PercorsoInfortuni";
import { PercorsoRcProfessionale } from "@/components/protezione/PercorsoRcProfessionale";
import { PensioneIntegrativa } from "@/components/protezione/PensioneIntegrativa";
import { ChecklistProtezione } from "@/components/protezione/ChecklistProtezione";
import { GuidaCompletaDownload } from "@/components/protezione/GuidaCompletaDownload";
import { GuidaCompletaPreview } from "@/components/protezione/GuidaCompletaPreview";
import { ProtezioneDisclaimer } from "@/components/protezione/ProtezioneDisclaimer";
import { GestioneSeparataGuida } from "@/components/fisco/GestioneSeparataGuida";
import { MarcaBolloGuida } from "@/components/fisco/MarcaBolloGuida";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/hooks/useSubscription";
import { hubCategoryGroups, GUIDA_COMPLETA_CONFIG } from "@/data/protezione-content";
import type { Percorso, HubCategoryGroup } from "@/data/protezione-content";

type FiscoView = "gestione-separata" | "marca-bollo";
type SelectedView = Percorso | "checklist" | "guida-completa" | FiscoView | null;

const iconMap: Record<HubCategoryGroup["icon"], typeof Shield> = {
  Shield,
  Scale,
  Landmark,
  Heart,
};

/** Colori per ogni macro-area — bordo card, icona header, badge prezzo */
const groupColors: Record<HubCategoryGroup["icon"], {
  border: string;
  icon: string;
  headerBg: string;
  priceBg: string;
  priceText: string;
  hoverBorder: string;
}> = {
  Shield:   { border: "border-l-teal-500",   icon: "text-teal-600",   headerBg: "bg-teal-50",   priceBg: "bg-teal-50",   priceText: "text-teal-700",   hoverBorder: "hover:border-teal-300" },
  Scale:    { border: "border-l-amber-500",   icon: "text-amber-600",  headerBg: "bg-amber-50",  priceBg: "bg-amber-50",  priceText: "text-amber-700",  hoverBorder: "hover:border-amber-300" },
  Landmark: { border: "border-l-indigo-500",  icon: "text-indigo-600", headerBg: "bg-indigo-50", priceBg: "bg-indigo-50", priceText: "text-indigo-700", hoverBorder: "hover:border-indigo-300" },
  Heart:    { border: "border-l-rose-500",    icon: "text-rose-600",   headerBg: "bg-rose-50",   priceBg: "bg-rose-50",   priceText: "text-rose-700",   hoverBorder: "hover:border-rose-300" },
};

export default function GuidePerTe() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { canExport } = useSubscription();
  const [selected, setSelected] = useState<SelectedView>(null);

  // Reset alla pagina iniziale quando si ri-clicca "Guide per te" nella sidebar
  // Oppure apri direttamente una sezione via query param ?fisco=gestione-separata
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fisco = params.get("fisco");
    if (fisco === "gestione-separata") {
      setSelected("gestione-separata");
    } else if (fisco === "marca-bollo") {
      setSelected("marca-bollo");
    } else {
      setSelected(null);
    }
  }, [location.key, location.search]);

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Guide per te" />}
      <PageErrorBoundary>
        <PageContainer narrow className="space-y-8">
          {/* ── Hub: macro-aree raggruppate ── */}
          {!selected && (
            <>
              {/* ── Sezione: Il tuo fisco ── */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-md p-1 bg-slate-100">
                    <Calculator className="h-4 w-4 text-slate-700" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                    Il tuo fisco
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelected("gestione-separata")}
                    className="flex items-start gap-3 rounded-lg border bg-white border-slate-200 border-l-[3px] border-l-slate-500 shadow-sm p-4 text-left transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Gestione Separata INPS
                        </h3>
                        <span className="text-xs font-medium flex-shrink-0 rounded-full px-2 py-0.5 bg-slate-100 text-slate-700">
                          Fondamenti
                        </span>
                      </div>
                      <p className="text-sm mt-1 text-slate-600">
                        Contributi, rivalsa 4%, deducibilita&apos;. Le basi che servono al forfettario.
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-500 opacity-50" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected("marca-bollo")}
                    className="flex items-start gap-3 rounded-lg border bg-white border-slate-200 border-l-[3px] border-l-slate-500 shadow-sm p-4 text-left transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Marca da bollo
                        </h3>
                        <span className="text-xs font-medium flex-shrink-0 rounded-full px-2 py-0.5 bg-slate-100 text-slate-700">
                          Fondamenti
                        </span>
                      </div>
                      <p className="text-sm mt-1 text-slate-600">
                        Quando serve il bollo da 2&nbsp;&euro; e cosa cambia se lo addebiti al cliente.
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-500 opacity-50" />
                  </button>
                </div>
              </div>

              {/* ── Sezione: Protezione ── */}
              <div className="text-center space-y-2 pt-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  Proteggi il tuo lavoro
                </h1>
                <p className="text-base text-slate-600">
                  Le coperture che contano per chi lavora in proprio.
                </p>
              </div>

              {/* Categorie */}
              <div className="space-y-6">
                {hubCategoryGroups.map((group) => {
                  const Icon = iconMap[group.icon];
                  const colors = groupColors[group.icon];
                  return (
                    <div key={group.title} className="space-y-3">
                      {/* Section header */}
                      <div className="flex items-center gap-2">
                        <div className={`rounded-md p-1 ${colors.headerBg}`}>
                          <Icon className={`h-4 w-4 ${colors.icon}`} />
                        </div>
                        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                          {group.title}
                        </h2>
                      </div>

                      {/* Card grid */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={!item.available}
                            onClick={() => item.target && setSelected(item.target)}
                            className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                              item.available
                                ? `bg-white border-slate-200 border-l-[3px] ${colors.border} shadow-sm ${colors.hoverBorder} hover:shadow-md active:scale-[0.98] cursor-pointer`
                                : "bg-slate-50/80 border-dashed border-slate-200 cursor-default"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <h3 className={`text-sm font-semibold ${item.available ? "text-slate-800" : "text-slate-500"}`}>
                                  {item.label}
                                </h3>
                                {item.available ? (
                                  <span className={`text-xs font-medium flex-shrink-0 rounded-full px-2 py-0.5 ${colors.priceBg} ${colors.priceText}`}>
                                    {item.priceRange}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500 flex-shrink-0">
                                    {item.priceRange}
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm mt-1 ${item.available ? "text-slate-600" : "text-slate-500"}`}>
                                {item.description}
                              </p>
                              {!item.available && (
                                <span className="text-xs text-slate-500 mt-1.5 inline-flex items-center gap-1">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  In arrivo
                                </span>
                              )}
                            </div>
                            {item.available && (
                              <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-0.5 ${colors.icon} opacity-50`} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Risorse ── */}
              <div className="rounded-2xl bg-stone-50 border border-stone-200/40 p-5 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Risorse
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Checklist interattiva */}
                  <button
                    type="button"
                    onClick={() => setSelected("checklist")}
                    className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-left transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(23,23,23,0.07)] active:scale-[0.98]"
                  >
                    <ClipboardCheck className="h-5 w-5 text-teal-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        Checklist di Protezione
                      </p>
                      <p className="text-sm text-slate-500">
                        Verifica e scarica il PDF
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 ml-auto flex-shrink-0" />
                  </button>

                  {/* Guida Completa — cliccabile per tutti (Pro/Free) */}
                  <button
                    type="button"
                    onClick={() => setSelected("guida-completa")}
                    className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-left transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(23,23,23,0.07)] active:scale-[0.98]"
                  >
                    <BookOpen className="h-5 w-5 text-teal-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          Guida Completa
                        </p>
                        {!canExport && (
                          <span
                            className="text-xs font-medium bg-amber-50 text-amber-700 rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5 border border-amber-100"
                            aria-label="Funzionalita riservata agli abbonati Pro"
                          >
                            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> Pro
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {GUIDA_COMPLETA_CONFIG.pageCount} pagine, provider reali
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 ml-auto flex-shrink-0" />
                  </button>
                </div>
              </div>

              <ProtezioneDisclaimer />
            </>
          )}

          {/* ── Percorso Infortuni/Malattia ── */}
          {selected === "infortuni" && (
            <PercorsoInfortuni
              onBack={() => setSelected(null)}
              onNavigateToChecklist={() => setSelected("checklist")}
            />
          )}

          {/* ── Percorso RC Professionale ── */}
          {selected === "rc" && (
            <PercorsoRcProfessionale
              onBack={() => setSelected(null)}
              onNavigateToChecklist={() => setSelected("checklist")}
            />
          )}

          {/* ── Pensione Integrativa (senza checklist) ── */}
          {selected === "pensione" && (
            <PensioneIntegrativa onBack={() => setSelected(null)} />
          )}

          {/* ── Guida Completa PDF ── */}
          {selected === "guida-completa" && (
            canExport ? (
              <GuidaCompletaDownload onBack={() => setSelected(null)} />
            ) : (
              <GuidaCompletaPreview onBack={() => setSelected(null)} />
            )
          )}

          {/* ── Checklist standalone ── */}
          {selected === "checklist" && (
            <div className="space-y-6">
              <ChecklistProtezione
                onNavigate={(p) => setSelected(p)}
                onScrollToPensione={() => setSelected("pensione")}
              />
            </div>
          )}

          {/* ── Fondamenti fiscali: Gestione Separata ── */}
          {selected === "gestione-separata" && (
            <GestioneSeparataGuida onBack={() => setSelected(null)} />
          )}

          {/* ── Fondamenti fiscali: Marca da bollo ── */}
          {selected === "marca-bollo" && (
            <MarcaBolloGuida onBack={() => setSelected(null)} />
          )}
        </PageContainer>
      </PageErrorBoundary>
    </AppLayout>
  );
}
