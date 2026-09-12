/**
 * Palette colori per le categorie di servizio.
 * Hex format richiesto da Recharts per chart rendering.
 */
export const CATEGORY_COLORS: string[] = [
  "#14b8a6", // teal-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#f43f5e", // rose-500
  "#10b981", // emerald-500
  "#0ea5e9", // sky-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
];

/**
 * Ritorna il primo colore hex non presente in usedColors.
 * Se tutti i 10 colori sono usati, cicla con modulo.
 */
export function getNextColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));

  for (const color of CATEGORY_COLORS) {
    if (!usedSet.has(color.toLowerCase())) {
      return color;
    }
  }

  // All used — cycle with modulo
  return CATEGORY_COLORS[usedColors.length % CATEGORY_COLORS.length];
}
