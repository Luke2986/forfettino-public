/**
 * Pure helper for nurture email delta logic.
 * Used by the Edge Function (copy) and tested locally.
 *
 * KEEP IN SYNC with supabase/functions/send-waitlist-nurture/index.ts getEmailTypeForDelta()
 */

export type EmailType = "nurture_t14" | "nurture_t7" | "nurture_t48h";

export function getEmailTypeForDelta(deltaDays: number): EmailType | null {
  if (deltaDays >= 12.5 && deltaDays <= 15.5) return "nurture_t14";
  if (deltaDays >= 5.5 && deltaDays <= 8.5) return "nurture_t7";
  if (deltaDays >= 1.0 && deltaDays <= 3.0) return "nurture_t48h";
  return null;
}
