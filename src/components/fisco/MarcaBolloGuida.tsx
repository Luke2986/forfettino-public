import { ArrowLeft, AlertCircle, Info, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarcaBolloGuidaProps {
  onBack: () => void;
}

/**
 * Guida educativa alla marca da bollo 2 € per forfettari.
 * Copre: quando e' dovuta, chi la paga, addebito al cliente e impatto fiscale.
 *
 * Ancora: la sezione addebito ha id="bollo" per link diretto dal modulo incasso.
 */
export function MarcaBolloGuida({ onBack }: MarcaBolloGuidaProps) {
  return (
    <div className="space-y-6">
      {/* Header con back */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Torna a Guide per te"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Marca da bollo in fattura</h2>
          <p className="text-sm text-slate-600">
            Quando serve, chi la paga e cosa cambia se la addebiti al cliente.
          </p>
        </div>
      </div>

      {/* Sezione: Quando è dovuta */}
      <section className="rounded-2xl bg-white border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Quando &egrave; dovuta</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          Le fatture del forfettario sono <strong>senza IVA</strong>: per questo, quando
          l'importo supera <strong>77,47 &euro;</strong>, serve una marca da bollo da{" "}
          <strong>2 &euro;</strong> (D.P.R. 642/1972). Sotto quella soglia il bollo non
          &egrave; dovuto.
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          Con la fattura elettronica il bollo si assolve in modo virtuale: l'Agenzia
          delle Entrate conteggia i bolli dovuti per trimestre e li versi con F24 o
          addebito diretto dal portale Fatture e Corrispettivi.
        </p>
      </section>

      {/* Sezione: Addebito al cliente — ancora per link dal modulo incasso */}
      <section
        id="bollo"
        className="rounded-2xl bg-white border border-amber-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] space-y-4 scroll-mt-20"
      >
        <div className="flex items-center gap-2">
          <Stamp className="h-5 w-5 text-amber-700" />
          <h3 className="text-base font-semibold text-slate-900">
            Addebitare il bollo al cliente
          </h3>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          L'obbligato al pagamento del bollo sei tu che emetti la fattura, ma{" "}
          <strong>puoi girarlo al cliente</strong> aggiungendo i 2 &euro; in fattura.
          &Egrave; una prassi lecita e molto diffusa.
        </p>

        {/* Esempio visivo fattura */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Compenso prestazione</span>
            <span className="text-slate-900 tabular-nums">1.000,00 &euro;</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Rivalsa INPS 4% (se applicata)</span>
            <span className="text-slate-900 tabular-nums">+ 40,00 &euro;</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Marca da bollo</span>
            <span className="text-slate-900 tabular-nums">+ 2,00 &euro;</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 font-semibold">
            <span className="text-slate-900">Totale fattura</span>
            <span className="text-slate-900 tabular-nums">1.042,00 &euro;</span>
          </div>
        </div>

        {/* Punto critico */}
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">
              Attenzione: il bollo addebitato &egrave; reddito imponibile
            </p>
            <p className="text-sm text-amber-800">
              Se giri il bollo al cliente, per l'Agenzia delle Entrate quei 2 &euro;
              sono parte del tuo compenso (interpello 428/2022). Concorrono a: soglia
              85k, coefficiente di redditivit&agrave;, imposta sostitutiva e contributi.
              Se invece lo paghi tu senza addebitarlo, resta un costo a tuo carico
              (non deducibile nel forfettario) e non tocca i tuoi ricavi.
            </p>
          </div>
        </div>

        {/* CTA verso il form */}
        <div className="flex items-start gap-2 rounded-lg bg-teal-50 border border-teal-100 p-3">
          <Info className="h-4 w-4 text-teal-700 mt-0.5 shrink-0" />
          <p className="text-sm text-teal-800">
            <strong>In Forfettino:</strong> quando registri un incasso sopra 77,47 &euro;,
            attiva il toggle "Ho addebitato la marca da bollo (2 &euro;)". Il totale
            fattura includer&agrave; il bollo e i calcoli fiscali saranno corretti in
            automatico.
          </p>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="rounded-xl bg-stone-50 border border-stone-200/40 p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Nota:</strong> questa guida ha scopo informativo generale e non
          sostituisce il parere del tuo commercialista. Regole e modalit&agrave; di
          assolvimento del bollo possono variare (fattura elettronica vs cartacea,
          casi particolari di esenzione). Verifica sempre la tua situazione specifica.
        </p>
      </div>
    </div>
  );
}
