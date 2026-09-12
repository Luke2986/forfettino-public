/**
 * DemoDashboard — onboarding demo with fake data.
 *
 * Story 38-1: Replaces the empty state when the user has zero incassi.
 * Shows Hero + 3 KPI with realistic demo data, then a disclaimer card below.
 * Everything else (scadenze, chart, header sections) is shown as blurred grey placeholders.
 *
 * Pattern: "Show first, explain after" (SCAMPER S5) —
 * user sees the numbers first (immediate value), then reads the explanation below.
 */

import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import { SpendibileHero } from "@/components/dashboard/SpendibileHero";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { GestioneINPS } from "@/lib/fiscal-engine";
import { getDemoData } from "./demoData";

interface DemoDashboardProps {
  gestioneINPS: GestioneINPS;
  onDismiss: () => void;
}

export function DemoDashboard({ gestioneINPS, onDismiss }: DemoDashboardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const demo = getDemoData(gestioneINPS);

  const handleDismiss = () => {
    // localStorage is managed by parent Dashboard (user-specific key)
    onDismiss();
  };

  const handleCardClick = () => {
    toast({
      title: "Questo \u00E8 un esempio",
      description:
        "Registra i tuoi incassi per vedere il dettaglio reale con breakdown INPS e imposta.",
    });
  };

  const handleCta = () => {
    navigate("/incassi/nuovo");
  };

  return (
    <div className="space-y-4 sm:space-y-5" data-testid="demo-dashboard">
      {/* ── 1. Hero + KPI cards (nitide) ── */}
      <section className="space-y-3 sm:space-y-4">
        {/* Hero — SpendibileHero presentazionale puro */}
        <SpendibileHero
          spendable={demo.spendibile}
          sogliaIncassi={demo.incassi}
          sogliaLimite={85000}
          helpText="Esempio: quanto ti resterebbe in tasca con 10.000\u00A0\u20AC di incassi."
          breakdownContent={
            <p className="text-sm text-slate-600">
              Questo è un esempio.{"\n"}Registra i tuoi incassi per vedere il
              dettaglio reale con breakdown INPS e imposta sostitutiva.
            </p>
          }
        />

        {/* 3 KPI cards grid — tighter gap on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Entrate */}
          <SpotlightCard glowColor="blue" className="rounded-2xl">
            <KpiCard
              label={demo.entrateLabel}
              subtitle={demo.entrateSubtitle}
              value={formatCurrency(demo.incassi)}
              accentColor="border-l-blue-300"
              valueColor="text-slate-800"
              onClick={handleCardClick}
            />
          </SpotlightCard>

          {/* Da coprire */}
          <SpotlightCard glowColor="amber" className="rounded-2xl">
            <KpiCard
              label="Da coprire"
              subtitle={demo.daCoprireSubtitle}
              value={formatCurrency(demo.daCoprire)}
              accentColor="border-l-amber-400"
              valueColor="text-amber-700"
              onClick={handleCardClick}
            />
          </SpotlightCard>

          {/* Proiezione */}
          <SpotlightCard glowColor="violet" className="rounded-2xl">
            <KpiCard
              label={demo.proiezioneLabel}
              subtitle={demo.proiezioneSubtitle}
              value={formatCurrency(demo.daCoprire)}
              accentColor="border-l-violet-400"
              valueColor="text-violet-700"
              onClick={handleCardClick}
            />
          </SpotlightCard>
        </div>
      </section>

      {/* ── 2. Disclaimer card SOTTO le card (pattern "show first, explain after") ── */}
      <div
        className="relative bg-teal-50/60 border border-teal-200/50 rounded-2xl p-5 sm:p-8"
        data-testid="demo-disclaimer"
      >
        {/* X close button */}
        <button
          onClick={handleDismiss}
          className={cn(
            "absolute top-3 right-3",
            "rounded-full p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100/80",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "min-h-[44px] min-w-[44px] flex items-center justify-center",
          )}
          aria-label="Chiudi demo"
          data-testid="demo-dismiss-x"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Disclaimer text — titolo handwriting, corpo leggibile */}
        {(() => {
          const [title, ...bodyParts] = demo.disclaimerText.split("\n");
          return (
            <div className="pr-8 space-y-1.5 sm:space-y-2">
              <p className="font-caveat text-xl sm:text-2xl font-bold text-slate-800">
                {title}
              </p>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {bodyParts.join("\n")}
              </p>
            </div>
          );
        })()}

        {/* CTA */}
        <div className="mt-4 sm:mt-5">
          <Button
            size="lg"
            onClick={handleCta}
            className="w-full sm:w-auto"
            data-testid="demo-cta-register"
          >
            Registra il primo incasso
          </Button>
        </div>
      </div>

      {/* ── 3. Blurred placeholder zones (desktop only — wastes scroll space on mobile) ── */}
      <div className="hidden sm:block space-y-4 demo-blur-zone" aria-hidden="true">
        {/* Scadenze placeholder */}
        <div className="bg-slate-200/60 rounded-2xl h-32" />
        {/* Chart placeholder */}
        <div className="bg-slate-200/60 rounded-2xl h-[180px]" />
      </div>

      {/* ── "Salta demo" link — centered on mobile, right-aligned on desktop ── */}
      <div className="flex justify-center sm:justify-end">
        <button
          onClick={handleDismiss}
          className={cn(
            "text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm",
            "min-h-[44px] px-2 flex items-center",
          )}
          data-testid="demo-skip"
        >
          Salta demo
        </button>
      </div>
    </div>
  );
}
