import { Link } from "react-router-dom";

interface BlogCTAProps {
  ctaTarget?: string;
}

const CTA_TEXTS: Record<string, { title: string; subtitle: string }> = {
  registrazione: {
    title: "Scopri quanto ti resta davvero in tasca",
    subtitle: "Forfettino calcola tasse, INPS e netto spendibile in automatico. Gratis.",
  },
  scadenziario: {
    title: "Non perdere mai una scadenza fiscale",
    subtitle: "Forfettino ti avvisa prima di ogni F24 e ti dice quanto accantonare. Gratis.",
  },
  "wizard-onboarding": {
    title: "Configura il tuo profilo fiscale in 2 minuti",
    subtitle: "Inserisci codice ATECO e gestione INPS — Forfettino fa il resto. Gratis.",
  },
  calcolatore: {
    title: "Calcola i tuoi contributi INPS in automatico",
    subtitle: "Forfettino distingue minimale, variabile e riduzioni per la tua gestione. Gratis.",
  },
  "soglia-85k": {
    title: "Monitora la soglia degli 85.000 EUR in tempo reale",
    subtitle: "Forfettino ti avvisa quando ti avvicini al limite del regime forfettario. Gratis.",
  },
};

const DEFAULT_CTA = {
  title: "Calcola le tue tasse forfettarie in automatico",
  subtitle: "Forfettino e' il calcolatore gratuito per freelancer in regime forfettario.",
};

export default function BlogCTA({ ctaTarget }: BlogCTAProps) {
  const cta = (ctaTarget && CTA_TEXTS[ctaTarget]) || DEFAULT_CTA;

  return (
    <section className="mt-12 rounded-2xl bg-teal-50 border border-teal-200 p-6 sm:p-8">
      <h3 className="text-lg font-bold text-teal-800">{cta.title}</h3>
      <p className="mt-2 text-sm text-teal-700">{cta.subtitle}</p>
      <Link
        to="/login"
        className="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
      >
        Prova Forfettino gratis
      </Link>
    </section>
  );
}
