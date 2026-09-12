/**
 * posthog-query-logic.ts — logica pura cross-runtime per l'EF `admin-deadline-email-clicks`
 * (Story 84-9). Interroga la PostHog Query API (HogQL) per il CLICK REALE delle email scadenza:
 * `deadline_email_clicked` (84-6) + `deadline_email_sent` (denominatore del tasso click).
 *
 * VINCOLI cross-runtime (come posthog-server.ts 84-6 / deadline-email-logic.ts 84-3):
 *  - TS puro, dependency-free. NO `import ... from "https://esm.sh/..."`. NO import da `src/`.
 *  - NO `Deno.*` qui dentro: host/key/project arrivano come ARGOMENTI alla EF (letti dall'env).
 *  - Builder e parser PURI e testabili da Node; il solo `fetch` (nell'index.ts) non è testato.
 *
 * ⚠️ HOST: la Query API è sull'APP host `https://eu.posthog.com/api/projects/{id}/query/`
 * (NON l'ingestion `https://eu.i.posthog.com` usato dal capture 84-6). Auth via Personal API
 * Key read-scoped (header Bearer), NON l'ingestion key. Vedi index.ts.
 *
 * ⚠️ CONSENSO: `deadline_email_*` sono gated su `analytics_consent` (84-6) → il tasso click
 * sotto-conta gli utenti senza consenso. È comunque la miglior verità disponibile al lancio
 * (il click Resend è OFF, 84-1). Etichettare in UI "click via PostHog · utenti con consenso analytics".
 */

export const CLICK_EVENT = "deadline_email_clicked";
export const SENT_EVENT = "deadline_email_sent";

/**
 * Validazione STRICT di un timestamp ISO 8601 (data o data+ora, con eventuale offset/Z).
 * Serve a evitare injection nella stringa HogQL: solo un valore che matcha questa whitelist
 * può entrare nella query; qualsiasi altro input viene IGNORATO (nessun filtro temporale).
 */
export function isValidIso(s: unknown): s is string {
  if (typeof s !== "string") return false;
  // YYYY-MM-DD opzionale "T"/spazio HH:MM(:SS(.sss)) opzionale offset (Z o ±HH:MM)
  const re =
    /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!re.test(s)) return false;
  return !Number.isNaN(Date.parse(s));
}

/**
 * Costruisce la query HogQL: righe `(day, event, threshold, cnt)` per i due eventi click/sent,
 * raggruppate per giorno + evento + soglia. Da queste righe si derivano TUTTE le metriche
 * (totali, tasso, breakdown per soglia, serie giornaliera) lato `parseClickMetricsResponse`.
 *
 * `sinceISO` viene interpolato SOLO se valido (whitelist ISO). Input non valido → nessun filtro
 * temporale (query su tutto lo storico), MAI interpolazione grezza di input non sanitizzato.
 *
 * NB: si usa `parseDateTimeBestEffort` (non `toDateTime`): l'`since` arriva come ISO completo
 * con frazioni di secondo e suffisso `Z` (es. `2026-06-27T15:40:23.123Z`, da `Date.toISOString()`)
 * che `toDateTime(String)` di ClickHouse può rifiutare. `parseDateTimeBestEffort` normalizza
 * l'ISO-8601 (T/frazioni/offset/Z) in UTC in modo affidabile.
 */
export function buildClickMetricsHogQL(sinceISO: string | null): string {
  const sinceClause = isValidIso(sinceISO)
    ? `AND timestamp >= parseDateTimeBestEffort('${sinceISO}')`
    : "";
  return [
    "SELECT toDate(timestamp) AS day,",
    "       event AS event,",
    "       toString(properties.threshold) AS threshold,",
    "       count() AS cnt",
    "FROM events",
    `WHERE event IN ('${CLICK_EVENT}', '${SENT_EVENT}')`,
    `  ${sinceClause}`,
    "GROUP BY day, event, threshold",
    "ORDER BY day",
  ].join("\n");
}

export interface ThresholdClickMetrics {
  threshold: string;
  clicks: number;
  sends: number;
  click_rate: number | null;
}

export interface ClickTrendPoint {
  day: string;
  clicks: number;
  sends: number;
}

export interface ClickMetrics {
  clicks: number;
  sends: number;
  click_rate: number | null;
  by_threshold: ThresholdClickMetrics[];
  trend: ClickTrendPoint[];
}

function rate(clicks: number, sends: number): number | null {
  return sends > 0 ? clicks / sends : null;
}

function coerceNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coerceStr(v: unknown): string {
  if (v === null || v === undefined || v === "") return "na";
  return String(v);
}

/**
 * Parser DIFENSIVO della risposta PostHog Query API. Mai throw: input sporco/vuoto → zeri.
 *
 * Accetta sia `{ results: Row[] }` (forma Query API) sia un array di righe diretto.
 * Ogni riga è `[day, event, threshold, cnt]` (ordine colonne di buildClickMetricsHogQL).
 */
export function parseClickMetricsResponse(response: unknown): ClickMetrics {
  const empty: ClickMetrics = {
    clicks: 0,
    sends: 0,
    click_rate: null,
    by_threshold: [],
    trend: [],
  };

  const rows: unknown[] = Array.isArray(response)
    ? response
    : Array.isArray((response as { results?: unknown })?.results)
      ? ((response as { results: unknown[] }).results)
      : [];

  if (rows.length === 0) return empty;

  let clicks = 0;
  let sends = 0;
  const byThreshold = new Map<string, { clicks: number; sends: number }>();
  const byDay = new Map<string, { clicks: number; sends: number }>();

  for (const raw of rows) {
    if (!Array.isArray(raw)) continue;
    const day = coerceStr(raw[0]);
    const event = coerceStr(raw[1]);
    const threshold = coerceStr(raw[2]);
    const cnt = coerceNum(raw[3]);

    const isClick = event === CLICK_EVENT;
    const isSend = event === SENT_EVENT;
    if (!isClick && !isSend) continue;

    if (isClick) clicks += cnt;
    else sends += cnt;

    const t = byThreshold.get(threshold) ?? { clicks: 0, sends: 0 };
    if (isClick) t.clicks += cnt;
    else t.sends += cnt;
    byThreshold.set(threshold, t);

    const d = byDay.get(day) ?? { clicks: 0, sends: 0 };
    if (isClick) d.clicks += cnt;
    else d.sends += cnt;
    byDay.set(day, d);
  }

  const by_threshold: ThresholdClickMetrics[] = [...byThreshold.entries()]
    .map(([threshold, v]) => ({
      threshold,
      clicks: v.clicks,
      sends: v.sends,
      click_rate: rate(v.clicks, v.sends),
    }))
    .sort((a, b) => a.threshold.localeCompare(b.threshold));

  const trend: ClickTrendPoint[] = [...byDay.entries()]
    .map(([day, v]) => ({ day, clicks: v.clicks, sends: v.sends }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { clicks, sends, click_rate: rate(clicks, sends), by_threshold, trend };
}
