import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { usePublicUserCount } from "@/hooks/usePublicUserCount";
import { useWaitlistCount, formatWaitlistCount } from "@/hooks/useWaitlistCount";
import { Button } from "@/components/ui/button";
import { HeroGeometric, fadeUpVariants } from "@/components/ui/shape-landing-hero";
import { motion } from "framer-motion";
import {
  Calculator,
  ArrowRight,
  ArrowDown,
  Zap,
} from "lucide-react";
import { EmailCaptureForm } from "@/components/marketing/EmailCaptureForm";
import { landingFaqItems } from "@/lib/landing-faq";
import {
  AUTHOR_PERSON,
  AUTHOR_PERSON_REF,
  PUBLISHER_ORGANIZATION,
  PUBLISHER_ORGANIZATION_REF,
} from "@/lib/schema-entities";
import { GEO_SOURCES, formatGeoSource } from "@/lib/geo-sources";
import { LANDING_LAST_UPDATED } from "@/lib/landing-fiscal-constants";

const LandingBelowFold = lazy(() => import("@/components/landing/LandingBelowFold"));

/** Round down to nearest 50, e.g. 327 → "300+", 351 → "350+", 400 → "400+" */
function formatUserCount(count: number): string {
  const rounded = Math.floor(count / 50) * 50;
  return `${rounded}+`;
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const { count: userCount } = usePublicUserCount();
  const userCountLabel = userCount ? formatUserCount(userCount) : "300+";
  const { count: waitlistCount } = useWaitlistCount();
  const formattedWaitlist = waitlistCount !== null ? formatWaitlistCount(waitlistCount) : null;

  // Forza scroll top al mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Carica Cookiebot solo sulla landing page
  useEffect(() => {
    const id = "Cookiebot";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "https://consent.cookiebot.com/uc.js";
    s.type = "text/javascript";
    s.dataset.cbid = "178d78cf-9925-4960-86c9-eefc5f44c216";
    s.dataset.blockingmode = "auto";
    document.head.appendChild(s);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  // Schema @graph combinato (story 79.6): WebPage + FAQPage + SoftwareApplication
  // + Person (author) + Organization (publisher) + BreadcrumbList.
  // Single source of truth FAQ: src/lib/landing-faq.ts.
  // Single source of truth Person/Organization: src/lib/schema-entities.ts.
  // Citation WebPage: selezione di 7 fonti canoniche da GEO_SOURCES pertinenti alla landing.
  const landingCitationIds = [
    "l190-2014-disciplina",
    "l197-2022-soglia-85k",
    "inps-circ-8-2026-gs",
    "inps-circ-14-2026-artcom",
    "l190-2014-allegato-4",
    "l190-2014-startup-5",
    "l190-2014-riduzione-35",
  ];
  const landingCitation = landingCitationIds
    .map((id) => GEO_SOURCES[id])
    .filter((s) => s !== undefined)
    .map((s) => ({ "@type": "CreativeWork", name: formatGeoSource(s!) }));

  const webPageNode = {
    "@type": "WebPage",
    "@id": "https://forfettino.it/#webpage",
    url: "https://forfettino.it/",
    name: "Forfettino — Netto Spendibile Regime Forfettario 2026",
    description: "Calcola il netto spendibile reale nel Regime Forfettario 2026.",
    inLanguage: "it-IT",
    datePublished: "2026-01-01",
    dateModified: `${LANDING_LAST_UPDATED}-01`,
    author: AUTHOR_PERSON_REF,
    publisher: PUBLISHER_ORGANIZATION_REF,
    isPartOf: {
      "@type": "WebSite",
      "@id": "https://forfettino.it/#website",
      url: "https://forfettino.it/",
      name: "Forfettino",
    },
    citation: landingCitation,
  };

  const faqPageNode = {
    "@type": "FAQPage",
    "@id": "https://forfettino.it/#faq",
    mainEntity: landingFaqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const softwareAppNode = {
    "@type": "SoftwareApplication",
    "@id": "https://forfettino.it/#software",
    name: "Forfettino",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    applicationSubCategory: "Tax Calculator",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    description:
      "Calcola il netto spendibile in tempo reale per freelance e professionisti in Regime Forfettario.",
    url: "https://forfettino.it",
    inLanguage: "it-IT",
    author: AUTHOR_PERSON_REF,
    publisher: PUBLISHER_ORGANIZATION_REF,
  };

  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    "@id": "https://forfettino.it/#breadcrumb",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://forfettino.it/",
      },
    ],
  };

  const landingJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode,
      faqPageNode,
      softwareAppNode,
      AUTHOR_PERSON,
      PUBLISHER_ORGANIZATION,
      breadcrumbNode,
    ],
  };

  return (
    <>
      <Helmet>
        <title>Forfettino | Netto Spendibile Regime Forfettario 2026</title>
        <meta
          name="description"
          content={`Calcola tasse, INPS e netto spendibile della tua P.IVA forfettaria in 3 secondi. Gratuito, usato da ${userCountLabel} freelancer.`}
        />
        <link rel="canonical" href="https://forfettino.it/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:site_name" content="Forfettino" />
        <meta property="og:title" content="Il tuo saldo in banca ti sta mentendo — Forfettino" />
        <meta
          property="og:description"
          content={`Hai fatturato ma non sai quanto puoi spendere? Forfettino te lo dice in 3 secondi. Gratis, usato da ${userCountLabel} freelancer.`}
        />
        <meta property="og:url" content="https://forfettino.it/" />
        <meta property="og:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Dashboard e calcolatore fiscale di Forfettino per il regime forfettario" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Forfettino — Quanto puoi spendere oggi?" />
        <meta
          name="twitter:description"
          content="Hai fatturato ma non sai quanto puoi spendere? Forfettino te lo dice in 3 secondi. Gratis."
        />
        <meta name="twitter:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta name="twitter:image:alt" content="Dashboard e calcolatore fiscale di Forfettino per il regime forfettario" />

        {/* Extra SEO */}
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="keywords" content="regime forfettario, netto spendibile, calcolatore tasse forfettario, calcolo tasse partita IVA, alternativa fiscozen gratuita, contributi INPS gestione separata 2026, quanto pago di tasse forfettario, calcolatore forfettario 2026" />
        <link rel="alternate" hrefLang="it-IT" href="https://forfettino.it/" />
        <html lang="it" />

        {/* Structured Data — @graph unico (story 79.6) */}
        <script type="application/ld+json">{JSON.stringify(landingJsonLd)}</script>
      </Helmet>

      <div className="dark min-h-screen bg-background overflow-x-hidden" data-prerender-ready>
        {/* ───────── HEADER ───────── */}
        <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <span className="text-lg font-bold">F</span>
              </div>
              <span className="text-xl font-bold text-foreground">Forfettino</span>
            </div>
            <nav aria-label="Navigazione landing page" className="hidden items-center gap-6 md:flex">
              <a href="#il-problema" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Il Problema
              </a>
              <a href="#come-funziona" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Come Funziona
              </a>
              <a href="#calcolatore" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Calcolatore
              </a>
              <a href="#prezzi" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Prezzi
              </a>
              <Link to="/blog" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Blog
              </Link>
              <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                FAQ
              </a>
            </nav>
            <div className="flex items-center gap-2">
              {!loading && user ? (
                <Button asChild>
                  <Link to="/dashboard">
                    Vai alla Dashboard
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="hidden sm:inline-flex text-white hover:text-white/80" asChild>
                    <Link to="/login">Accedi</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/login">
                      <span className="sm:hidden">Inizia</span>
                      <span className="hidden sm:inline">Inizia gratis</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ───────── HERO — Tensione + Promessa ───────── */}
        <HeroGeometric>
          <motion.p
            custom={0} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
          >
            <Zap className="h-3.5 w-3.5" />
            {waitlistCount !== null && waitlistCount >= 30 && formattedWaitlist
              ? `Usato da ${userCountLabel} freelancer — ${formattedWaitlist} già in lista per PRO`
              : `Usato da ${userCountLabel} freelancer — Gratuito`}
          </motion.p>
          <h1
            className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl"
          >
            Se sei in <span className="text-primary">Regime Forfettario</span>,{" "}
            il tuo saldo in banca ti sta mentendo.
          </h1>
          <motion.p
            custom={2} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            Hai fatturato ma non sai quanto è davvero tuo?
            Forfettino te lo dice ogni giorno — <strong className="text-foreground">quanto puoi spendere, quanto devi tenere da parte, e quando pagare</strong>. Senza sorprese a giugno.
          </motion.p>
          <motion.div
            custom={3} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" asChild>
              <Link to="/login">
                Vedi quanto puoi spendere oggi
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 text-foreground hover:bg-white/10" asChild>
              <a href="#calcolatore">
                <Calculator className="mr-2 h-4 w-4" />
                Prova il Calcolatore
              </a>
            </Button>
          </motion.div>
          <motion.p
            custom={4} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="mt-4 text-sm text-muted-foreground"
          >
            Gratuito, senza carta di credito. Pronto in 30 secondi.
          </motion.p>
          <motion.div
            custom={5} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="mt-6 flex items-center justify-center gap-3"
          >
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                  {['L', 'M', 'A', 'S'][i]}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Già usato da <strong className="text-foreground">{userCountLabel} freelancer</strong> in tutta Italia
            </p>
          </motion.div>
          {/* ───────── Email Capture — Lead Magnet ───────── */}
          <motion.div
            custom={6} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="mt-10"
          >
            <EmailCaptureForm
              source="landing"
              variant="hero"
              leadMagnet="guida_protezione"
              headline="Scarica gratis la Guida Protezione Freelancer"
              subtext="14 pagine su assicurazioni, INPS e pensione integrativa — direttamente nella tua email."
            />
          </motion.div>

          <div className="mt-12 flex justify-center">
            <a href="#il-problema" className="animate-bounce text-muted-foreground/50" aria-label="Scorri verso il basso">
              <ArrowDown className="h-5 w-5" />
            </a>
          </div>
        </HeroGeometric>

        {/* ───────── Below-fold content (lazy loaded) ───────── */}
        <Suspense fallback={<div className="min-h-screen" />}>
          <LandingBelowFold userCountLabel={userCountLabel} />
        </Suspense>
      </div>
    </>
  );
}
