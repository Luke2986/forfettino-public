import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PricingSection } from "@/components/landing/PricingSection";
import { EmailCaptureForm } from "@/components/marketing/EmailCaptureForm";
import { ForfettarioCalculator } from "@/components/calculator/ForfettarioCalculator";
import { landingFaqItems } from "@/lib/landing-faq";
import { getBlogPostBySlug } from "@/lib/blog-data";
import { GEO_SOURCES, formatGeoSource } from "@/lib/geo-sources";
import { LANDING_LAST_UPDATED } from "@/lib/landing-fiscal-constants";
import { formatMonthYearItalian } from "@/lib/date-formatting";
import {
  Calculator,
  ArrowRight,
  Wallet,
  AlertTriangle,
  Shield,
  Eye,
  Landmark,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
} from "lucide-react";

type CookiebotWindow = Window & {
  Cookiebot?: {
    show: () => void;
  };
};

interface LandingBelowFoldProps {
  userCountLabel: string;
}

// Epic 79.5 — Fonti e riferimenti (landing). Ordine: piu' generale -> piu' specifico.
// 8 fonti selezionate dal canonico GEO_SOURCES, coerenti con landing-fiscal-constants.ts
// e con le FAQ di landing-faq.ts. Include obbligatoriamente: L.190/2014, L.197/2022,
// INPS circ. 8/2026 (GS), INPS circ. 14/2026 (Art/Comm), D.Lgs. 127/2015 (FE).
const LANDING_SOURCE_IDS = [
  "l190-2014-disciplina",
  "l197-2022-soglia-85k",
  "l190-2014-allegato-4",
  "l190-2014-startup-5",
  "inps-circ-8-2026-gs",
  "inps-circ-14-2026-artcom",
  "l190-2014-riduzione-35",
  "dlgs-127-2015-fe",
] as const;

// Articoli blog in evidenza sulla landing (internal linking SEO).
// Ordinati per rilevanza evergreen: calcolo, scadenze, INPS, apertura, confronto, costi.
const FEATURED_BLOG_SLUGS = [
  "calcolo-tasse-regime-forfettario-2026",
  "scadenze-fiscali-forfettario-2026",
  "contributi-inps-regime-forfettario-2026",
  "aprire-partita-iva-forfettaria-2026",
  "forfettario-o-ordinario-2026",
  "costi-partita-iva-forfettaria-2026",
] as const;

