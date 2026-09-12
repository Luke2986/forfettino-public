import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  glossarioItems,
  glossarioSources,
  GLOSSARIO_PAGE_PUBLISHED_DATE,
  GLOSSARIO_PAGE_MODIFIED_DATE,
} from "@/lib/glossario-page";
import {
  AUTHOR_PERSON,
  AUTHOR_PERSON_REF,
  PUBLISHER_ORGANIZATION,
  PUBLISHER_ORGANIZATION_REF,
} from "@/lib/schema-entities";

const CANONICAL_URL = "https://forfettino.it/glossario";
const PAGE_TITLE =
  "Glossario Regime Forfettario 2026 | Forfettino";
const PAGE_DESCRIPTION =
  "Glossario fiscale forfettario: 20+ termini spiegati. Imposta sostitutiva, coefficiente ATECO, gestione separata INPS, soglia 85.000 EUR. Aggiornato 2026.";
const TLDR =
  "Il glossario spiega oltre 20 termini fondamentali del regime forfettario italiano, dalla soglia di 85.000 EUR di ricavi ai coefficienti di redditività ATECO, dall'imposta sostitutiva 15% (5% i primi 5 anni) ai contributi INPS gestione separata al 26,07%. Ogni voce fornisce una definizione breve con riferimento normativo (Legge 190/2014 e successive).";

export default function GlossarioPage() {
  const webPageNode = {
    "@type": "WebPage",
    "@id": `${CANONICAL_URL}#webpage`,
    url: CANONICAL_URL,
    name: PAGE_TITLE,
    description: TLDR,
    inLanguage: "it-IT",
    datePublished: GLOSSARIO_PAGE_PUBLISHED_DATE,
    dateModified: GLOSSARIO_PAGE_MODIFIED_DATE,
    author: AUTHOR_PERSON_REF,
    publisher: PUBLISHER_ORGANIZATION_REF,
    isPartOf: {
      "@type": "WebSite",
      "@id": "https://forfettino.it/#website",
      url: "https://forfettino.it/",
      name: "Forfettino",
    },
    breadcrumb: { "@id": `${CANONICAL_URL}#breadcrumb` },
  };

  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    "@id": `${CANONICAL_URL}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://forfettino.it/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Glossario",
        item: CANONICAL_URL,
      },
    ],
  };

  const definedTermSetNode = {
    "@type": "DefinedTermSet",
    "@id": `${CANONICAL_URL}#set`,
    name: "Glossario fiscale regime forfettario",
    description: TLDR,
    inLanguage: "it-IT",
    hasDefinedTerm: glossarioItems.map((item) => ({
      "@type": "DefinedTerm",
      "@id": `${CANONICAL_URL}#${item.id}`,
      name: item.term,
      description: `${item.answerCapsule} ${item.answerDetail}`,
      inDefinedTermSet: `${CANONICAL_URL}#set`,
    })),
  };

  const faqPageNode = {
    "@type": "FAQPage",
    "@id": `${CANONICAL_URL}#faq`,
    mainEntity: glossarioItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${item.answerCapsule} ${item.answerDetail}`,
      },
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode,
      breadcrumbNode,
      definedTermSetNode,
      faqPageNode,
      AUTHOR_PERSON,
      PUBLISHER_ORGANIZATION,
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta
          name="robots"
          content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
        />
        <link rel="canonical" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="it-IT" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:locale" content="it_IT" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">F</span>
            </div>
            <span className="font-semibold text-slate-900">Forfettino</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              to="/blog"
              className="text-slate-700 hover:text-slate-900 transition-colors"
            >
              Blog
            </Link>
            <Link
              to="/faq"
              className="text-slate-700 hover:text-slate-900 transition-colors hidden sm:inline"
            >
              FAQ
            </Link>
            <Link
              to="/calcolatore-forfettario"
              className="text-slate-700 hover:text-slate-900 transition-colors hidden sm:inline"
            >
              Calcolatore
            </Link>
            <Button asChild size="sm">
              <Link to="/login">Accedi</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 text-sm text-slate-600"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link to="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-900 font-medium">Glossario</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Glossario del regime forfettario: termini fiscali spiegati
        </h1>

        <section
          aria-label="TL;DR — riassunto"
          className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/60 p-5 sm:p-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            TL;DR
          </p>
          <p className="mt-2 text-base text-slate-800 leading-relaxed">
            {TLDR}
          </p>
        </section>

        <p className="mt-6 text-sm text-slate-600">
          Definizioni brevi e citabili dei termini chiave del regime forfettario
          italiano: ricavi, coefficienti ATECO, imposta sostitutiva, contributi
          INPS, soglie, scadenze. Ordinati alfabeticamente. Fonti ufficiali in
          fondo alla pagina.
        </p>

        <div className="mt-10 space-y-10">
          {glossarioItems.map((item) => (
            <article
              key={item.id}
              id={item.id}
              className="scroll-mt-24"
            >
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                {item.question}
              </h2>
              <p className="answer-capsule mt-3 text-base font-semibold text-slate-800 leading-relaxed">
                {item.answerCapsule}
              </p>
              <p className="mt-3 text-base text-slate-700 leading-relaxed">
                {item.answerDetail}
              </p>
            </article>
          ))}
        </div>

        <section
          aria-labelledby="glossario-fonti-heading"
          className="mt-14 border-t border-slate-200 pt-8"
        >
          <h2
            id="glossario-fonti-heading"
            className="text-xl font-semibold text-slate-900 sm:text-2xl"
          >
            Fonti e riferimenti
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {glossarioSources.map((src) => (
              <li key={src.url}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-800 hover:text-primary underline underline-offset-2"
                >
                  {src.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            Vedi anche:{" "}
            <Link
              to="/faq"
              className="text-slate-800 hover:text-primary underline underline-offset-2"
            >
              FAQ regime forfettario →
            </Link>
          </p>
        </section>

        <section className="mt-14 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Calcola il tuo netto spendibile reale
          </h2>
          <p className="mt-2 text-base text-slate-700 leading-relaxed">
            Forfettino è gratuito: registri ogni incasso e vedi ogni giorno
            quanto puoi davvero spendere dopo tasse, INPS e accantonamenti per
            le scadenze del regime forfettario.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/login">
                Inizia gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/calcolatore-forfettario">
                <Calculator className="mr-2 h-4 w-4" />
                Calcolatore tasse
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-3xl px-4 text-center text-sm text-slate-600">
          <p>
            © {new Date().getFullYear()} Forfettino — Il netto spendibile per
            forfettari.
          </p>
          <nav aria-label="Footer Glossario" className="mt-2">
            <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <li>
                <Link to="/" className="hover:text-slate-900 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="hover:text-slate-900 transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="hover:text-slate-900 transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy-policy"
                  className="hover:text-slate-900 transition-colors"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="hover:text-slate-900 transition-colors"
                >
                  Termini
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
