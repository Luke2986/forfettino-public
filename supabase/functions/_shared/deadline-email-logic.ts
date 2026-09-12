/**
 * deadline-email-logic.ts — Logica pura, cross-runtime, dell'invio email scadenza (Story 84-3).
 *
 * Estratta dall'Edge Function `send-deadline-reminder-email` per essere testabile con Vitest
 * (l'EF Deno NON è eseguibile in Node). Stessi VINCOLI cross-runtime del renderer 84-2:
 *  - TS puro, dependency-free. SOLO `Intl` + string building.
 *  - NO `import ... from "https://esm.sh/..."`. NO `Deno.*`. NO import da `src/`.
 *
 * Consumatori:
 *  - EF Deno 84-3: `import { ... } from "../_shared/deadline-email-logic.ts"`
 *  - Test Vitest: `src/lib/email/__tests__/deadline-email-logic.test.ts` (path relativo)
 */

import type { DeadlineEmailInput } from "./email-templates/deadline-reminder.ts";

// ── Soglie ────────────────────────────────────────────────────────────────────
// Soglie email = [30, 7, 3, 0] (84-8 ha attivato il 30). threshold == daysUntil della soglia.
// Questa costante è il SUPERSET usato come default dalla EF di invio (index.ts:228-232) e dal cron
// giornaliero (body '{}' → eredita il default). 84-10 (soglie per-utente) la restringe per-utente
// via filterByPrefs (fetch col superset, scarta le soglie ∉ reminder_thresholds dell'utente).
// NOTA: distinta dalla costante in-app src/lib/deadline-notifications.ts ([7,3,0], Epic 25 legacy).
export const REMINDER_THRESHOLDS = [30, 7, 3, 0] as const;

// ── Bucket → Label (replica della mappa, NON import da src/ — cross-runtime) ──
const BUCKET_LABELS: Record<string, string> = {
  june: "Rata Giugno",
  november: "Rata Novembre",
  inps_q1: "Rata INPS Q1 (Feb)",
  inps_q2: "Rata INPS Q2 (Mag)",
  inps_q3: "Rata INPS Q3 (Ago)",
  inps_q4: "Rata INPS Q4 (Nov)",
  saldo_tax: "Saldo Imposta",
  saldo_inps: "Saldo INPS",
  acconto_tax_1: "I° Acconto Imposta",
  acconto_tax_2: "II° Acconto Imposta",
  acconto_inps_1: "I° Acconto INPS",
  acconto_inps_2: "II° Acconto INPS",
};

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// june/november seguono il MESE della scadenza reale: le proroghe per-anno
// spostano la data (es. 2026: "june" prorogata al 20/07 → "Rata Luglio").
const MONTH_DERIVED_BUCKETS = new Set(["june", "november"]);

