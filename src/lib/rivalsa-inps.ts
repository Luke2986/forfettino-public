/**
 * rivalsa-inps.ts — Helper puri per il calcolo della rivalsa INPS 4%
 *
 * La rivalsa INPS 4% è un addebito che i forfettari iscritti alla
 * Gestione Separata INPS possono fare al cliente in fattura come
 * rimborso parziale dei contributi.
 *
 * IMPORTANTE: per l'Agenzia delle Entrate la rivalsa è reddito imponibile,
 * quindi il `gross_amount` salvato in DB include sempre la rivalsa
 * (totale fattura). I calcoli fiscali esistenti NON cambiano.
 *
 * Questi helper servono solo per:
 * - convertire compenso ↔ totale nel form
 * - estrarre l'importo rivalsa da un totale fattura esistente
 */
import { multiplyByPercent, sanitizeMoney, subtractMoney, sumMoney, toCents, toEuros } from "@/lib/money";

/** Aliquota rivalsa INPS (% sul compenso base). */
export const RIVALSA_INPS_RATE = 4;

export interface RivalsaBreakdown {
  /** Compenso base (senza rivalsa) — quello che il professionista "guadagna". */
  compenso: number;
  /** Importo della rivalsa 4%. */
  rivalsa: number;
  /** Totale fattura (compenso + rivalsa) — questo è il `gross_amount` che finisce in DB. */
  totale: number;
}

/**
 * Data la base compenso, calcola rivalsa e totale fattura.
 * Esempio: 1000 → { compenso: 1000, rivalsa: 40, totale: 1040 }
 */
export function breakdownFromCompenso(compenso: number | null | undefined): RivalsaBreakdown {
  const base = sanitizeMoney(compenso ?? 0);
  const rivalsa = multiplyByPercent(base, RIVALSA_INPS_RATE);
  const totale = sumMoney(base, rivalsa);
  return { compenso: base, rivalsa, totale };
}

/**
 * Dato il totale fattura (gross_amount con rivalsa inclusa), estrae
 * compenso e rivalsa. Formula: rivalsa = totale × 4/104.
 *
 * Usato per:
 * - mostrare il breakdown su incassi esistenti
 * - attivare il flag rivalsa retroattivamente su un incasso senza
 *   ricalcolare il gross_amount
 */
export function breakdownFromTotale(totale: number | null | undefined): RivalsaBreakdown {
  const t = sanitizeMoney(totale ?? 0);
  if (t <= 0) return { compenso: 0, rivalsa: 0, totale: 0 };
  // rivalsa = totale × 4/104, usando i centesimi per precisione
  const totCents = toCents(t);
  const rivalsaCents = Math.round((totCents * RIVALSA_INPS_RATE) / (100 + RIVALSA_INPS_RATE));
  const rivalsa = toEuros(rivalsaCents);
  const compenso = subtractMoney(t, rivalsa);
  return { compenso, rivalsa, totale: t };
}

/**
 * True se l'inps_type del settings è "gestione_separata".
 * Accetta anche stringhe case-insensitive e variazioni legacy.
 */
export function isGestioneSeparata(inpsType: string | null | undefined): boolean {
  if (!inpsType) return false;
  return inpsType.toLowerCase().replace(/[-\s]/g, "_") === "gestione_separata";
}
