/**
 * Formatta un valore TTV (Time To Value) in minuti in formato human-readable italiano.
 *
 * - 0 min → "< 1 min"
 * - 1-59 min → "47 min"
 * - 60-1440 min (1-24h) → "3h 15min"
 * - > 1440 min (> 1 giorno) → "2,4 giorni"
 */
export function formatTTV(minutes: number): string {
  if (minutes < 1) return "< 1 min";

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes <= 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
  }

  // > 1 giorno: formato italiano con virgola
  const days = minutes / 1440;
  return `${days.toFixed(1).replace(".", ",")} giorni`;
}
