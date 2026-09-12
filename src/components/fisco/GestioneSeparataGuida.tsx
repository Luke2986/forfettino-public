import { ArrowLeft, AlertCircle, CheckCircle2, Info, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GestioneSeparataGuidaProps {
  onBack: () => void;
}

/**
 * Guida educativa alla Gestione Separata INPS per forfettari.
 * Copre: iscrizione, contributi, rivalsa 4%, esempio numerico, deducibilita'.
 *
 * Ancora: la sezione rivalsa ha id="rivalsa" per link diretto dal modulo incasso.
 */
export function GestioneSeparataGuida({ onBack }: GestioneSeparataGuidaProps) {
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
          <h2 className="text-xl font-bold text-slate-900">Gestione Separata INPS</h2>
          <p className="text-sm text-slate-600">
            Contributi, rivalsa 4%, deducibilita'. Le basi per il forfettario.
          </p>
        </div>
      </div>

      {/* Sezione: Cos'è */}
      <section className="rounded-2xl bg-white border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Cos'è la Gestione Separata</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          E' la cassa previdenziale INPS riservata ai lavoratori autonomi che{" "}
          <strong>non hanno una cassa professionale dedicata</strong> (come Cassa Forense,
          Inarcassa, CNPADC, ecc.). Istituita dall'art. 2 c. 26 della L. 335/1995.
        </p>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
          <p className="text-sm font-semibold text-slate-800">Si iscrivono tipicamente</p>
          <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
            <li>Consulenti, formatori, coach</li>
            <li>Developer, designer, copywriter freelance</li>
            <li>Professionisti senza Ordine o con Ordine ma senza cassa dedicata</li>
            <li>Collaboratori occasionali e co.co.co</li>
          </ul>
        </div>
      </section>

      {/* Sezione: Contributi */}
      <section className="rounded-2xl bg-white border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Come si calcolano i contributi</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          L'aliquota <strong>2026 &egrave; il 26,07%</strong> del reddito imponibile
          (compenso &times; coefficiente di redditivit&agrave;). Non esiste un minimale
          contributivo come per artigiani/commercianti: si paga in proporzione a quanto
          si guadagna.
        </p>
        <div className="flex items-start gap-2 rounded-lg bg-teal-50 border border-teal-100 p-3">
          <CheckCircle2 className="h-4 w-4 text-teal-700 mt-0.5 shrink-0" />
          <p className="text-sm text-teal-800">
            <strong>Vantaggio per chi inizia:</strong> se fatturi poco, paghi poco.
            Nessuna soglia minima da rispettare.
          </p>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          I contributi si versano con <strong>F24</strong> in due acconti (giugno, novembre)
          e saldo (giugno anno successivo), calcolati sul reddito dichiarato nell'anno
          precedente. Forfettino gestisce queste scadenze in automatico.
        </p>
      </section>

      {/* Sezione: Rivalsa 4% — ancora per link dal modulo incasso */}
      <section
        id="rivalsa"
        className="rounded-2xl bg-white border border-teal-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] space-y-4 scroll-mt-20"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-teal-700" />
          <h3 className="text-base font-semibold text-slate-900">La rivalsa INPS 4%</h3>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          La rivalsa 4% &egrave; un addebito che puoi fare al cliente in fattura
          <strong> come rimborso parziale</strong> dei contributi INPS che versi.
          &Egrave; prevista dall'art. 1 c. 212 L. 662/1996.
        </p>

        {/* Esempio visivo fattura */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Compenso prestazione</span>
            <span className="text-slate-900 tabular-nums">1.000,00 &euro;</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Rivalsa INPS 4%</span>
            <span className="text-slate-900 tabular-nums">+ 40,00 &euro;</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 font-semibold">
            <span className="text-slate-900">Totale fattura</span>
            <span className="text-slate-900 tabular-nums">1.040,00 &euro;</span>
          </div>
        </div>

        {/* Domande chiave */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">E' obbligatoria?</p>
            <p className="text-sm text-slate-700">
              No, e' una tua facolta'. Molti clienti aziendali la accettano perché &egrave;
              prassi comune; alcuni privati potrebbero chiederti di non applicarla.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">A chi si applica?</p>
            <p className="text-sm text-slate-700">
              Solo a chi &egrave; iscritto alla Gestione Separata INPS. Artigiani e
              commercianti versano contributi diversi (fissi + variabili sul reddito) e
              non possono applicare la rivalsa 4%.
            </p>
          </div>

          {/* Punto critico */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                Attenzione: la rivalsa &egrave; reddito imponibile
              </p>
              <p className="text-sm text-amber-800">
                L'Agenzia delle Entrate considera la rivalsa come parte del tuo compenso.
                Concorre a: soglia 85k, coefficiente di redditivit&agrave;, imposta
                sostitutiva, contributi INPS stessi. Non e' un "rimborso esente".
              </p>
            </div>
          </div>
        </div>

        {/* Impatto reale sul netto */}
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            Quanto ti resta davvero in tasca
          </p>
          <p className="text-sm text-slate-700">
            Sui 40&euro; di rivalsa, considerando tasse (5-15%) e INPS (26,07%) sul 78% del
            compenso aggiuntivo, il guadagno netto reale e' circa{" "}
            <strong>25-27&euro;</strong>. E' un aiuto, ma non copre al 100% i contributi
            che versi: &egrave; un <em>rimborso parziale</em>.
          </p>
        </div>

        {/* CTA verso il form */}
        <div className="flex items-start gap-2 rounded-lg bg-teal-50 border border-teal-100 p-3">
          <Info className="h-4 w-4 text-teal-700 mt-0.5 shrink-0" />
          <p className="text-sm text-teal-800">
            <strong>In Forfettino:</strong> quando registri un incasso, attiva il
            toggle "Ho applicato rivalsa INPS 4%" per salvare il dato corretto.
            Inserisci il compenso e Forfettino calcola automaticamente il totale fattura.
          </p>
        </div>
      </section>

      {/* Sezione: Deducibilità */}
      <section className="rounded-2xl bg-white border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Deducibilita' dei contributi</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          I contributi INPS versati sono <strong>deducibili dal reddito</strong>
          nell'anno in cui li paghi (principio di cassa). Nel regime forfettario
          questa deduzione abbatte direttamente l'imponibile su cui si calcola
          l'imposta sostitutiva.
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          Esempio: su 10.000&euro; di reddito imponibile, se hai versato 2.000&euro; di
          contributi nell'anno, l'imposta si calcola su 8.000&euro;.
        </p>
      </section>

      {/* Disclaimer */}
      <div className="rounded-xl bg-stone-50 border border-stone-200/40 p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Nota:</strong> questa guida ha scopo informativo generale e non
          sostituisce il parere del tuo commercialista. Le aliquote indicate si
          riferiscono al 2026 e possono variare per anno o per tipologia di
          iscrizione (es. pensionati, iscritti ad altra gestione). Verifica sempre
          la tua situazione specifica.
        </p>
      </div>
    </div>
  );
}
