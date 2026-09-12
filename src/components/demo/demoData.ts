/**
 * Demo dashboard data — hardcoded constants for the onboarding demo.
 *
 * Story 38-1: Dashboard Demo Onboarding
 *
 * Two variants: Separata and Artigiani/Commercianti.
 * All values are PRE-CALCULATED and NEVER derived at runtime.
 *
 * Common parameters:
 * - P.IVA 2026, primo anno, zero storico
 * - Coefficiente redditività: 78%
 * - Aliquota sostitutiva: 5%
 * - Incassi: 10.000 EUR
 * - Reddito imponibile: 7.800 EUR
 */
import type { GestioneINPS } from "@/lib/fiscal-engine";

// ── Interface ──

export interface DemoVariant {
  /** Net spendable amount (EUR) */
  spendibile: number;
  /** Total taxes + contributions to set aside (EUR) */
  daCoprire: number;
  /** Total receipts (EUR) */
  incassi: number;
  /** INPS contribution amount (EUR) */
  inps: number;
  /** Imposta sostitutiva amount (EUR) */
  imposta: number;
  /** Projected outflows label year */
  proiezioneAnno: number;
  /** Hero card label */
  heroLabel: string;
  /** KPI Entrate label */
  entrateLabel: string;
  /** KPI Entrate subtitle */
  entrateSubtitle: string;
  /** KPI Da coprire subtitle */
  daCoprireSubtitle: string;
  /** KPI Proiezione label */
  proiezioneLabel: string;
  /** KPI Proiezione subtitle */
  proiezioneSubtitle: string;
  /** Disclaimer text (handwriting card) */
  disclaimerText: string;
}

// ── Constants ──

export const DEMO_DISMISSED_KEY = "forfettino_demo_dismissed";

const DEMO_YEAR = new Date().getFullYear();

export const DEMO_SEPARATA: DemoVariant = {
  spendibile: 7678.21,
  daCoprire: 2321.79,
  incassi: 10000,
  inps: 2033.46,
  imposta: 288.33,
  proiezioneAnno: DEMO_YEAR + 1,
  heroLabel: "Netto Spendibile",
  entrateLabel: `Entrate ${DEMO_YEAR}`,
  entrateSubtitle: "Incassi da inizio anno",
  daCoprireSubtitle: "Tra imposte e contributi",
  proiezioneLabel: `Proiezione ${DEMO_YEAR + 1}`,
  proiezioneSubtitle: "Uscite previste dal conto",
  disclaimerText:
    "Ecco un esempio di come funziona Forfettino!\nCon 10.000 \u20AC di incassi, ti restano 7.678 \u20AC da spendere \u2014 il resto va in tasse e contributi.\nRegistra il tuo primo incasso per vedere i tuoi numeri reali.",
};

export const DEMO_ARTIGIANI_COMMERCIANTI: DemoVariant = {
  spendibile: 6818.06,
  daCoprire: 3181.94,
  incassi: 10000,
  inps: 2938.88,
  imposta: 243.06,
  proiezioneAnno: DEMO_YEAR + 1,
  heroLabel: "Netto Spendibile",
  entrateLabel: `Entrate ${DEMO_YEAR}`,
  entrateSubtitle: "Incassi da inizio anno",
  daCoprireSubtitle: "Tra imposte e contributi",
  proiezioneLabel: `Proiezione ${DEMO_YEAR + 1}`,
  proiezioneSubtitle: "Uscite previste dal conto",
  disclaimerText:
    "Ecco un esempio di come funziona Forfettino!\nCon 10.000 \u20AC di incassi e riduzione 35%, ti restano 6.818 \u20AC da spendere.\nRegistra il tuo primo incasso per vedere i tuoi numeri reali.",
};

/**
 * Returns the demo data variant matching the user's gestione INPS.
 * Artigiani and Commercianti share the same demo numbers (intentional simplification,
 * real difference is ~56 EUR).
 */
export function getDemoData(gestioneINPS: GestioneINPS): DemoVariant {
  if (gestioneINPS === "artigiani" || gestioneINPS === "commercianti") {
    return DEMO_ARTIGIANI_COMMERCIANTI;
  }
  return DEMO_SEPARATA;
}
