/**
 * Story 55.4 — Cross Analytics insight functions.
 * Pure, deterministic, zero React/Supabase deps.
 */

import type { CrossClient, CrossCategory, CrossCellData } from "@/hooks/useCrossAnalysis";
import { capitalizeFirst } from "@/lib/string-utils";

export interface Insight {
  icon: "TrendingUp" | "Lightbulb" | "Users";
  text: string;
}

/**
 * Insight 1 — Servizio più redditizio.
 * Restituisce la categoria col fatturato più alto e la sua % sul totale.
 */
export function getTopServiceInsight(
  categories: CrossCategory[],
  grandTotal: number,
): Insight | null {
  if (categories.length === 0 || grandTotal <= 0) return null;

  const top = categories[0]; // already sorted DESC
  const pct = Math.round((top.totalGross / grandTotal) * 100);

  return {
    icon: "TrendingUp",
    text: `Il tuo servizio più redditizio è ${capitalizeFirst(top.name)} (${pct}% del fatturato)`,
  };
}

/**
 * Insight 2 — Opportunità cross-sell.
 * Trova clienti mono-servizio (>=2 incassi in una sola categoria)
 * e suggerisce un altro servizio popolare (>=10% del fatturato totale).
 */
export function getCrossSellInsight(
  clients: CrossClient[],
  categories: CrossCategory[],
  matrix: Map<string, Map<string, CrossCellData>>,
  grandTotal: number,
): Insight | null {
  if (clients.length === 0 || categories.length < 2 || grandTotal <= 0) return null;

  for (const client of clients) {
    const ck = client.id ?? "__null__";
    const clientRow = matrix.get(ck);
    if (!clientRow) continue;

    // Find categories this client buys
    const boughtCategories: { catKey: string; receiptCount: number }[] = [];
    for (const [catKey, cell] of clientRow.entries()) {
      if (cell.totalGross > 0) {
        boughtCategories.push({ catKey, receiptCount: cell.receiptCount });
      }
    }

    // Must buy exactly 1 category with >= 2 receipts
    if (boughtCategories.length !== 1) continue;
    if (boughtCategories[0].receiptCount < 2) continue;

    const currentCatKey = boughtCategories[0].catKey;

    // Find a popular alternative category (>= 10% grand total)
    for (const cat of categories) {
      const catKey = cat.id ?? "__null__";
      if (catKey === currentCatKey) continue;
      if (cat.totalGross / grandTotal >= 0.1) {
        const currentCatName = categories.find(c => (c.id ?? "__null__") === currentCatKey)?.name ?? "un servizio";
        return {
          icon: "Lightbulb",
          text: `${capitalizeFirst(client.name)} ti paga solo per ${capitalizeFirst(currentCatName)}. Potresti proporgli anche ${capitalizeFirst(cat.name)}?`,
        };
      }
    }
  }

  return null;
}

/**
 * Insight 3 — Cliente più diversificato.
 * Trova il cliente che compra il maggior numero di servizi diversi (min 2).
 */
export function getMostDiversifiedInsight(
  clients: CrossClient[],
  matrix: Map<string, Map<string, CrossCellData>>,
): Insight | null {
  if (clients.length === 0) return null;

  let bestClient: CrossClient | null = null;
  let bestCount = 0;

  for (const client of clients) {
    const ck = client.id ?? "__null__";
    const clientRow = matrix.get(ck);
    if (!clientRow) continue;

    let count = 0;
    for (const cell of clientRow.values()) {
      if (cell.totalGross > 0) count++;
    }

    if (count > bestCount) {
      bestCount = count;
      bestClient = client;
    }
  }

  if (bestCount < 2 || !bestClient) return null;

  return {
    icon: "Users",
    text: `${capitalizeFirst(bestClient.name)} è il tuo cliente più diversificato: compra ${bestCount} servizi diversi`,
  };
}
