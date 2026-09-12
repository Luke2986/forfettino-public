import { useRef, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { faqPensione } from "@/data/protezione-content";
import { enrichWithGlossario } from "./SlideRenderer";
import { FaqSection } from "./FaqSection";
import { ProtezioneDisclaimer } from "./ProtezioneDisclaimer";
import { GuidaCompletaCta } from "./GuidaCompletaCta";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/hooks/useSubscription";

interface PensioneIntegrativaProps {
  onBack: () => void;
}

export function PensioneIntegrativa({ onBack }: PensioneIntegrativaProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isMobile = useIsMobile();
  const { canExport } = useSubscription();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div id="pensione-integrativa" className="space-y-8">
      {/* Back button + title */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Torna indietro
        </Button>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-slate-900 outline-none"
        >
          Pensione integrativa per forfettari
        </h2>
        <p className="text-sm text-slate-500">
          Come funziona, quanto costa e perché conviene iniziare presto.
        </p>
      </div>

      {/* Sezione A — Il Gap Pensionistico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span>😱</span> Il Gap Pensionistico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed font-semibold">
            {enrichWithGlossario(
              "Versando il minimo INPS per 30 anni, la pensione sarà una frazione del tuo ultimo reddito.",
            )}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {enrichWithGlossario(
              "Il sistema pensionistico usa il metodo contributivo: versi poco, prendi poco. Da forfettario, versi il minimo.",
            )}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {enrichWithGlossario(
              "La Gestione Separata INPS prevede contributi proporzionali al reddito (~26%), ma su un reddito forfettario (coefficiente di redditività) i versamenti sono modesti. Il risultato è una pensione che probabilmente non basterà a mantenere il tuo tenore di vita.",
            )}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed italic">
            Puoi fare qualcosa, e prima inizi meglio è.
          </p>
        </CardContent>
      </Card>

      {/* Sezione B — FPA vs PIP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span>⚖️</span> FPA vs PIP: quale scelgo?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {enrichWithGlossario(
              "Esistono due strade principali per la previdenza complementare: il Fondo Pensione Aperto (FPA) e il Piano Individuale Pensionistico (PIP). Ecco le differenze che contano:",
            )}
          </p>

          {/* Responsive table */}
          {isMobile ? (
            <div className="space-y-3">
              {[
                {
                  aspect: "Gestione",
                  fpa: "Banche/SGR",
                  pip: "Assicurazioni (unit linked)",
                },
                {
                  aspect: "Costo (ISC)",
                  fpa: "Medio: 1,1%-1,5%",
                  pip: "Alto: 1,8%-2,5%",
                },
                {
                  aspect: "Rendimenti (10 anni)",
                  fpa: "3-5% annuo (linee azionarie)",
                  pip: "Estremamente variabili",
                },
                {
                  aspect: "Messaggio chiave",
                  fpa: "Efficiente per chi vuole rendimenti a costi contenuti",
                  pip: "Garanzia di capitale per profili prudenti, ma costi maggiori",
                },
              ].map((row) => (
                <div key={row.aspect} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {row.aspect}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs font-semibold text-teal-600 uppercase">FPA</p>
                      <p className="text-sm text-slate-700">{row.fpa}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase">PIP</p>
                      <p className="text-sm text-slate-700">{row.pip}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Aspetto
                    </th>
                    <th className="py-2 pr-4 text-left font-semibold text-teal-600 text-xs uppercase tracking-wide">
                      FPA
                    </th>
                    <th className="py-2 text-left font-semibold text-amber-600 text-xs uppercase tracking-wide">
                      PIP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-700">Gestione</td>
                    <td className="py-2 pr-4 text-slate-700">Banche/SGR</td>
                    <td className="py-2 text-slate-700">Assicurazioni (unit linked)</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-700">Costo (ISC)</td>
                    <td className="py-2 pr-4 text-slate-700">Medio: 1,1%-1,5%</td>
                    <td className="py-2 text-slate-700">Alto: 1,8%-2,5%</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-700">Rendimenti (10 anni)</td>
                    <td className="py-2 pr-4 text-slate-700">3-5% annuo (linee azionarie)</td>
                    <td className="py-2 text-slate-700">Estremamente variabili</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-slate-700">Messaggio chiave</td>
                    <td className="py-2 pr-4 text-slate-700">
                      Efficiente per chi vuole rendimenti a costi contenuti
                    </td>
                    <td className="py-2 text-slate-700">
                      Garanzia di capitale per profili prudenti, ma costi maggiori
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800 leading-relaxed">
              {enrichWithGlossario(
                "Controlla i costi (ISC) prima dei rendimenti. Su 30 anni, l'1% di costi in più può erodere migliaia di euro.",
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sezione C — Il Vantaggio Fiscale Invisibile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span>💎</span> Il vantaggio fiscale del forfettario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {enrichWithGlossario(
              "Nel forfettario non puoi dedurre i contributi al fondo pensione dall'imposta sostitutiva. Ci sono però due vantaggi concreti:",
            )}
          </p>

          {/* Vantaggio 1 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Deduzione INPS (Quadro LM)
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {enrichWithGlossario(
                "I contributi al fondo pensione si deducono dalla base imponibile INPS nel Quadro LM. Per la Gestione Separata (~26%), ogni €1.000 versato al fondo pensione porta circa €260 di risparmio INPS.",
              )}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              Esempio: se versi €2.000/anno al fondo pensione, risparmi circa €520 di contributi INPS.
            </p>
          </div>

          {/* Vantaggio 2 — HIGHLIGHT BOX TEAL */}
          <div className="rounded-lg border-2 border-teal-500 bg-teal-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-teal-800">
              Esenzione fiscale totale alla pensione
            </p>
            <p className="text-sm text-teal-800 leading-relaxed">
              {enrichWithGlossario(
                "I contributi non dedotti (comunicati al fondo entro il 31 dicembre di ogni anno) saranno erogati in esenzione fiscale totale alla pensione. Quei soldi li riprendi senza pagarci le tasse.",
              )}
            </p>
            <div className="rounded bg-teal-100 border border-teal-300 p-3 mt-2">
              <p className="text-sm text-teal-900 font-medium leading-relaxed">
                Hai già un fondo pensione? Comunica al tuo fondo entro il 31 dicembre quanto non hai dedotto quest&apos;anno. Se non lo fai, perdi questo vantaggio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sezione D — Link e FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span>🔗</span> Risorse e FAQ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Link CiaoElsa */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">
              Per un confronto tra fondi pensione e simulazioni personalizzate, puoi consultare{" "}
              <a
                href="https://www.ciaoelsa.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-600 hover:text-teal-700 underline"
              >
                CiaoElsa.com
              </a>{" "}
              — una risorsa utile per orientarsi.
            </p>
            <p className="text-xs text-slate-500 italic">
              Forfettino non ha rapporti commerciali con CiaoElsa. Ti segnaliamo questa risorsa
              perché la riteniamo utile.
            </p>
          </div>

          {/* FAQ */}
          <FaqSection title="Domande sulla pensione integrativa" faqs={faqPensione} />
        </CardContent>
      </Card>

      {/* CTA Guida Completa */}
      <GuidaCompletaCta canExport={canExport} source="pensione" />

      {/* Disclaimer */}
      <ProtezioneDisclaimer />
    </div>
  );
}
