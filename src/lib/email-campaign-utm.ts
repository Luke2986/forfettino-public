/**
 * email-campaign-utm.ts — Parser client di `utm_campaign` (Story 84-6).
 *
 * Twin client-side di `parseEmailCampaign` in
 * `supabase/functions/_shared/deadline-email-logic.ts`. Duplicato VOLUTO: il file `_shared`
 * vive nel mondo Deno/Edge Function (tsconfig separato, import `.ts` espliciti) e NON è
 * importabile dal bundle Vite senza trascinare il modulo EF intero. Stesso algoritmo,
 * stessa semantica: tenere allineati i due se la convenzione cambia.
 *
 * Da `scadenza_<bucket>_<threshold>` → `{ bucket, threshold }`. Il bucket canonico può
 * contenere underscore (`saldo_tax`, `inps_q3`, `acconto_inps_1`): lo `<threshold>` è
 * SEMPRE l'ultimo segmento numerico → split sull'ULTIMO `_`. Difensivo: campaign malformato
 * → `null` (il caller cattura comunque l'evento col solo `campaign`).
 */
export function parseEmailCampaign(
  campaign: string,
): { bucket: string; threshold: number } | null {
  if (typeof campaign !== "string") return null;
  const PREFIX = "scadenza_";
  if (!campaign.startsWith(PREFIX)) return null;
  const rest = campaign.slice(PREFIX.length);
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore <= 0) return null;
  const bucket = rest.slice(0, lastUnderscore);
  const thresholdStr = rest.slice(lastUnderscore + 1);
  if (bucket.length === 0 || thresholdStr.length === 0) return null;
  if (!/^\d+$/.test(thresholdStr)) return null;
  return { bucket, threshold: Number(thresholdStr) };
}
