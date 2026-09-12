/**
 * Pure functions for notification preference enforcement.
 * Used by client-side code; the Edge Function has its own inline copy
 * (cannot import from src/lib/ in Deno).
 *
 * IMPORTANT: CATEGORY_DEFAULTS must stay aligned with:
 * - NOTIFICATION_DEFAULTS in src/hooks/useNotificationPreferences.ts
 * - CATEGORY_DEFAULTS in supabase/functions/generate-deadline-notifications/index.ts
 */

export const CATEGORY_DEFAULTS: Record<string, boolean> = {
  scadenze: true,
  insights: true,
  aggiornamenti: true,
};

/**
 * Determina se una categoria di notifica è abilitata per un utente,
 * dato un set di preferenze (da DB o vuoto).
 *
 * Tutte le categorie (scadenze, insights, aggiornamenti) sono modificabili.
 * Se nessuna preferenza utente, fallback ai CATEGORY_DEFAULTS.
 *
 * @param userPrefs Mappa categoria → enabled (può essere vuota per utente nuovo)
 * @param category La categoria da verificare
 */
export function isCategoryEnabled(
  userPrefs: Record<string, boolean>,
  category: string,
): boolean {
  if (category in userPrefs) {
    return userPrefs[category];
  }

  return CATEGORY_DEFAULTS[category] ?? false;
}
