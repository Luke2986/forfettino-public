import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ForfettarioCalculator } from "@/components/calculator/ForfettarioCalculator";
import { EmailCaptureForm } from "@/components/marketing/EmailCaptureForm";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calculator } from "lucide-react";

const canonicalUrl = "https://forfettino.it/calcolatore-forfettario";

const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Calcolatore Tasse Regime Forfettario 2026",
  description:
    "Calcola netto spendibile, imposta sostitutiva, contributi INPS e scadenziario pagamenti per il Regime Forfettario. Gratuito, senza registrazione.",
  url: canonicalUrl,
  applicationCategory: "FinanceApplication",
  operatingSystem: "All",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  author: { "@type": "Organization", name: "Forfettino", url: "https://forfettino.it" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://forfettino.it" },
    { "@type": "ListItem", position: 2, name: "Calcolatore Forfettario", item: canonicalUrl },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Come si calcola il netto spendibile nel regime forfettario?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Il netto spendibile si calcola sottraendo l'imposta sostitutiva (5% o 15%) e i contributi INPS dal reddito imponibile. Il reddito imponibile è dato dai ricavi lordi moltiplicati per il coefficiente di redditività del codice ATECO.",
      },
    },
    {
      "@type": "Question",
      name: "Quando si pagano le tasse nel regime forfettario?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Le scadenze principali sono la scadenza di giugno — per i forfettari e i soggetti ISA prorogata, nel 2026 al 20 luglio — per il saldo dell'anno precedente e il primo acconto, e il 30 novembre per il secondo acconto. Il primo anno è più impegnativo perché non ci sono acconti pregressi.",
      },
    },
    {
      "@type": "Question",
      name: "Qual è l'aliquota INPS per i forfettari nel 2026?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Per i professionisti iscritti alla Gestione Separata INPS senza altra copertura previdenziale, l'aliquota nel 2026 è del 26,07%. Per artigiani e commercianti si applicano aliquote e minimali diversi.",
      },
    },
  ],
};

export default function CalcolatoreForfettario() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Calcolatore Tasse Regime Forfettario 2026 — Forfettino</title>
        <meta
          name="description"
          content="Calcola gratis il tuo netto spendibile nel Regime Forfettario: imposta sostitutiva, contributi INPS, scadenziario pagamenti giugno e novembre. Aggiornato al 2026."
        />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="it-IT" href={canonicalUrl} />
        <meta property="og:title" content="Calcolatore Tasse Regime Forfettario 2026 — Forfettino" />
        <meta
          property="og:description"
          content="Calcola gratis il tuo netto spendibile nel Regime Forfettario: imposta sostitutiva, contributi INPS e scadenziario pagamenti."
        />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:site_name" content="Forfettino" />
        <meta property="og:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Calcolatore fiscale Forfettino per il regime forfettario" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Calcolatore Tasse Regime Forfettario 2026 — Forfettino" />
        <meta
          name="twitter:description"
          content="Calcola gratis il tuo netto spendibile nel Regime Forfettario: imposta sostitutiva, contributi INPS e scadenziario pagamenti."
        />
        <meta name="twitter:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta name="twitter:image:alt" content="Calcolatore fiscale Forfettino per il regime forfettario" />
        <script type="application/ld+json">{JSON.stringify(calculatorSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">F</span>
            </div>
            <span className="font-semibold text-foreground">Forfettino</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
            <Button size="sm" asChild>
              <Link to="/login">
                Accedi
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Page heading */}
        <div className="text-center mb-12">
          <div className="mx-auto flex items-center justify-center gap-2 mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            Calcolatore Tasse Regime Forfettario 2026
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Scopri il tuo <strong className="text-foreground">netto spendibile</strong>,
            l'imposta sostitutiva, i contributi INPS e lo scadenziario completo dei pagamenti.
            Gratuito, senza registrazione.
          </p>
        </div>

        {/* Calculator (full variant with scadenziario) */}
        <ForfettarioCalculator variant="full" />

        {/* CTA to register */}
        <div className="mt-16 rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Vuoi questo calcolo aggiornato ogni giorno, automaticamente?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            Forfettino monitora il tuo netto spendibile in tempo reale, ti avvisa prima delle scadenze
            e ti dice esattamente quanto puoi spendere oggi.
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link to="/login">
              Inizia gratis — 30 secondi
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Gratuito, senza carta di credito. Niente spam.
          </p>
        </div>

        {/* Email capture */}
        <div className="mt-12">
          <EmailCaptureForm
            source="calcolatore"
            variant="inline"
            leadMagnet="simulatore_acconti_2026"
            headline="Porta con te questo calcolo: scarica il Simulatore Acconti in Excel"
            subtext="Foglio gratuito: stima acconti di giugno e novembre e quanto accantonare ogni mese."
          />
        </div>

        {/* Internal links for SEO */}
        <div className="mt-12 rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Approfondimenti</h2>
          <ul className="grid gap-3 sm:grid-cols-2 text-sm">
            <li>
              <Link to="/blog/calcolo-tasse-regime-forfettario-2026" className="text-primary hover:underline">
                Calcolo tasse nel Regime Forfettario: guida completa 2026
              </Link>
            </li>
            <li>
              <Link to="/blog/scadenze-fiscali-forfettario-2026" className="text-primary hover:underline">
                Scadenze fiscali forfettario 2026: tutte le date
              </Link>
            </li>
            <li>
              <Link to="/blog/contributi-inps-regime-forfettario-2026" className="text-primary hover:underline">
                Contributi INPS nel Regime Forfettario 2026
              </Link>
            </li>
            <li>
              <Link to="/blog/aprire-partita-iva-forfettaria-2026" className="text-primary hover:underline">
                Come aprire partita IVA forfettaria nel 2026
              </Link>
            </li>
            <li>
              <Link to="/blog/forfettario-o-ordinario-2026" className="text-primary hover:underline">
                Regime forfettario o ordinario: quale conviene?
              </Link>
            </li>
          </ul>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="border-t mt-16 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col items-center justify-between gap-2 md:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Forfettino. Tutti i diritti riservati.
          </p>
          <p className="text-xs text-muted-foreground">
            Stima indicativa — per la dichiarazione dei redditi rivolgersi a un commercialista.
          </p>
        </div>
      </footer>
    </div>
  );
}
