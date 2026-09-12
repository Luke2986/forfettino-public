/**
 * PricingCards — Pricing dinamico basato su launch window.
 *
 * Stati:
 * - Finestra chiusa / loading: 2 card (Free + Pro waitlist)
 * - Finestra aperta (full): 4 card (Free, 6m, 12m consigliato, Lifetime)
 * - Finestra aperta (lifetime chiuso): 3+1 card (Lifetime grayed out)
 * - Cap esaurito: 2 card (Free + Pro "posti esauriti")
 *
 * Usato in: Landing page (PricingSection) e Impostazioni (tab Abbonamento).
 */

import { useState } from "react";
import { Check, X, Bell, CheckCircle2, Users, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { useWaitlistCount, formatWaitlistCount } from "@/hooks/useWaitlistCount";
import { useLaunchWindow } from "@/hooks/useLaunchWindow";
import type { LaunchWindowRow } from "@/hooks/useLaunchWindow";
import { ProWaitlistConsentDialog } from "@/components/subscription/ProWaitlistConsentDialog";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Feature definitions ──

interface FeatureDef {
  freeText: string;
  proText?: string;
  includedInFree: boolean;
}

const ALL_FEATURES: FeatureDef[] = [
  { freeText: "Dashboard fiscale completa", includedInFree: true },
  { freeText: "Calcolo netto spendibile", includedInFree: true },
  { freeText: "Scadenziario con notifiche", includedInFree: true },
  { freeText: "Calendario scadenze", includedInFree: true },
  { freeText: "Incassi manuali (5/anno)", proText: "Incassi illimitati", includedInFree: true },
  { freeText: "Import XML (3/anno)", proText: "Import XML illimitati", includedInFree: true },
  { freeText: "Guida Protezione (anteprima)", proText: "Guida Protezione completa", includedInFree: true },
  { freeText: "Storico tutti gli anni", includedInFree: false },
  { freeText: "Export CSV / Excel", includedInFree: false },
  { freeText: "Report clienti + trend YoY", includedInFree: false },
  { freeText: "Comparatore tariffe", includedInFree: false },
  { freeText: "Task board personale", includedInFree: false },
  { freeText: "Allocazione netto spendibile", includedInFree: false },
];

// ── Plan definitions ──

interface PlanDef {
  id: "free" | "pro" | "six_month" | "annual" | "lifetime";
  name: string;
  subtitle: string;
  price: string;
  priceNote: string;
  features: { text: string; included: boolean }[];
  recommended?: boolean;
  /** Style background for diagonal gradient accent */
  backgroundStyle?: string;
}

function buildPlans(): PlanDef[] {
  const freeFeatures = ALL_FEATURES.map((f) => ({
    text: f.freeText,
    included: f.includedInFree,
  }));

  const proFeatures = ALL_FEATURES.map((f) => ({
    text: f.proText || f.freeText,
    included: true,
  }));

  return [
    {
      id: "free",
      name: "Free",
      subtitle: "Per iniziare a gestire il forfettario",
      price: "€0",
      priceNote: "per sempre",
      features: freeFeatures,
    },
    {
      id: "pro",
      name: "Pro",
      subtitle: "Tutto il potenziale di Forfettino, senza limiti",
      price: "Prezzo rivelato al lancio",
      priceNote: "",
      features: proFeatures,
      recommended: true,
    },
  ];
}

function formatPrice(cents: number): string {
  if (!cents || cents <= 0) return "N/D";
  const euros = cents / 100;
  // Use integer display for clean prices (49, 69, 169)
  return `€${Number.isInteger(euros) ? euros : euros.toFixed(2)}`;
}

function buildLaunchPlans(window: LaunchWindowRow): PlanDef[] {
  const freeFeatures = ALL_FEATURES.map((f) => ({
    text: f.freeText,
    included: f.includedInFree,
  }));

  const proFeatures = ALL_FEATURES.map((f) => ({
    text: f.proText || f.freeText,
    included: true,
  }));

  const prices = window.prices;

  return [
    {
      id: "free",
      name: "Free",
      subtitle: "Per iniziare a gestire il forfettario",
      price: "€0",
      priceNote: "per sempre",
      features: freeFeatures,
    },
    {
      id: "six_month",
      name: "Semestrale",
      subtitle: "6 mesi di Forfettino PRO",
      price: formatPrice(prices.six_month),
      priceNote: "per 6 mesi",
      features: proFeatures,
    },
    {
      id: "annual",
      name: "Annuale",
      subtitle: "12 mesi di Forfettino PRO — il più scelto",
      price: formatPrice(prices.annual),
      priceNote: "per 12 mesi",
      features: proFeatures,
      recommended: true,
    },
    {
      id: "lifetime",
      name: "Lifetime",
      subtitle: "Forfettino PRO per sempre",
      price: formatPrice(prices.lifetime),
      priceNote: "pagamento unico",
      features: proFeatures,
      backgroundStyle: "linear-gradient(to top right, rgba(167,139,250,0.15) 0%, transparent 55%)",
    },
  ];
}

// ── Launch window state derivation ──

type LaunchState = "closed" | "open_full" | "open_lifetime_closed" | "sold_out";

function deriveLaunchState(isOpen: boolean, isLifetimeOpen: boolean, spotsRemaining: number): LaunchState {
  if (!isOpen) return "closed";
  if (spotsRemaining === 0) return "sold_out";
  if (!isLifetimeOpen) return "open_lifetime_closed";
  return "open_full";
}

// ── Sub-components ──

function FeatureRow({
  text,
  included,
  dark,
}: {
  text: string;
  included: boolean;
  dark?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-sm leading-relaxed">
      {included ? (
        <Check
          className={cn(
            "h-4 w-4 shrink-0",
            dark ? "text-teal-400" : "text-teal-500",
          )}
        />
      ) : (
        <X
          className={cn(
            "h-4 w-4 shrink-0",
            dark ? "text-slate-600" : "text-slate-500",
          )}
        />
      )}
      <span
        className={cn(
          "leading-snug",
          included
            ? dark
              ? "text-slate-200"
              : "text-slate-700"
            : dark
              ? "text-slate-500"
              : "text-slate-500",
        )}
      >
        {text}
      </span>
    </li>
  );
}

function SpotsBadge({ spots }: { spots: number }) {
  if (spots <= 0) return null;

  const isUrgent = spots <= 10;
  const isWarning = spots <= 30;

  return (
    <Badge
      className={cn(
        "text-sm font-medium px-2.5 py-0.5 rounded-full border-0",
        isUrgent
          ? "bg-red-100 text-red-700"
          : isWarning
            ? "bg-amber-100 text-amber-800"
            : "bg-teal-100 text-teal-700",
      )}
    >
      {isUrgent ? `ULTIMI ${spots} POSTI` : `${spots} posti rimasti`}
    </Badge>
  );
}

function GuaranteeSection({ dark }: { dark: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 justify-center mb-6",
      )}
      data-testid="guarantee-section"
    >
      <ShieldCheck className={cn("h-5 w-5 shrink-0", dark ? "text-teal-400" : "text-teal-600")} />
      <span className={cn("text-sm", dark ? "text-slate-300" : "text-slate-600")}>
        Garanzia 14 giorni soddisfatto o rimborsato — se non fa per te, rimborso completo senza domande
      </span>
    </div>
  );
}

