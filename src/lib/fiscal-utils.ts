/**
 * fiscal-utils.ts — Pure utility functions for fiscal derivation logic.
 * Separated from page components for reusability (Story 2.7, review fix M3).
 *
 * These functions have NO React/Supabase dependencies — pure input → output.
 */

/** Derive aliquota sostitutiva from anno apertura partita IVA.
 * Returns suggested rate (5 or 15) with metadata, or null if anno is not set (manual mode).
 * Rule: 5% for first 5 solar years, 15% from 6th year onwards.
 * Solar year counting: anno apertura = year 1. Switch at (annoApertura + 5). */
export function deriveAliquotaSostitutiva(
  annoAperturaPiva: number | null,
  annoFiscale: number
): { aliquota: 5 | 15; derivata: true; annoCorrente: number; anniRimanenti: number } | null {
  if (annoAperturaPiva == null) return null;
  // Guard: dato inconsistente — anno fiscale non può essere prima dell'apertura
  if (annoFiscale < annoAperturaPiva) return null;
  const annoSwitch = annoAperturaPiva + 5;
  const annoCorrente = annoFiscale - annoAperturaPiva + 1;
  const anniRimanenti = Math.max(0, annoSwitch - annoFiscale);
  const aliquota: 5 | 15 = annoFiscale >= annoSwitch ? 15 : 5;
  return { aliquota, derivata: true, annoCorrente, anniRimanenti };
}

/** Soglia forfettaria piena (L. 190/2014 art. 1 c. 54 lett. a, come mod. da L. 197/2022). */
export const SOGLIA_FORFETTARIO_PIENA = 85000;

/** Giorni dell'anno solare indicato (366 se bisestile). */
function giorniNellAnno(anno: number): number {
  const bisestile = (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;
  return bisestile ? 366 : 365;
}

/**
 * Soglia forfettaria ragguagliata ad anno per apertura P.IVA in corso d'anno.
 *
 * NORMA: L. 190/2014 art. 1 c. 54 lett. a) — «hanno conseguito ricavi ovvero
 * hanno percepito compensi, ragguagliati ad anno, non superiori a euro 85.000».
 * Circ. AdE 10/E/2016 §2.2: «Tale limite deve essere ragguagliato all'anno nel
 * caso di attività iniziata in corso di anno.»
 * La norma ragguaglia i RICAVI, la circolare il LIMITE: forme algebricamente
 * equivalenti. Qui si ragguaglia il limite, perché è ciò che l'utente vede
 * come residuo fatturabile.
 *
 * EFFETTO: il superamento preclude il regime dall'anno SUCCESSIVO (c. 71 primo
 * periodo; Circ. 32/E/2023 §4.3), NON dall'anno stesso.
 *
 * ⚠️ NON APPLICARE ALLA SOGLIA DEI 100.000 €. Circ. 32/E/2023 §4.3: «il
 * legislatore [...] ha espressamente previsto il ragguaglio con esclusivo
 * riferimento alla soglia degli 85.000 euro e non a quella di 100.000 euro
 * [...] da intendersi in termini assoluti». L'asimmetria è di legge: le due
 * soglie non devono condividere logica di proporzionamento.
 *
 * ⚠️ CONVENZIONI NON NORMATIVE (ADR-001, story 88-1 — RICHIEDONO SIGN-OFF).
 * Nessuna fonte primaria definisce il conteggio dei giorni: le stringhe «365»,
 * «366» e «giorni» non compaiono né in Circ. 10/E/2016 né in Circ. 32/E/2023.
 * Sono scelte di implementazione, non regole:
 *   1. divisore = giorni effettivi dell'anno (365/366). La prassi prevalente
 *      usa 365 fisso; hardcodarlo sarebbe invisibile fino al 2027 e
 *      silenziosamente errato dal 2028 (primo anno bisestile utile).
 *   2. il giorno di apertura è incluso nel conteggio (delta ~233 € su 85k
 *      per un'apertura a giugno: a ridosso della soglia cambia l'esito).
 *   3. «giorni di attività» = dalla data dichiarata (modello AA9), non dal
 *      primo incasso.
 *
 * @param dataApertura data di apertura P.IVA; null se l'utente ha solo l'anno
 * @param annoFiscale anno di riferimento
 * @param sogliaPiena soglia non ragguagliata (default 85.000)
 * @returns soglia piena se dataApertura è null (utenti pre-esistenti: nessun
 *          ragguaglio, comportamento invariato) o se annoFiscale non è l'anno
 *          di apertura (dal 2° anno l'attività copre l'anno intero)
 */
export function calcolaSogliaRagguagliata(
  dataApertura: Date | null,
  annoFiscale: number,
  sogliaPiena: number = SOGLIA_FORFETTARIO_PIENA,
): number {
  // Utenti con solo l'anno: trattati come 01/01 -> nessun ragguaglio.
  // Sbagliare per eccesso di limite è meno grave che dire a qualcuno che ha
  // sforato quando non è vero.
  if (dataApertura == null) return sogliaPiena;

  // Il ragguaglio vale solo per l'anno di apertura.
  if (annoFiscale !== dataApertura.getFullYear()) return sogliaPiena;

  // Conteggio in date LOCALI: usare UTC sposterebbe il giorno di un'unità
  // nei fusi a est di Greenwich, falsando il numeratore.
  const inizio = new Date(
    dataApertura.getFullYear(),
    dataApertura.getMonth(),
    dataApertura.getDate(),
  );
  const fine = new Date(annoFiscale, 11, 31);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // +1: il giorno di apertura è incluso (ADR-001 decisione 2)
  const giorniAttivita =
    Math.round((fine.getTime() - inizio.getTime()) / MS_PER_DAY) + 1;

  if (giorniAttivita <= 0) return sogliaPiena;

  const divisore = giorniNellAnno(annoFiscale);
  if (giorniAttivita >= divisore) return sogliaPiena;

  return Math.round(((sogliaPiena * giorniAttivita) / divisore) * 100) / 100;
}