export function bucketToLabel(bucket: string, dueDate?: string | null): string {
  if (dueDate && MONTH_DERIVED_BUCKETS.has(bucket)) {
    const safe = dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`;
    const month = MONTHS_IT[new Date(safe).getMonth()];
    if (month) return `Rata ${month}`;
  }
  return BUCKET_LABELS[bucket] ?? "Scadenza Fiscale";
}

// ── Giorni mancanti timezone-safe (parse local-time, no UTC midnight off-by-one) ──
export function daysUntilFromDate(dueDateISO: string, todayISO: string): number {
  const due = new Date(`${dueDateISO}T00:00:00`);
  const now = new Date(`${todayISO}T00:00:00`);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Selezione rate in soglia ──────────────────────────────────────────────────

/** Sottoinsieme delle colonne `tax_schedule` necessarie all'invio. */
export interface TaxScheduleLike {
  id: string;
  user_id: string;
  bucket: string;
  due_date: string; // "YYYY-MM-DD"
  status: string; // "open" | "partial" | "paid"
  total_expected: number; // euro
  total_paid?: number; // euro
}

export interface ScheduleInThreshold {
  schedule: TaxScheduleLike;
  threshold: number; // = daysUntil della soglia matchata
}

/**
 * Filtra le rate NON pagate la cui scadenza cade esattamente su una delle soglie.
 * - `status === "paid"` → scartata (coerente con deadline-notifications.ts:166-167).
 * - `'partial'` è incluso (non ancora pagata del tutto).
 * - Solo daysUntil ∈ thresholds.
 */
export function selectSchedulesInThreshold(
  schedules: TaxScheduleLike[],
  todayISO: string,
  thresholds: readonly number[] = REMINDER_THRESHOLDS,
): ScheduleInThreshold[] {
  const out: ScheduleInThreshold[] = [];
  for (const schedule of schedules) {
    if (schedule.status === "paid") continue;
    const days = daysUntilFromDate(schedule.due_date, todayISO);
    if (thresholds.includes(days)) {
      out.push({ schedule, threshold: days });
    }
  }
  return out;
}

// ── Filtro preferenze (honor master/scadenze/scadenze_email) ──────────────────

export interface NotificationPrefs {
  master_enabled: boolean;
  scadenze_enabled: boolean;
  scadenze_email_enabled: boolean;
  /**
   * Story 84-10: soglie (giorni-prima) scelte dall'utente per il canale email scadenze.
   * Sottoinsieme NON vuoto del superset cron `[30,7,3,0]` (CHECK DB, Decisione B).
   * Filtro ADDITIVO in `filterByPrefs` (oltre alla guard booleana): scarta i candidati
   * la cui `threshold` non è in questo array. Assenza riga → DEFAULT (`[30,7,3,0]`).
   */
  reminder_thresholds: number[];
}

/**
 * Default quando l'utente non ha una riga `user_notification_settings`: tutto ON
 * (coerente con i DEFAULT true della tabella → assenza di riga = notifiche attive).
 * `reminder_thresholds` = superset cron `[30,7,3,0]` → comportamento identico a oggi.
 */
export const DEFAULT_PREFS: NotificationPrefs = {
  master_enabled: true,
  scadenze_enabled: true,
  scadenze_email_enabled: true,
  reminder_thresholds: [30, 7, 3, 0],
};

/**
 * Canale email scadenze consentito SOLO se tutti e tre i flag sono true.
 * MAI consultare marketing_email_consent (è un'email di servizio, GDPR 6.1.b).
 */
export function isDeadlineEmailAllowed(prefs: NotificationPrefs): boolean {
  return (
    prefs.master_enabled === true &&
    prefs.scadenze_enabled === true &&
    prefs.scadenze_email_enabled === true
  );
}

// ── Pipeline destinatari (logica pura testabile — H1/M1 review 84-3) ───────────

/** Chiave di dedup idempotenza: una sola email per (utente, rata, soglia). */
export function dedupKeyOf(userId: string, scheduleId: string, threshold: number): string {
  return `${userId}:${scheduleId}:${threshold}`;
}

export interface FilterByPrefsResult {
  eligible: ScheduleInThreshold[];
  skippedPrefs: number;
}

/**
 * Filtra i candidati per preferenze (master/scadenze/scadenze_email + soglie 84-10).
 *
 * **M1 fail-CLOSED**: se la lettura di `user_notification_settings` è FALLITA
 * (`prefsLoadOk === false`), il consenso è ignoto → NON si invia a nessuno (skip
 * totale). Mai fail-open su un'email di servizio con opt-out di canale (GDPR).
 * Quando la query riesce ma l'utente non ha riga, si usa `DEFAULT_PREFS` (tutto ON):
 * assenza di riga = default attivo, che è semanticamente diverso da "query fallita".
 *
 * **84-10 filtro soglie**: oltre alla guard booleana, il candidato sopravvive solo se
 * la sua `threshold` è tra le `reminder_thresholds` dell'utente. Filtro ADDITIVO: può
 * solo togliere candidati, mai aggiungerne (i candidati arrivano già dal superset cron).
 * Utente di default → `[30,7,3,0]` → identico a oggi.
 *
 * **`ignoreThresholds`** (84-10 fix): il filtro per-utente delle soglie governa SOLO lo
 * sweep automatico del cron (84-8). Gli invii admin ESPLICITI — one-shot 84-4 e self-test
 * 84-11, che passano soglie arbitrarie per coprire/diagnosticare una rata specifica — lo
 * bypassano (`ignoreThresholds=true`): senza questo, il filtro soglie scarterebbe la rata
 * scelta (es. una scadenza a 45gg ∉ [30,7,3,0]) annullando lo scopo dello strumento.
 * La guard di canale (`isDeadlineEmailAllowed`) resta SEMPRE applicata (mai fail-open su
 * opt-out di un'email di servizio, GDPR), anche con `ignoreThresholds=true`.
 */
export function filterByPrefs(
  candidates: ScheduleInThreshold[],
  prefsByUser: Map<string, NotificationPrefs>,
  prefsLoadOk: boolean,
  ignoreThresholds = false,
): FilterByPrefsResult {
  if (!prefsLoadOk) {
    return { eligible: [], skippedPrefs: candidates.length };
  }
  const eligible = candidates.filter((c) => {
    const prefs = prefsByUser.get(c.schedule.user_id) ?? DEFAULT_PREFS;
    const channelOk = isDeadlineEmailAllowed(prefs);
    const thresholdOk = ignoreThresholds || prefs.reminder_thresholds.includes(c.threshold);
    return channelOk && thresholdOk;
  });
  return { eligible, skippedPrefs: candidates.length - eligible.length };
}

/**
 * Dai candidati già filtrati per preferenze, tiene solo quelli realmente inviabili:
 * utente con email risolta E non già inviato per quella `(user, schedule, threshold)`.
 */
export function filterSendable(
  eligible: ScheduleInThreshold[],
  usersWithEmail: Set<string>,
  alreadySent: Set<string>,
): ScheduleInThreshold[] {
  return eligible.filter((c) => {
    const uid = c.schedule.user_id;
    if (!usersWithEmail.has(uid)) return false;
    return !alreadySent.has(dedupKeyOf(uid, c.schedule.id, c.threshold));
  });
}

// ── UTM (84-3) — link scadenziario con utm_campaign = scadenza_<bucket>_<threshold> ──
export function buildScadenziarioUrl(
  appUrl: string,
  bucket: string,
  threshold: number,
): string {
  const params = new URLSearchParams({
    utm_source: "email",
    utm_medium: "transactional",
    utm_campaign: `scadenza_${bucket}_${threshold}`,
  });
  return `${appUrl}/scadenziario?${params.toString()}`;
}

/**
 * Parser INVERSO puro di `utm_campaign` (84-6, AC#1/AC#2).
 *
 * Da `scadenza_<bucket>_<threshold>` → `{ bucket, threshold }`. Riusato dal payload
 * server (`deadline_email_sent`) e dall'hook client (`deadline_email_clicked`, twin in
 * `src/lib/email-campaign-utm.ts`) per derivare le property del funnel.
 *
 * Il bucket canonico può contenere underscore (`saldo_tax`, `inps_q3`, `acconto_inps_1`):
 * lo `<threshold>` è SEMPRE l'ultimo segmento numerico → si fa lo split sull'ULTIMO `_`.
 *
 * Difensivo (mai throw): campaign che non inizia per `scadenza_`, senza threshold
 * numerico, o con bucket vuoto → `null`. Il consumer cattura comunque l'evento col solo
 * `campaign` quando il parse fallisce (no crash).
 */
export function parseEmailCampaign(
  campaign: string,
): { bucket: string; threshold: number } | null {
  if (typeof campaign !== "string") return null;
  const PREFIX = "scadenza_";
  if (!campaign.startsWith(PREFIX)) return null;
  const rest = campaign.slice(PREFIX.length); // es. "saldo_tax_7"
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore <= 0) return null; // serve almeno "<bucket>_<threshold>"
  const bucket = rest.slice(0, lastUnderscore);
  const thresholdStr = rest.slice(lastUnderscore + 1);
  if (bucket.length === 0 || thresholdStr.length === 0) return null;
  if (!/^\d+$/.test(thresholdStr)) return null; // threshold non-numerico → null
  return { bucket, threshold: Number(thresholdStr) };
}

// ── Mapping tax_schedule → DeadlineEmailInput (contratto renderer 84-2) ────────

export interface MapToEmailInputArgs {
  schedule: TaxScheduleLike;
  threshold: number;
  todayISO: string;
  recipientName?: string;
  appUrl: string;
  unsubscribeUrl: string;
}

/**
 * Costruisce l'input del renderer 84-2 da una rata.
 * §importo: usa `total_expected` (importo pieno rata) per coerenza con la notifica in-app
 * (buildNotificationPayload usa total_expected). Le rate parziali mostrano comunque il
 * dovuto pieno: scelta semplice e coerente con l'app; il residuo reale è total_expected
 * - total_paid (non usato qui di proposito).
 */
export function mapToDeadlineEmailInput(args: MapToEmailInputArgs): DeadlineEmailInput {
  const { schedule, threshold, todayISO, recipientName, appUrl, unsubscribeUrl } = args;
  const ctaUrl = buildScadenziarioUrl(appUrl, schedule.bucket, threshold);
  return {
    recipientName: recipientName?.trim() || undefined,
    bucketLabel: bucketToLabel(schedule.bucket, schedule.due_date),
    amountEuro: schedule.total_expected,
    dueDateISO: schedule.due_date,
    daysUntil: daysUntilFromDate(schedule.due_date, todayISO),
    ctaUrl,
    manageUrl: `${appUrl}/impostazioni`,
    unsubscribeUrl,
    privacyUrl: `${appUrl}/privacy-policy`,
    // AC#12: nudge "marca pagata = stop reminder" sotto la CTA (link allo scadenziario).
    paidNudge: true,
  };
}