function TestimonialSection({ dark }: { dark: boolean }) {
  const testimonials = [
    { quote: "Placeholder — da popolare con feedback pre-lancio", author: "Utente 1" },
    { quote: "Placeholder — da popolare con feedback pre-lancio", author: "Utente 2" },
    { quote: "Placeholder — da popolare con feedback pre-lancio", author: "Utente 3" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" data-testid="testimonial-section">
      {testimonials.map((t, i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl p-4 text-sm",
            dark ? "bg-white/[0.06] text-slate-300" : "bg-slate-50 text-slate-600",
          )}
        >
          <p className="italic">&ldquo;{t.quote}&rdquo;</p>
          <p className={cn("mt-2 font-medium", dark ? "text-slate-200" : "text-slate-700")}>
            — {t.author}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ──

interface PricingCardsProps {
  variant: "landing" | "settings";
  isCurrentPlanFree?: boolean;
}

export function PricingCards({ variant, isCurrentPlanFree = true }: PricingCardsProps) {
  const isLanding = variant === "landing";
  const dark = isLanding;
  const { user } = useAuth();
  const { count: waitlistCount } = useWaitlistCount();
  const waitlistFormatted = waitlistCount !== null ? formatWaitlistCount(waitlistCount) : null;
  const [consentOpen, setConsentOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const { toast } = useToast();
  const { isJoined, wasRevoked, rejoin, isLoading: waitlistLoading } = useProWaitlist();

  // Launch window state
  const { window: launchWindow, isOpen, isLifetimeOpen, spotsRemaining, isLoading: lwLoading } = useLaunchWindow();
  const launchState = deriveLaunchState(isOpen, isLifetimeOpen, spotsRemaining);

  // During loading, show default 2-card (no flash)
  const showLaunchCards = !lwLoading && launchState !== "closed" && launchState !== "sold_out" && launchWindow;
  const plans = showLaunchCards ? buildLaunchPlans(launchWindow) : buildPlans();

  // For sold_out state, modify pro card text
  const displayPlans = launchState === "sold_out"
    ? buildPlans().map((p) =>
        p.id === "pro"
          ? { ...p, price: "Posti esauriti", priceNote: "", subtitle: "Iscriviti alla waitlist per il prossimo lancio" }
          : p
      )
    : plans;

  const is4CardMode = showLaunchCards;

  // Placeholder checkout handler
  const handleCheckout = (tier: "six_month" | "annual" | "lifetime", priceInCents: number) => {
    console.warn(`TODO: Stripe checkout for ${tier} at ${priceInCents} cents`);
    toast({
      title: "Checkout in arrivo",
      description: "Funzionalità in sviluppo",
    });
  };

  return (
    <>
      {/* Trust elements — only during open launch window */}
      {is4CardMode && <TestimonialSection dark={dark} />}
      {is4CardMode && <GuaranteeSection dark={dark} />}

      <div
        className={cn(
          "grid w-full mx-auto items-start",
          is4CardMode
            ? "max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            : "max-w-3xl grid-cols-1 sm:grid-cols-2 gap-6",
        )}
      >
        {displayPlans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            dark={dark}
            isLanding={isLanding}
            isCurrentPlanFree={isCurrentPlanFree}
            user={user}
            waitlistFormatted={waitlistFormatted}
            waitlistCount={waitlistCount}
            onWaitlistClick={() =>
              user ? setConsentOpen(true) : setLoginPromptOpen(true)
            }
            launchState={launchState}
            spotsRemaining={spotsRemaining}
            is4CardMode={!!is4CardMode}
            onCheckout={handleCheckout}
            launchWindow={launchWindow}
            isJoined={isJoined}
            wasRevoked={wasRevoked}
            rejoin={rejoin}
            waitlistIsLoading={waitlistLoading}
            className={cn(
              is4CardMode
                ? cn(
                    // Mobile ordering for 4-card: annual(1), lifetime(2), six_month(3), free(4)
                    plan.id === "annual" && "order-1 lg:order-none",
                    plan.id === "lifetime" && "order-2 lg:order-none",
                    plan.id === "six_month" && "order-3 lg:order-none",
                    plan.id === "free" && "order-4 lg:order-none",
                  )
                : cn(
                    // 2-card mode: Pro first on mobile
                    plan.id === "pro" && "order-first sm:order-last",
                    plan.id === "free" && "order-last sm:order-first",
                  ),
            )}
          />
        ))}
      </div>

      {/* Dialog "devi registrarti" — landing, utente non loggato */}
      {isLanding && (
        <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
          <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md bg-slate-900 border-white/10">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/15">
                <Bell className="h-6 w-6 text-teal-400" />
              </div>
              <DialogTitle className="text-lg font-semibold text-white text-center">
                Registrati per essere avvisato
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-slate-300 text-center">
              Per iscriverti alla waitlist Pro, crea un account gratuito. Dopo la
              registrazione, vai su Impostazioni &gt; Abbonamento per attivare la
              notifica.
            </DialogDescription>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                asChild
                className="w-full bg-teal-600 hover:bg-teal-500 text-white border-0"
              >
                <a href="/login">Registrati gratis</a>
              </Button>
              <Button
                variant="ghost"
                className="w-full text-slate-200 hover:text-white hover:bg-white/10"
                onClick={() => setLoginPromptOpen(false)}
              >
                Magari dopo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog consenso — solo settings (utente loggato) */}
      {!isLanding && (
        <ProWaitlistConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
        />
      )}
    </>
  );
}

// ── Single Pricing Card ──

function PricingCard({
  plan,
  dark,
  isLanding,
  isCurrentPlanFree,
  user,
  waitlistFormatted,
  waitlistCount,
  onWaitlistClick,
  launchState,
  spotsRemaining,
  is4CardMode,
  onCheckout,
  launchWindow,
  isJoined,
  wasRevoked,
  rejoin,
  waitlistIsLoading: isLoading,
  className,
}: {
  plan: PlanDef;
  dark: boolean;
  isLanding: boolean;
  isCurrentPlanFree: boolean;
  user: ReturnType<typeof useAuth>["user"];
  waitlistFormatted: string | null;
  waitlistCount: number | null;
  onWaitlistClick: () => void;
  launchState: LaunchState;
  spotsRemaining: number;
  is4CardMode: boolean;
  onCheckout: (tier: "six_month" | "annual" | "lifetime", priceInCents: number) => void;
  launchWindow: LaunchWindowRow | null;
  isJoined: boolean;
  wasRevoked: boolean;
  rejoin: ReturnType<typeof useProWaitlist>["rejoin"];
  waitlistIsLoading: boolean;
  className?: string;
}) {
  const isRecommended = plan.recommended;
  const isFree = plan.id === "free";
  const isPro = plan.id === "pro";
  const isPaidLaunch = plan.id === "six_month" || plan.id === "annual" || plan.id === "lifetime";
  const isLifetimeDisabled = plan.id === "lifetime" && launchState === "open_lifetime_closed";

  return (
    <Card
      className={cn(
        "relative flex flex-col rounded-2xl border-0 transition-all duration-200",
        // Base style
        dark
          ? "bg-white/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)]"
          : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]",
        // Recommended card (annual in 4-card, pro in 2-card): elevated with teal accent
        isRecommended && dark && "bg-white/[0.06] ring-2 ring-teal-500/50 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_8px_24px_rgba(20,184,166,0.15),0_0_0_1px_rgba(20,184,166,0.2)]",
        isRecommended && !dark && "ring-2 ring-teal-500/50 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(20,184,166,0.12),0_0_0_1px_rgba(20,184,166,0.15)]",
        // Lifetime disabled
        isLifetimeDisabled && "opacity-60 pointer-events-none",
        className,
      )}
      style={
        plan.backgroundStyle
          ? { background: `${plan.backgroundStyle}${dark ? ", rgba(255,255,255,0.04)" : ", white"}` }
          : undefined
      }
    >
      {/* Lifetime closed overlay */}
      {isLifetimeDisabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 dark:bg-black/40">
          <span className="text-sm font-semibold text-slate-600">Chiuso</span>
        </div>
      )}

      <CardContent className="flex flex-col flex-1 p-6">
        {/* Badge zone */}
        <div className="flex items-center justify-between mb-4">
          <span
            className={cn(
              "text-base font-semibold",
              dark ? "text-white" : "text-slate-900",
            )}
          >
            {plan.name}
          </span>

          {/* Recommended badge */}
          {isRecommended && is4CardMode && (
            <Badge
              className="text-sm font-medium px-2.5 py-0.5 rounded-full border-0 bg-teal-500 text-white"
            >
              Consigliato
            </Badge>
          )}

          {/* Waitlist count badge — only in 2-card mode on Pro card */}
          {isPro && !is4CardMode && (
            <Badge
              className={cn(
                "text-xs font-medium px-2.5 py-0.5 rounded-full border-0 flex items-center gap-1.5",
                dark
                  ? "bg-teal-500/20 text-teal-300"
                  : "bg-teal-500 text-white",
              )}
            >
              <Users className="h-3 w-3" />
              {waitlistCount !== null && waitlistCount >= 100
                ? "100 posti — Lista piena!"
                : waitlistCount !== null && waitlistCount >= 50 && waitlistFormatted
                  ? `100 posti — ${waitlistFormatted} già in lista`
                  : "100 posti al lancio"}
            </Badge>
          )}

          {!isLanding && isFree && isCurrentPlanFree && (
            <Badge
              variant="outline"
              className="text-xs border-teal-500/40 text-teal-700 bg-teal-50"
            >
              Piano attuale
            </Badge>
          )}
        </div>

        {/* Spots badge — on paid launch cards during open window */}
        {isPaidLaunch && is4CardMode && !isLifetimeDisabled && (
          <div className="mb-3">
            <SpotsBadge spots={spotsRemaining} />
          </div>
        )}

        {/* Subtitle */}
        <p
          className={cn(
            "text-sm mb-5",
            dark ? "text-slate-300" : "text-slate-600",
          )}
        >
          {plan.subtitle}
        </p>

        {/* Price */}
        <div className="mb-1">
          <span
            className={cn(
              "font-bold",
              isFree ? "text-3xl tabular-nums" : isPaidLaunch ? "text-3xl tabular-nums" : "text-lg italic",
              dark ? "text-white" : "text-slate-900",
            )}
          >
            {plan.price}
          </span>
        </div>
        {plan.priceNote ? (
          <p
            className={cn(
              "text-sm mb-6",
              dark ? "text-slate-500" : "text-slate-500",
            )}
          >
            {plan.priceNote}
          </p>
        ) : isPro && !is4CardMode ? (
          <p
            className={cn(
              "text-sm mb-6",
              dark ? "text-teal-400/80" : "text-teal-600",
            )}
          >
            Iscriviti per accesso anticipato
          </p>
        ) : (
          <div className="mb-6" />
        )}

        {/* CTA */}
        <div className="mb-6">
          {isPaidLaunch && is4CardMode ? (
            <LaunchCTA
              plan={plan}
              dark={dark}
              onCheckout={onCheckout}
              launchWindow={launchWindow}
            />
          ) : isLanding ? (
            <LandingCTA
              plan={plan}
              dark={dark}
              user={user}
              onWaitlistClick={onWaitlistClick}
              isSoldOut={launchState === "sold_out"}
            />
          ) : (
            <SettingsCTA
              plan={plan}
              isFree={isFree}
              isCurrentPlanFree={isCurrentPlanFree}
              isJoined={isJoined}
              wasRevoked={wasRevoked}
              rejoin={rejoin}
              isLoading={isLoading}
              onWaitlistClick={onWaitlistClick}
            />
          )}
        </div>

        {/* Separator */}
        <div
          className={cn(
            "border-t mb-5",
            dark ? "border-white/8" : "border-slate-100",
          )}
        />

        {/* Features — same rows on all cards */}
        <ul className="space-y-2.5 flex-1">
          {plan.features.map((f, i) => (
            <FeatureRow key={i} text={f.text} included={f.included} dark={dark} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── CTA variants ──

function LaunchCTA({
  plan,
  dark,
  onCheckout,
  launchWindow,
}: {
  plan: PlanDef;
  dark: boolean;
  onCheckout: (tier: "six_month" | "annual" | "lifetime", priceInCents: number) => void;
  launchWindow: LaunchWindowRow | null;
}) {
  const tier = plan.id as "six_month" | "annual" | "lifetime";
  const priceInCents = launchWindow?.prices?.[tier] ?? 0;

  return (
    <Button
      className={cn(
        "w-full border-0",
        plan.recommended
          ? "bg-teal-600 hover:bg-teal-500 text-white"
          : dark
            ? "bg-white/10 hover:bg-white/15 text-white"
            : "bg-slate-900 hover:bg-slate-800 text-white",
      )}
      onClick={() => onCheckout(tier, priceInCents)}
    >
      Acquista
    </Button>
  );
}

function LandingCTA({
  plan,
  dark,
  user,
  onWaitlistClick,
  isSoldOut,
}: {
  plan: PlanDef;
  dark: boolean;
  user: ReturnType<typeof useAuth>["user"];
  onWaitlistClick: () => void;
  isSoldOut?: boolean;
}) {
  const isFree = plan.id === "free";

  if (isFree) {
    return (
      <Button
        asChild
        variant="outline"
        className={cn(
          "w-full",
          dark
            ? "border-white/20 text-white hover:bg-white/10 hover:text-white"
            : "border-slate-200 text-slate-700",
        )}
      >
        <a href="/login">Inizia gratis</a>
      </Button>
    );
  }

  // Pro (sold_out or waitlist)
  return (
    <Button
      className="w-full border-0 bg-teal-600 hover:bg-teal-500 text-white"
      onClick={onWaitlistClick}
    >
      <Bell className="h-4 w-4 mr-2" />
      {isSoldOut ? "Iscriviti alla waitlist" : "Notificami al lancio"}
    </Button>
  );
}

function SettingsCTA({
  plan,
  isFree,
  isCurrentPlanFree,
  isJoined,
  wasRevoked,
  rejoin,
  isLoading,
  onWaitlistClick,
}: {
  plan: PlanDef;
  isFree: boolean;
  isCurrentPlanFree: boolean;
  isJoined: boolean;
  wasRevoked: boolean;
  rejoin: ReturnType<typeof useProWaitlist>["rejoin"];
  isLoading: boolean;
  onWaitlistClick: () => void;
}) {
  if (isFree) {
    if (isCurrentPlanFree) {
      return (
        <Button
          className="w-full bg-slate-100 text-slate-500 hover:bg-slate-100 cursor-default"
          disabled
        >
          Piano attuale
        </Button>
      );
    }
    return null;
  }

  if (isLoading) {
    return (
      <Button className="w-full" disabled>
        Caricamento...
      </Button>
    );
  }

  if (isJoined) {
    return (
      <Button
        className="w-full border-0 bg-teal-50 text-teal-700 hover:bg-teal-50 cursor-default"
        disabled
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Iscritto alla waitlist
      </Button>
    );
  }

  if (wasRevoked) {
    return (
      <Button
        className="w-full border-0 bg-teal-600 hover:bg-teal-500 text-white"
        onClick={() => rejoin.mutate()}
        disabled={rejoin.isPending}
      >
        <Bell className="h-4 w-4 mr-2" />
        {rejoin.isPending ? "Iscrizione..." : "Iscriviti alla waitlist"}
      </Button>
    );
  }

  return (
    <Button
      className="w-full border-0 bg-teal-600 hover:bg-teal-500 text-white"
      onClick={onWaitlistClick}
    >
      <Bell className="h-4 w-4 mr-2" />
      Notificami al lancio
    </Button>
  );
}
