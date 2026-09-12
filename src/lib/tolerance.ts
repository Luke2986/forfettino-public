/**
 * tolerance.ts - Classificazione dello scostamento tra stima Forfettino e
 * importo realmente pagato dall'utente al "segna come pagata".
 *
 * Forfettino e' un calcolatore approssimativo: l'importo pagato reale puo'
 * differire dalla stima per cause lato-engine (coefficiente/fascia errati) o
 * lato-realta' (compensazioni, ravvedimenti, redditi reinseriti).
 *
 * Modello IBRIDO: errore relativo + floor assoluto. Il floor protegge i piccoli
 * importi dal rumore (su 300 EUR il solo arrotondamento F24 sfora il 2%), il
 * relativo governa i grandi (su 10.000 EUR il 2% sono 200 EUR significativi).
 *
 * IMPORTANT: soglie centralizzate qui, single source of truth. Da tarare sui
 * dati reali una volta raccolta la distribuzione dei delta (tabella
 * payment_discrepancies).
 *
 * Tutti gli importi in CENTESIMI (integer), coerente con money.ts.
 */

export type ToleranceBand = "green" | "yellow" | "red";

export interface ToleranceThresholds {
  /** Banda verde: errore relativo accettabile (0.02 = 2%) */
  relPct: number;
  /** Floor assoluto in centesimi per la banda verde (2500 = 25 EUR) */
  floorCents: number;
  /** Confine giallo/rosso: errore relativo (0.10 = 10%) */
  yellowPct: number;
  /**
   * Floor assoluto in centesimi per la banda gialla (5000 = 50 EUR). Piu' alto
   * del floor verde: senza, sulle rate piccole (< 250 EUR, es. INPS trimestrali)
   * la banda gialla collasserebbe sulla verde e si salterebbe verde→rosso. Da'
   * respiro alle rate piccole. Tarabile.
   */
  yellowFloorCents: number;
}

export const DEFAULT_TOLERANCE: ToleranceThresholds = {
  relPct: 0.02,
  floorCents: 2500,
  yellowPct: 0.1,
  yellowFloorCents: 5000,
};

export interface DeltaClassification {
  band: ToleranceBand;
  /** paid - estimated, in centesimi. Positivo = pagato piu' della stima. */
  deltaCents: number;
  /** delta / estimated, ratio firmato. 0 se stima nulla. */
  deltaPct: number;
}

/**
 * Confine della banda verde in centesimi: max(percentuale, floor).
 * Esposto per riuso in UI (es. mostrare "entro X EUR e' ok").
 */
export function greenBandCents(
  estimatedCents: number,
  t: ToleranceThresholds = DEFAULT_TOLERANCE,
): number {
  return Math.max(Math.round(estimatedCents * t.relPct), t.floorCents);
}

/**
 * Classifica lo scostamento tra stima e pagato reale.
 *
 * @param estimatedCents stima Forfettino in centesimi
 * @param paidCents      importo realmente pagato in centesimi
 */
export function classifyDelta(
  estimatedCents: number,
  paidCents: number,
  t: ToleranceThresholds = DEFAULT_TOLERANCE,
): DeltaClassification {
  const deltaCents = Math.round(paidCents) - Math.round(estimatedCents);
  const absDelta = Math.abs(deltaCents);

  const green = greenBandCents(estimatedCents, t);
  // yellow >= green sempre garantito (yellowFloorCents > floorCents e
  // yellowPct > relPct), cosi' la banda gialla non e' mai vuota oltre i 250 EUR.
  const yellow = Math.max(Math.round(estimatedCents * t.yellowPct), t.yellowFloorCents);

  let band: ToleranceBand;
  if (absDelta <= green) {
    band = "green";
  } else if (absDelta <= yellow) {
    band = "yellow";
  } else {
    band = "red";
  }

  const deltaPct = estimatedCents > 0 ? deltaCents / estimatedCents : 0;

  return { band, deltaCents, deltaPct };
}

/** True se la banda richiede di chiedere il motivo (fuori dal verde). */
export function shouldAskReason(band: ToleranceBand): boolean {
  return band !== "green";
}
