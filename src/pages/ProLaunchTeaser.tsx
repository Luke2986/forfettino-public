import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  ListTodo,
  PiggyBank,
  CalendarRange,
  UserPlus,
  Mail,
  Clock,
  ArrowRight,
  Users,
} from "lucide-react";
import { CountdownTimer } from "@/components/marketing/CountdownTimer";
import { WaitlistCaptureForm } from "@/components/marketing/WaitlistCaptureForm";
import { useNextLaunchWindow } from "@/hooks/useNextLaunchWindow";
import { useWaitlistCount, formatWaitlistCount } from "@/hooks/useWaitlistCount";
import { usePublicUserCount } from "@/hooks/usePublicUserCount";
import { posthog, isPosthogReady } from "@/lib/posthog";

const canonicalUrl = "https://forfettino.it/pro-presto";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://forfettino.it" },
    { "@type": "ListItem", position: 2, name: "Forfettino PRO", item: canonicalUrl },
  ],
};

const faqData = [
  {
    question: "Quando aprirà il lancio?",
    answer:
      "La data esatta sarà annunciata via email a tutti gli iscritti in waitlist almeno 24 ore prima dell'apertura. Iscriviti per non perdertela!",
  },
  {
    question: "Devo creare un account per iscrivermi?",
    answer:
      "No! Basta la tua email. Se poi crei un account, la tua iscrizione viene collegata automaticamente.",
  },
  {
    question: "Posso uscire dalla waitlist?",
    answer:
      "Certo, puoi revocare la tua iscrizione in qualsiasi momento dalle Impostazioni > Privacy e dati del tuo account.",
  },
  {
    question: "Se il cap 100 posti si esaurisce?",
    answer:
      "I posti sono limitati per ogni finestra di lancio. Se si esauriscono, potrai iscriverti alla prossima finestra. Chi è in waitlist ha priorità.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqData.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

const FEATURES = [
  { icon: FileSpreadsheet, title: "Export CSV", desc: "Esporta incassi, scadenze e report in formato CSV." },
  { icon: BarChart3, title: "Report Clienti", desc: "Analisi fatturato per cliente con concentrazione e trend." },
  { icon: TrendingUp, title: "Benchmark Tariffe", desc: "Confronta le tue tariffe con quelle di altri forfettari." },
  { icon: ListTodo, title: "Task Board", desc: "Pianifica le attività con una board personale stile Kanban." },
  { icon: PiggyBank, title: "Budget Allocazione", desc: "Distribuisci il netto spendibile in categorie personalizzate." },
  { icon: CalendarRange, title: "Multi-Anno", desc: "Accesso a tutti gli anni fiscali, non solo quello corrente." },
] as const;

const STEPS = [
  { icon: UserPlus, title: "Iscriviti in waitlist", badge: null },
  { icon: Mail, title: "Ricevi email 24h prima dell'apertura", badge: "Automatico" },
  { icon: Clock, title: "5 giorni per acquistare, solo 100 posti", badge: null },
] as const;

function AnimatedCounter({ targetValue, duration = 1500 }: { targetValue: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (targetValue <= 0) return;
    if (hasAnimated.current) {
      setDisplayValue(targetValue);
      return;
    }
    hasAnimated.current = true;
    let startTime: number | null = null;
    let rafId = 0;
    let cancelled = false;

    function animate(timestamp: number) {
      if (cancelled) return;
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * targetValue));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [targetValue, duration]);

  return (
    <div className="text-center">
      <span className="text-5xl sm:text-6xl font-bold tabular-nums text-teal-600">
        {displayValue}
      </span>
      <p className="text-sm text-slate-600 mt-1">persone in lista</p>
    </div>
  );
}

export default function ProLaunchTeaser() {
  const viewedRef = useRef(false);
  const [searchParams] = useSearchParams();
  const referredByToken = searchParams.get("wl") || undefined;
  const { startsAt } = useNextLaunchWindow();
  const { count: waitlistCount } = useWaitlistCount();
  const { count: userCount } = usePublicUserCount();

  // Analytics: track page view once
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    if (isPosthogReady) {
      try {
        posthog.capture("pro_teaser_viewed");
      } catch {
        // fail-silent
      }
    }
  }, []);

  const formattedWaitlist = waitlistCount !== null ? formatWaitlistCount(waitlistCount) : null;
  const progressPercent = waitlistCount !== null ? Math.min((waitlistCount / 100) * 100, 100) : 0;
  const isWaitlistFull = waitlistCount !== null && waitlistCount >= 100;

  function trackFaqOpen(question: string) {
    if (isPosthogReady) {
      try {
        posthog.capture("pro_teaser_faq_opened", { question });
      } catch {
        // fail-silent
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <Helmet>
        <title>Forfettino PRO — Iscriviti alla Waitlist</title>
        <meta
          name="description"
          content="Forfettino PRO: export CSV, report clienti, benchmark tariffe, task board e multi-anno per freelancer forfettari. Iscriviti alla waitlist — posti limitati."
        />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="it-IT" href={canonicalUrl} />
        <meta property="og:title" content="Forfettino PRO — Iscriviti alla Waitlist" />
        <meta
          property="og:description"
          content="Forfettino PRO arriva presto. Iscriviti alla waitlist per avere accesso prioritario — solo 100 posti."
        />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:site_name" content="Forfettino" />
        <meta property="og:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Anteprima di Forfettino PRO per freelancer in regime forfettario" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Forfettino PRO — Iscriviti alla Waitlist" />
        <meta
          name="twitter:description"
          content="Forfettino PRO arriva presto. Iscriviti alla waitlist per avere accesso prioritario — solo 100 posti."
        />
        <meta name="twitter:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta name="twitter:image:alt" content="Anteprima di Forfettino PRO per freelancer in regime forfettario" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white">
              <span className="text-sm font-bold">F</span>
            </div>
            <span className="font-semibold text-slate-900">Forfettino</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Blog
            </Link>
            <Button size="sm" asChild>
              <Link to="/login">Accedi</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16 space-y-16">
        {/* ===== HERO ===== */}
        <section className="text-center space-y-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
            Forfettino PRO arriva presto
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Sei in lista?
          </p>

          {/* Countdown */}
          <div className="max-w-md mx-auto">
            <CountdownTimer targetDate={startsAt} />
          </div>

          {/* Social proof counter + badge */}
          <div className="space-y-3">
            {/* Animated counter — visible only if count >= 50 */}
            {waitlistCount !== null && waitlistCount >= 50 && formattedWaitlist && (
              <AnimatedCounter targetValue={parseInt(formattedWaitlist, 10)} />
            )}

            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700">
              <Users className="h-4 w-4" />
              {isWaitlistFull
                ? "La lista si sta riempiendo — cap 100 posti"
                : formattedWaitlist
                  ? `${formattedWaitlist} persone già in lista`
                  : "Unisciti ai primi ad iscriversi"}
            </div>

            {/* Progress bar */}
            {waitlistCount !== null && (
              <div className="max-w-xs mx-auto space-y-1">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-slate-600">
                  {isWaitlistFull
                    ? "Lista piena"
                    : `${formattedWaitlist ?? waitlistCount} / 100 in lista`}
                </p>
              </div>
            )}

            {/* Trust badge */}
            {userCount !== null && userCount > 0 && (
              <p className="text-sm text-slate-500">
                {userCount}+ forfettari usano Forfettino
              </p>
            )}
          </div>

          {/* CTA scroll to form */}
          <Button
            size="lg"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() =>
              document
                .getElementById("waitlist-form")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Iscriviti alla waitlist
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>

        {/* ===== FEATURE CARDS ===== */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center">
            Cosa include PRO
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]"
              >
                <f.icon className="h-6 w-6 text-teal-600 mb-3" />
                <h3 className="text-sm font-semibold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== COME FUNZIONA + FORM ===== */}
        <section id="waitlist-form" className="space-y-8 scroll-mt-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center">
            Come funziona il lancio
          </h2>

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                {/* Step indicator + connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                    <step.icon className="h-5 w-5" />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 mt-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Step {i + 1}: {step.title}
                    </h3>
                    {step.badge && (
                      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-sm font-medium text-teal-700">
                        {step.badge}
                      </span>
                    )}
                  </div>

                  {/* Form inline nello Step 1 */}
                  {i === 0 && (
                    <div className="mt-3 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5">
                      <WaitlistCaptureForm referredByToken={referredByToken} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center">
            Domande frequenti
          </h2>
          <Accordion
            type="single"
            collapsible
            className="max-w-2xl mx-auto"
            onValueChange={(val) => {
              if (val) {
                const idx = parseInt(val.replace("faq-", ""), 10);
                if (!isNaN(idx) && faqData[idx]) {
                  trackFaqOpen(faqData[idx].question);
                }
              }
            }}
          >
            {faqData.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm font-medium text-slate-900 text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent forceMount className="text-sm text-slate-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80">
        <div className="mx-auto max-w-4xl px-4 py-6 flex items-center justify-between text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Forfettino</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-slate-700 transition-colors">
              Privacy
            </Link>
            <Link to="/" className="hover:text-slate-700 transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