export default function LandingBelowFold({ userCountLabel }: LandingBelowFoldProps) {
  return (
    <>
      {/* ───────── SEZ. 1 — IL PROBLEMA (Tensione) ───────── */}
      <section id="il-problema" className="border-t border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Perché il saldo in banca non riflette il netto spendibile di una partita IVA forfettaria?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Su 3.000 EUR incassati, tra 900 e 1.200 EUR servono per imposta sostitutiva 5-15% e contributi INPS da accantonare subito.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900/30 text-emerald-400">
                <Wallet className="h-7 w-7" />
              </div>
              <p className="text-lg font-semibold text-foreground">Incassi la tua prima fattura da 3.000 EUR</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vedi il saldo, ti senti tranquillo. Ma hai controllato quanto è delle tasse?
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-900/30 text-amber-400">
                <Eye className="h-7 w-7" />
              </div>
              <p className="text-lg font-semibold text-foreground">Ma 900-1.200 EUR non sono tuoi</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Imposta sostitutiva + contributi INPS che dovrai pagare. Ma non li vedi.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/30 text-red-400">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <p className="text-lg font-semibold text-foreground">Poi arriva giugno.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saldo + acconti. Scopri che quei soldi non c'erano mai stati davvero.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-lg font-medium text-foreground">
              Non è un problema di contabilità. <strong>È un problema di visibilità quotidiana.</strong>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              E nessun foglio Excel o app di fatturazione lo risolve.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── SEZ. 2 — LA PROMESSA (Come Funziona) ───────── */}
      <section id="come-funziona" className="scroll-mt-20 border-t border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Come calcola Forfettino il netto spendibile giornaliero di un forfettario italiano?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Forfettino sottrae dal fatturato incassato imposta sostitutiva, contributi INPS e accantonamento scadenze, mostrando un unico netto spendibile.
            </p>
          </div>

          {/* Il semaforo */}
          <div className="mt-14 rounded-xl border border-white/10 bg-card p-8">
            <h3 className="mb-6 text-center text-xl font-bold text-foreground">Il tuo semaforo quotidiano</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg bg-emerald-950/30 p-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
                  ✓
                </span>
                <div>
                  <p className="font-semibold text-emerald-400">Verde — Sei tranquillo</p>
                  <p className="text-sm text-emerald-400/70">Puoi spendere senza pensieri. Le tasse sono coperte.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-amber-950/30 p-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
                  !
                </span>
                <div>
                  <p className="font-semibold text-amber-400">Giallo — Attenzione</p>
                  <p className="text-sm text-amber-400/70">Stai usando fondi che serviranno per le prossime scadenze.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-red-950/30 p-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                  ✕
                </span>
                <div>
                  <p className="font-semibold text-red-400">Rosso — Stop</p>
                  <p className="text-sm text-red-400/70">Stai toccando soldi delle tasse. Fermati.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── SEZ. 2b — 3 STEP (Semplicità) ───────── */}
      <section className="border-t border-white/10 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground md:text-3xl">
              Funziona in 3 passi. <span className="text-primary">Sul serio.</span>
            </h3>
            <p className="mt-3 text-muted-foreground">
              Niente configurazioni complesse. Niente fogli Excel. Niente attese.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-bold">
                1
              </div>
              <p className="text-lg font-semibold text-foreground">Registra l'incasso</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Inserisci l'importo della fattura incassata. Un campo, 5 secondi.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-bold">
                2
              </div>
              <p className="text-lg font-semibold text-foreground">Vedi il tuo netto</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Forfettino calcola in automatico tasse, INPS e quanto puoi spendere davvero.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-bold">
                3
              </div>
              <p className="text-lg font-semibold text-foreground">Sai quando pagare</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Lo scadenziario ti avvisa 30 giorni prima. Zero sorprese a giugno e novembre.
              </p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/login">
                Inizia gratis — 30 secondi
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── SEZ. 3 — CALCOLATORE (La Prova) ───────── */}
      <section id="calcolatore" className="scroll-mt-20 border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <div className="mx-auto flex items-center justify-center gap-2 mb-4">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Quanto puoi davvero spendere oggi con una partita IVA in regime forfettario?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Il netto dipende da coefficiente ATECO, aliquota imposta sostitutiva 5% o 15% e contributi INPS della tua gestione previdenziale.
            </p>
            <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                <Landmark className="h-3 w-3" />
                INPS Gestione Separata
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                <CalendarClock className="h-3 w-3" />
                Simulazione primo anno
              </span>
            </div>
            <p className="mx-auto mt-2 max-w-xl text-xs text-muted-foreground">
              Pensato per professionisti iscritti alla Gestione Separata INPS (la più diffusa nel forfettario).
              Non copre casse professionali (Inarcassa, Cassa Forense, ENPAM, ecc.) né INPS Artigiani/Commercianti.
            </p>
          </div>

          <ForfettarioCalculator variant="teaser" />
        </div>
      </section>

      {/* ───────── SEZ. 3b — INFO FISCALE (GEO) ───────── */}
      {/* ───────── SEZ. 4 — DIFFERENZIAZIONE ───────── */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Cosa distingue Forfettino da Fiscozen, Fatture in Cloud e altri software fiscali?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Forfettino non emette fatture né fa dichiarazioni: calcola ogni giorno quanto puoi spendere gratis, come scudo di liquidità quotidiano.
            </p>
          </div>

          {/* Mobile: card layout */}
          <div className="mt-12 space-y-4 md:hidden">
            {[
              { label: "Quando ti mostra i dati", others: "A fine anno", forfettino: "Ogni giorno" },
              { label: "Focus principale", others: "Dichiarazione / Fatture", forfettino: "Le tue decisioni di oggi" },
              { label: "Ti dice quanto spendere", others: false, forfettino: true },
              { label: "Previene sorprese fiscali", others: false, forfettino: true },
              { label: "Costo", others: "Da €8-299/mese", forfettino: "Gratis" },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground mb-2">{row.label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Altri tool</p>
                    {typeof row.others === "boolean" ? (
                      <XCircle className="h-5 w-5 text-muted-foreground/50" />
                    ) : (
                      <p className="text-sm text-muted-foreground">{row.others}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-primary mb-1">Forfettino</p>
                    {typeof row.forfettino === "boolean" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <p className="text-sm font-medium text-primary">{row.forfettino}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="mt-12 hidden overflow-hidden rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Confronto</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Altri tool</th>
                  <th className="px-4 py-3 text-center font-medium text-primary">Forfettino</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 text-foreground">Quando ti mostra i dati</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">A fine anno</td>
                  <td className="px-4 py-3 text-center font-medium text-primary">Ogni giorno</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 text-foreground">Focus principale</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">Dichiarazione / Fatture</td>
                  <td className="px-4 py-3 text-center font-medium text-primary">Le tue decisioni di oggi</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 text-foreground">Ti dice quanto spendere</td>
                  <td className="px-4 py-3 text-center">
                    <XCircle className="mx-auto h-5 w-5 text-muted-foreground/50" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 text-foreground">Previene sorprese fiscali</td>
                  <td className="px-4 py-3 text-center">
                    <XCircle className="mx-auto h-5 w-5 text-muted-foreground/50" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-foreground">Costo</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">Da €8-299/mese</td>
                  <td className="px-4 py-3 text-center font-medium text-primary">Gratis</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ───────── SEZ. 5 — PER CHI È ───────── */}
      <section className="border-t border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Forfettino è per te?
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-6">
              <h3 className="mb-4 text-lg font-bold text-primary flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Forfettino è per te se:
              </h3>
              <ul className="space-y-3 text-sm text-slate-200">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Sei freelance o consulente in <strong className="text-white">regime forfettario</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Incassi bene ma <strong className="text-white">vivi con l'ansia delle scadenze</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Hai un Excel che aggiorni "quando ti ricordi"</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Vuoi sapere se puoi permetterti quell'investimento <strong className="text-white">oggi</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Vuoi arrivare dal commercialista preparato, non in panico</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 p-6">
              <h3 className="mb-4 text-lg font-bold text-slate-300 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Non è per te se:
              </h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>Cerchi un gestionale completo con fatturazione elettronica</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>Vuoi un commercialista online che faccia la dichiarazione</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>Sei in regime ordinario o hai una società</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── SEZ. 6 — SCADENZE ───────── */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Perché le scadenze di metà anno e di novembre spaventano i forfettari e come evitarlo?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Il 20 luglio (proroga forfettari 2026) scadono saldo imposta sostitutiva e primo acconto, il 30 novembre il secondo acconto: Forfettino accantona ogni incasso.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">3 mesi prima</p>
                <p className="text-sm text-muted-foreground">"A giugno pagherai €2.340. Sei già coperto al 78%."</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900/30 text-emerald-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">1 mese prima</p>
                <p className="text-sm text-muted-foreground">"Sei in sicurezza. Nessuna azione necessaria."</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900/30 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">1 settimana prima</p>
                <p className="text-sm text-muted-foreground">"Fondi accantonati. Puoi pagare senza toccare il tuo budget."</p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-lg font-medium text-foreground">
            Zero sorprese. Zero notti insonni.
          </p>
        </div>
      </section>

      {/* ───────── EMAIL CAPTURE — Pre-pricing ───────── */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <EmailCaptureForm
            source="landing"
            variant="inline"
            leadMagnet="guida_protezione"
            headline="Non pronto a registrarti? Scarica la guida gratuita"
            subtext="Protezione freelancer: assicurazioni, INPS e pensione integrativa."
          />
        </div>
      </section>

      {/* ───────── PREZZI ───────── */}
      <PricingSection />

      {/* ───────── PRO TEASER BANNER ───────── */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-8 sm:px-10 sm:py-10 text-center text-white">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Forfettino PRO arriva presto
            </h2>
            <p className="mt-2 text-teal-100 max-w-xl mx-auto">
              Export CSV, report clienti, benchmark tariffe, task board e multi-anno.
              Posti limitati — iscriviti alla waitlist per l'accesso prioritario.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-6"
              asChild
            >
              <Link to="/pro-presto">
                Scopri PRO e iscriviti
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="border-t border-white/10 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
            Quali sono i numeri chiave del regime forfettario italiano nel 2026?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Soglia 85.000 EUR, imposta sostitutiva 5% primi 5 anni poi 15%, oltre 2 milioni di partite IVA, coefficienti ATECO da 40% a 86%.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">2M+</div>
              <p className="mt-1 text-sm text-muted-foreground">Partite IVA forfettarie in Italia</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">85.000 EUR</div>
              <p className="mt-1 text-sm text-muted-foreground">Soglia di ricavi annui</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">5% / 15%</div>
              <p className="mt-1 text-sm text-muted-foreground">Imposta sostitutiva agevolata</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">26,07%</div>
              <p className="mt-1 text-sm text-muted-foreground">Aliquota INPS Gestione Separata</p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Fonte: Legge 190/2014 e successive modifiche.
          </p>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="border-t border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Domande Frequenti</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Tutto sul Regime Forfettario, il netto spendibile e come Forfettino si confronta con le alternative.
            </p>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {landingFaqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border-white/10">
                <AccordionTrigger className="text-left text-foreground hover:text-primary">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent forceMount className="text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8 text-center">
            <Link
              to="/faq"
              aria-label="Leggi tutte le FAQ sul regime forfettario"
              className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Leggi tutte le FAQ sul regime forfettario
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── DALLA GUIDA (internal linking SEO blog) ───────── */}
      <section
        aria-labelledby="landing-guida-heading"
        className="border-t border-white/10 py-20"
      >
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2
              id="landing-guida-heading"
              className="text-3xl font-bold text-foreground md:text-4xl"
            >
              Dalla nostra guida
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Approfondimenti pratici su tasse, INPS e scadenze per freelancer in regime forfettario.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_BLOG_SLUGS.map((slug) => {
              const post = getBlogPostBySlug(slug);
              if (!post) return null;
              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-primary/40 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <h3 className="text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {post.meta_description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
                    Leggi <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/blog"
              aria-label="Vedi tutti gli articoli del blog Forfettino"
              className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Vedi tutti gli articoli del blog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── FONTI E RIFERIMENTI (Epic 79.5) ───────── */}
      <section
        aria-labelledby="landing-fonti-heading"
        className="border-t border-white/10 py-10 sm:py-12"
      >
        <div className="mx-auto max-w-3xl px-4">
          <h2
            id="landing-fonti-heading"
            className="text-xl font-bold text-foreground sm:text-2xl"
          >
            Fonti e riferimenti
          </h2>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {LANDING_SOURCE_IDS.map((id) => (
              <li key={id}>{formatGeoSource(GEO_SOURCES[id])}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── CTA FINALE ───────── */}
      <section className="border-t border-white/10 bg-primary py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
            Quanto puoi spendere oggi?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Smetti di tirare a indovinare. Forfettino ti mostra il tuo netto spendibile reale, ogni giorno, gratis.
          </p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link to="/login">
              Scopri il tuo Netto Spendibile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-3 text-sm text-primary-foreground/60">
            Gratuito, senza carta di credito. Pronto in 30 secondi.
          </p>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">F</span>
                </div>
                <span className="font-semibold text-foreground">Forfettino</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Il netto spendibile per freelance in Regime Forfettario. Ogni giorno sai quanto puoi spendere davvero.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Prodotto</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#come-funziona" className="hover:text-foreground transition-colors">Come Funziona</a></li>
                <li><Link to="/calcolatore-forfettario" className="hover:text-foreground transition-colors">Calcolatore Tasse</Link></li>
                <li><Link to="/pro-presto" className="hover:text-foreground transition-colors">Forfettino PRO</Link></li>
                <li><a href="#prezzi" className="hover:text-foreground transition-colors">Prezzi</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Risorse</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors">Accedi</Link></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors">Registrati Gratis</Link></li>
              </ul>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Legale</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="/privacy-policy" className="hover:text-foreground transition-colors" title="Privacy Policy">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/cookie-policy" className="hover:text-foreground transition-colors" title="Cookie Policy">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-foreground transition-colors" title="FAQ Regime Forfettario">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    to="/glossario"
                    className="hover:text-foreground transition-colors"
                    title="Glossario fiscale forfettario"
                    aria-label="Vai al glossario fiscale del regime forfettario"
                  >
                    Glossario
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      const cookiebot = (window as CookiebotWindow).Cookiebot;
                      cookiebot?.show();
                    }}
                    className="hover:text-foreground transition-colors text-left"
                  >
                    Gestisci Cookie
                  </button>
                </li>
                <li>
                  <a href="/terms" className="hover:text-foreground transition-colors" title="Termini di Servizio">
                    Termini di Servizio
                  </a>
                </li>
                <li>
                  <a href="mailto:info@forfettino.it" className="hover:text-foreground transition-colors">
                    info@forfettino.it
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 flex flex-col items-center justify-between gap-2 md:flex-row">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Forfettino. Tutti i diritti riservati.
            </p>
            <p className="text-xs text-muted-foreground">
              Forfettino non è un commercialista e non fornisce consulenza fiscale professionale.
            </p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Dati aggiornati a{" "}
            <time dateTime={LANDING_LAST_UPDATED}>
              {formatMonthYearItalian(LANDING_LAST_UPDATED)}
            </time>
            .
          </p>
        </div>
      </footer>
    </>
  );
}
