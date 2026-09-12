/**
 * Helper di formattazione date in italiano esteso, usato dai badge
 * "Ultimo aggiornamento" nei blog post e "Dati aggiornati a <mese> <anno>"
 * nel footer della landing (story 79.6).
 *
 * IMPORTANT: parse locale-safe — mai `new Date("YYYY-MM-DD")` (UTC midnight,
 * day-shift in positive-offset timezones). Append `T00:00:00` per forzare
 * interpretazione local-time. Regola documentata in CLAUDE.md (Timezone & Date Safety).
 */

const MESI_ITALIANI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

function parseLocalDate(isoDate: string): Date | null {
  if (!isoDate || typeof isoDate !== "string") return null;
  // Accetta "YYYY-MM-DD" oppure "YYYY-MM-DDTHH:mm:ss..."
  const dateOnly = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Formatta una data ISO in italiano esteso: "10 aprile 2026".
 * Parse locale-safe (no UTC day-shift).
 */
export function formatDateItalianLong(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  if (!d) return isoDate; // fallback raw se parsing fallisce
  const day = d.getDate();
  const month = MESI_ITALIANI[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Formatta "YYYY-MM" in "mese YYYY" italiano esteso: "aprile 2026".
 * Se input e' "YYYY-MM-DD" usa comunque solo mese + anno.
 */
export function formatMonthYearItalian(yearMonth: string): string {
  if (!yearMonth || typeof yearMonth !== "string") return yearMonth;
  const match = yearMonth.match(/^(\d{4})-(\d{2})/);
  if (!match) return yearMonth;
  const year = parseInt(match[1], 10);
  const monthIndex = parseInt(match[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return yearMonth;
  return `${MESI_ITALIANI[monthIndex]} ${year}`;
}
