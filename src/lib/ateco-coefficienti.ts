/**
 * Coefficienti di redditività — Legge 190/2014, Allegato 4
 *
 * Mappa le divisioni ATECO (prime 2 cifre) al coefficiente di
 * redditività per il regime forfettario. Fonte ufficiale:
 * Legge 23 dicembre 2014, n. 190, commi 54–89, Allegato 4.
 *
 * In vigore anche nel 2025–2026 durante la fase transitoria
 * verso la nuova classificazione ATECO 2025.
 *
 * Nota: i gruppi 47.81 (ambulanti alimentari) e 47.82–47.89
 * (ambulanti non alimentari) hanno coefficienti speciali diversi
 * dal resto della divisione 47. Questi sono gestiti per gruppo
 * (prime 4 cifre) con priorità sul match per divisione.
 */

/**
 * Mapping speciale per sotto-gruppi (4 cifre) con coefficiente
 * diverso dalla divisione di appartenenza.
 * Chiave: prime 4 cifre (es. "47.81")
 */
const GROUP_OVERRIDES: Record<string, number> = {
  // Ambulanti alimentari → 40%
  "47.81": 40,
  // Ambulanti non alimentari → 54%
  "47.82": 54,
  "47.89": 54,
};

/**
 * Mapping divisione (2 cifre) → coefficiente.
 * Generato dalla tabella Allegato 4, Legge 190/2014.
 */
const DIVISION_COEFF: Record<number, number> = {
  // Gruppo 1: Industrie alimentari e delle bevande — 40%
  10: 40,
  11: 40,
  // Gruppo 2: Commercio all'ingrosso e al dettaglio — 40%
  45: 40,
  46: 40, // NB: 46.1x (intermediari) overridden sotto
  47: 40, // NB: 47.82-47.89 (ambulanti non alim.) overridden sopra
  // Gruppo 5: Costruzioni e attività immobiliari — 86%
  41: 86,
  42: 86,
  43: 86,
  68: 86,
  // Gruppo 7: Attività dei servizi di alloggio e ristorazione — 40%
  55: 40,
  56: 40,
  // Gruppo 8: Attività professionali, scientifiche, tecniche,
  //           sanitarie, di istruzione, servizi finanziari e assicurativi — 78%
  64: 78,
  65: 78,
  66: 78,
  69: 78,
  70: 78,
  71: 78,
  72: 78,
  73: 78,
  74: 78,
  75: 78,
  85: 78,
  86: 78,
  87: 78,
  88: 78,
  // Gruppo 9: Altre attività economiche — 67%
  // Tutto ciò che non rientra nei gruppi sopra: divisioni 01–09, 12–39, 49–63, 77–84, 89–99
};

/**
 * Coefficiente di default per divisioni non esplicitamente mappate.
 * Corrisponde al Gruppo 9 "Altre attività economiche" = 67%.
 */
const DEFAULT_COEFF = 67;

/**
 * Override per sotto-gruppi del commercio intermediari (46.1x) → 62%
 * Questi hanno un coefficiente diverso dal resto della divisione 46 (40%).
 */
const INTERMEDIARI_PREFIX = "46.1";
const INTERMEDIARI_COEFF = 62;

/**
 * Deriva il coefficiente di redditività da un codice ATECO.
 *
 * Logica di priorità:
 * 1. Match per gruppo 4 cifre (GROUP_OVERRIDES) — ambulanti
 * 2. Match per prefisso speciale (46.1x) — intermediari commercio
 * 3. Match per divisione 2 cifre (DIVISION_COEFF)
 * 4. Default 67% (Gruppo 9 "Altre attività")
 *
 * @param code Codice ATECO formato "XX.XX.XX" (es. "70.22.09")
 * @returns Coefficiente di redditività (40–86), mai null
 */
export function getCoeffFromAteco(code: string): number {
  // 1. Check gruppo override (4 cifre: "XX.XX")
  const group4 = code.substring(0, 5); // "47.81"
  if (GROUP_OVERRIDES[group4] !== undefined) {
    return GROUP_OVERRIDES[group4];
  }

  // 2. Check intermediari commercio (46.1x)
  if (code.startsWith(INTERMEDIARI_PREFIX)) {
    return INTERMEDIARI_COEFF;
  }

  // 3. Check divisione (2 cifre)
  const division = parseInt(code.substring(0, 2), 10);
  if (DIVISION_COEFF[division] !== undefined) {
    return DIVISION_COEFF[division];
  }

  // 4. Default: Gruppo 9 "Altre attività economiche"
  return DEFAULT_COEFF;
}
