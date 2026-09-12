/**
 * Capitalize the first letter of a string, lowercase the rest.
 * Returns empty string for null/undefined/empty input.
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalize only the first letter, preserving the rest of the string as-is.
 * Useful for proper nouns (e.g. "acme SRL" → "Acme SRL").
 * Returns empty string for null/undefined/empty input.
 */
export function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
