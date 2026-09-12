/**
 * money.ts - Utility per calcoli monetari deterministici
 *
 * STRATEGIA: Tutti i calcoli interni in centesimi (integer)
 * per evitare errori floating point.
 *
 * Esempio: 100.50€ → 10050 centesimi internamente
 */

// === COSTANTI ===
export const CENTS_PER_EURO = 100;
export const MAX_PRECISION_DECIMALS = 2;

// === CONVERSIONI ===

/**
 * Converte euro in centesimi (integer)
 * @param euros - importo in euro (es. 100.50)
 * @returns centesimi come intero (es. 10050)
 */
export function toCents(euros: number | null | undefined): number {
  if (euros == null || isNaN(euros)) return 0;
  // Moltiplica e arrotonda per evitare errori floating point
  return Math.round(euros * CENTS_PER_EURO);
}

/**
 * Converte centesimi in euro
 * @param cents - importo in centesimi (es. 10050)
 * @returns euro come numero (es. 100.50)
 */
export function toEuros(cents: number): number {
  return cents / CENTS_PER_EURO;
}

// === ARROTONDAMENTO ===

/**
 * Arrotonda a 2 decimali in modo deterministico (banker's rounding evitato)
 * Usa Math.round standard (round half away from zero)
 */
export function roundMoney(amount: number | null | undefined): number {
  if (amount == null || isNaN(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

// === OPERAZIONI SICURE ===

/**
 * Somma sicura di importi monetari
 * Converte in centesimi, somma, riconverte
 */
export function sumMoney(...amounts: (number | null | undefined)[]): number {
  const totalCents = amounts.reduce((sum, amt) => sum + toCents(amt), 0);
  return toEuros(totalCents);
}

/**
 * Sottrazione sicura
 */
export function subtractMoney(a: number | null | undefined, b: number | null | undefined): number {
  return toEuros(toCents(a) - toCents(b));
}

/**
 * Moltiplicazione sicura (amount * percentage)
 * @param amount - importo base
 * @param percentage - percentuale (es. 15 per 15%, non 0.15)
 */
export function multiplyByPercent(amount: number | null | undefined, percentage: number): number {
  if (amount == null || isNaN(amount)) return 0;
  const cents = toCents(amount);
  const resultCents = Math.round(cents * percentage / 100);
  return toEuros(resultCents);
}

// === SPLIT CON COMPENSAZIONE RESTO ===

/**
 * Divide un importo in rate garantendo che la somma sia esatta.
 * Il resto viene assegnato all'ultima rata.
 *
 * @param total - importo totale da dividere
 * @param percentages - array di percentuali (es. [40, 60] per 40%/60%)
 * @returns array di importi la cui somma === total (entro tolleranza 0.01)
 *
 * @example
 * splitWithRemainder(100.01, [40, 60])
 * // → [40.00, 60.01] (resto assegnato alla seconda rata)
 */
export function splitWithRemainder(total: number | null | undefined, percentages: number[]): number[] {
  if (total == null || isNaN(total) || total === 0) {
    return percentages.map(() => 0);
  }

  const totalCents = toCents(total);
  const results: number[] = [];
  let allocatedCents = 0;

  // Calcola tutte le rate tranne l'ultima
  for (let i = 0; i < percentages.length - 1; i++) {
    const rateCents = Math.round(totalCents * percentages[i] / 100);
    results.push(toEuros(rateCents));
    allocatedCents += rateCents;
  }

  // L'ultima rata prende il resto (garantisce somma = totale)
  const lastRateCents = totalCents - allocatedCents;
  results.push(toEuros(lastRateCents));

  return results;
}

/**
 * Versione specializzata per split 40/60 (acconti imposta)
 */
export function split40_60(total: number | null | undefined): { first: number; second: number } {
  const [first, second] = splitWithRemainder(total, [40, 60]);
  return { first, second };
}

/**
 * Versione specializzata per split 50/50 (acconti INPS)
 */
export function split50_50(total: number | null | undefined): { first: number; second: number } {
  const [first, second] = splitWithRemainder(total, [50, 50]);
  return { first, second };
}

// === VALIDAZIONE ===

/**
 * Verifica che un importo sia valido per operazioni monetarie
 */
export function isValidMoney(amount: unknown): amount is number {
  return typeof amount === 'number' && !isNaN(amount) && isFinite(amount);
}

/**
 * Verifica che un importo non sia negativo
 */
export function isNonNegative(amount: number | null | undefined): boolean {
  if (amount == null) return true; // null/undefined trattati come 0
  return isValidMoney(amount) && amount >= 0;
}

/**
 * Sanifica un importo: se invalido restituisce 0
 */
export function sanitizeMoney(amount: unknown): number {
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount);
    return isValidMoney(parsed) ? roundMoney(parsed) : 0;
  }
  if (typeof amount === 'number' && isValidMoney(amount)) {
    return roundMoney(amount);
  }
  return 0;
}

// === INVARIANTI ===

/**
 * Verifica che la somma dei componenti sia uguale al totale
 * con tolleranza di 0.01€ (1 centesimo)
 *
 * @throws Error se l'invariante è violato
 */
export function assertBreakdownEquals(
  total: number,
  components: number[],
  context: string = 'breakdown'
): void {
  const sum = sumMoney(...components);
  const diff = Math.abs(sum - total);
  const TOLERANCE = 0.01;

  if (diff > TOLERANCE) {
    console.error(
      `[INVARIANT VIOLATION] ${context}: sum(${components.join(' + ')}) = ${sum}, expected ${total}, diff = ${diff}`
    );
    // In produzione logga ma non blocca; in dev potrebbe throwbare
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Invariant violation in ${context}: breakdown sum ${sum} !== total ${total}`);
    }
  }
}

/**
 * Verifica che breakdown == totale e ritorna boolean
 */
export function checkBreakdownEquals(total: number, components: number[]): boolean {
  const sum = sumMoney(...components);
  return Math.abs(sum - total) <= 0.01;
}

// === FORMATTAZIONE ===

/**
 * Formatta importo in euro italiano
 */
export function formatCurrency(amount: number | null | undefined): string {
  const sanitized = sanitizeMoney(amount);
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(sanitized);
}

// === CALCOLI FISCALI SPECIFICI ===

/**
 * Calcola imponibile da incassi lordi
 * imponibile = incassi * coefficiente_redditività
 */
export function calculateTaxableAmount(
  grossReceipts: number,
  profitCoefficientPercent: number
): number {
  return multiplyByPercent(grossReceipts, profitCoefficientPercent);
}

/**
 * Calcola imposta sostitutiva
 * imposta = imponibile * aliquota
 */
export function calculateTax(
  taxableAmount: number,
  taxRatePercent: number
): number {
  return multiplyByPercent(taxableAmount, taxRatePercent);
}

/**
 * Calcola contributi INPS
 * inps = imponibile * aliquota_inps
 */
export function calculateInps(
  taxableAmount: number,
  inpsRatePercent: number
): number {
  return multiplyByPercent(taxableAmount, inpsRatePercent);
}

/**
 * Calcola acconti imposta sostitutiva (metodo storico)
 *
 * Regole:
 * - Se imposta <= 51.65€: nessun acconto
 * - Se imposta <= 257.52€: unica rata a novembre
 * - Altrimenti: 40% a giugno, 60% a novembre
 */
export function calculateTaxAdvances(taxAmount: number): {
  total: number;
  first: number;
  second: number;
  single: number;
  hasTwoPayments: boolean;
} {
  const TAX_ADVANCE_THRESHOLD_ZERO = 51.65;
  const TAX_ADVANCE_THRESHOLD_SINGLE = 257.52;

  const sanitized = sanitizeMoney(taxAmount);

  if (sanitized <= TAX_ADVANCE_THRESHOLD_ZERO) {
    return { total: 0, first: 0, second: 0, single: 0, hasTwoPayments: false };
  }

  if (sanitized <= TAX_ADVANCE_THRESHOLD_SINGLE) {
    return { total: sanitized, first: 0, second: 0, single: sanitized, hasTwoPayments: false };
  }

  // 2 rate con compensazione resto
  const { first, second } = split40_60(sanitized);
  return { total: sanitized, first, second, single: 0, hasTwoPayments: true };
}

/**
 * Calcola acconti INPS (80% del totale diviso 50/50)
 *
 * Regole:
 * - Acconti = 80% dell'INPS dovuto
 * - Prima rata: 50% degli acconti (giugno)
 * - Seconda rata: 50% degli acconti (novembre)
 */
export function calculateInpsAdvances(inpsAmount: number): {
  total: number;
  first: number;
  second: number;
} {
  const sanitized = sanitizeMoney(inpsAmount);
  const total = multiplyByPercent(sanitized, 80); // 80% del totale
  const { first, second } = split50_50(total);
  return { total, first, second };
}
