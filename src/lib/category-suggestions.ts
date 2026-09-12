/**
 * Suggerimenti categorie servizio basati sulla categoria ATECO dell'utente.
 * Specifici per ATECO + comuni trasversali per tutti i forfettari.
 */

/** Suggerimenti comuni a tutti i forfettari */
const COMMON = [
  "Assistenza e supporto",
  "Gestione progetto",
  "Copywriting e contenuti",
  "Social media",
  "Sviluppo software",
  "Grafica e design",
  "Traduzioni",
];

/** Suggerimenti specifici per categoria ATECO (mostrati per primi) */
const ATECO_MAP: Record<string, string[]> = {
  professionisti: ["Consulenza", "Formazione", "Progettazione"],
  artigiani: ["Produzione", "Riparazione", "Installazione"],
  commercianti: ["Vendita prodotti", "Vendita servizi", "Intermediazione"],
};

/**
 * Ritorna suggerimenti per la categoria ATECO: specifici per ATECO in cima + comuni.
 * ~10 suggerimenti totali. Nessun duplicato.
 */
export function getSuggestions(atecoCategory: string | null): string[] {
  let specific: string[];

  if (!atecoCategory || atecoCategory.trim() === "") {
    specific = ATECO_MAP.professionisti;
  } else {
    const normalized = atecoCategory.toLowerCase();
    if (normalized.includes("professionist")) {
      specific = ATECO_MAP.professionisti;
    } else if (normalized === "artigiani") {
      specific = ATECO_MAP.artigiani;
    } else if (normalized === "commercianti") {
      specific = ATECO_MAP.commercianti;
    } else {
      specific = ATECO_MAP.professionisti;
    }
  }

  // Specifici + comuni, senza duplicati
  const specificSet = new Set(specific);
  return [...specific, ...COMMON.filter((c) => !specificSet.has(c))];
}
