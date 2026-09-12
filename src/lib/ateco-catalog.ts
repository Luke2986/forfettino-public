/**
 * ATECO Catalog utilities — Story 2.5 + Catalogo Completo
 *
 * Pure functions and constants for ATECO code categorization,
 * validation, and display labels. Used by Wizard and Impostazioni.
 */
import { type GestioneINPS } from "@/lib/fiscal-engine";
import { ATECO_CODES, type AtecoEntry } from "@/data/ateco-codes";
import { getCoeffFromAteco } from "@/lib/ateco-coefficienti";

// Re-export per comodita'
export { ATECO_CODES, type AtecoEntry } from "@/data/ateco-codes";
export { getCoeffFromAteco } from "@/lib/ateco-coefficienti";

/** Maps DB category values to Italian display labels */
export const CATEGORY_LABELS: Record<string, string> = {
  professionisti: "Servizi Professionali",
  artigiani: "Artigiani",
  commercianti: "Commercianti",
};

/** Validates manual profit coefficient in allowed range (Legge 190/2014) */
export function isValidManualCoefficient(val: number): boolean {
  return Number.isFinite(val) && val >= 40 && val <= 86;
}

/** Default category ordering — user's gestione-matching category first */
export function getCategoryOrder(gestione: GestioneINPS | null): string[] {
  const all = ["professionisti", "artigiani", "commercianti"];
  if (!gestione || gestione === "separata") return all;
  // Move user's gestione-matching category to the front
  const matchingCategory = gestione; // "artigiani" or "commercianti" matches exactly
  return [matchingCategory, ...all.filter((c) => c !== matchingCategory)];
}

/** Cerca un codice ATECO nel catalogo statico */
export function findAtecoByCode(code: string): AtecoEntry | undefined {
  return ATECO_CODES.find((e) => e.code === code);
}

/**
 * Label di display per un codice ATECO salvato.
 * Usato da Wizard e Impostazioni per mostrare la selezione corrente.
 */
export function getAtecoDisplayLabel(
  code: string | null,
  coefficient: number,
  isManual: boolean = false,
): string {
  if (isManual) return `Inserimento manuale (${coefficient}%)`;
  if (!code) return `${coefficient}%`;
  const entry = findAtecoByCode(code);
  const coeff = getCoeffFromAteco(code);
  if (entry) {
    return `${entry.code} — ${entry.description} (${coeff}%)`;
  }
  return `${code} (${coefficient}%)`;
}
