/**
 * marca-bollo.ts — Helper puri per la marca da bollo €2 sulle fatture forfettarie
 *
 * La marca da bollo da 2 € è dovuta sulle fatture senza IVA (regime
 * forfettario) quando gli importi non assoggettati a IVA superano
 * 77,47 € (D.P.R. 642/1972, art. 13 della Tariffa).
 *
 * L'obbligato al pagamento è chi emette la fattura, ma l'addebito al
 * cliente ("rivalsa del bollo") è prassi lecita e diffusa.
 *
 * IMPORTANTE: per l'Agenzia delle Entrate il bollo ADDEBITATO al cliente
 * concorre al reddito del forfettario (interpello 428/2022), quindi il
 * `gross_amount` salvato in DB include sempre il bollo (totale fattura).
 * I calcoli fiscali esistenti NON cambiano — stesso principio della
 * rivalsa INPS 4% (vedi rivalsa-inps.ts).
 *
 * Il bollo pagato dal professionista (NON addebitato) è un costo non
 * deducibile nel forfettario: nessun impatto sui ricavi, fuori scope.
 *
 * Ordine di composizione del totale fattura:
 *   compenso → + rivalsa INPS 4% (se applicata) → + bollo 2 € (se addebitato)
 * Il bollo è un importo FISSO: non è base per la rivalsa né viceversa.
 */
import { sanitizeMoney, subtractMoney, sumMoney } from "@/lib/money";

/** Importo fisso della marca da bollo (€). */
export const MARCA_BOLLO_IMPORTO = 2;

/**
 * Soglia normativa (€): il bollo è dovuto quando gli importi non
 * assoggettati a IVA superano STRETTAMENTE 77,47 €.
 */
export const MARCA_BOLLO_SOGLIA = 77.47;

/**
 * True se il bollo è dovuto per l'importo dato (strettamente > 77,47 €).
 * A 77,47 € esatti il bollo NON è dovuto.
 */
export function isBolloDovuto(importo: number | null | undefined): boolean {
  return sanitizeMoney(importo ?? 0) > MARCA_BOLLO_SOGLIA;
}

/**
 * Somma il bollo fisso al subtotale (compenso + eventuale rivalsa).
 * Esempio: 1040 → 1042
 */
export function totaleConBollo(subtotale: number | null | undefined): number {
  return sumMoney(sanitizeMoney(subtotale ?? 0), MARCA_BOLLO_IMPORTO);
}

export interface BolloBreakdown {
  /** Importo del bollo estratto (2 € se applicato, 0 altrimenti). */
  bollo: number;
  /** Resto del totale al netto del bollo (compenso + eventuale rivalsa). */
  resto: number;
}

/**
 * Dato il totale fattura, estrae la quota bollo (fissa, 2 €) e il resto.
 * Il resto è la base su cui eventualmente estrarre la rivalsa 4/104
 * (vedi breakdownFromTotale in rivalsa-inps.ts): con bollo dentro il
 * totale, la rivalsa va calcolata su (totale − 2), MAI sul totale pieno.
 */
export function estraiBollo(
  totale: number | null | undefined,
  bolloApplied: boolean
): BolloBreakdown {
  const t = sanitizeMoney(totale ?? 0);
  if (!bolloApplied) return { bollo: 0, resto: t };
  const resto = Math.max(0, subtractMoney(t, MARCA_BOLLO_IMPORTO));
  return { bollo: MARCA_BOLLO_IMPORTO, resto };
}
