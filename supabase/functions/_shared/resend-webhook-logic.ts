/**
 * resend-webhook-logic.ts — Logica pura, cross-runtime, del receiver webhook Resend (Story 84-5).
 *
 * Estratta dall'Edge Function `resend-webhook` per essere testabile con Vitest (l'EF Deno NON è
 * eseguibile in Node). Stessi VINCOLI cross-runtime di `deadline-email-logic.ts` (84-3):
 *  - TS puro, dependency-free. SOLO string/array building.
 *  - NO `import ... from "https://esm.sh/..."`. NO `Deno.*`. NO import da `src/`.
 *
 * Consumatori:
 *  - EF Deno 84-5: `import { ... } from "../_shared/resend-webhook-logic.ts"`
 *  - Test Vitest: `src/lib/email/__tests__/resend-webhook-logic.test.ts` (path relativo)
 *
 * L'`index.ts` Deno orchestra (verifica firma Svix, insert DB, risposta/retry); QUI vive solo
 * il parsing/normalizzazione del payload e il mapping event_type → eventuale email_log.status.
 */

// ── Event types Resend (firmati Svix) ───────────────────────────────────────────
// I primi sei sono segnali SMTP che arrivano SUBITO (indipendenti dal toggle dominio).
// opened/clicked sono gestiti difensivamente ma NON attesi al lancio (toggle OFF, decisione 84-1).
export const RESEND_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.opened",
  "email.clicked",
] as const;

export type ResendEventType = (typeof RESEND_EVENT_TYPES)[number];

// ── Shape UUID (anti retry-storm: mai passare una stringa arbitraria a una colonna uuid) ──
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

// ── Normalizzazione tags (fatto #3: nel webhook arrivano come OGGETTO-mappa, NON array) ──
/**
 * Resend ACCETTA i tags come array `[{name,value}]` (è così che 84-3 li invia), ma li
 * RESTITUISCE nel payload webhook come oggetto-mappa `{category:"...", user_id:"..."}`.
 * Questa funzione gestisce ENTRAMBE le forme in modo difensivo + ogni altro shape → `{}`.
 * I valori sono coerciti a stringa (i tag Resend sono ASCII string).
 */
export function normalizeTags(tags: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!tags) return out;

  // Forma array: [{ name, value }, ...]
  if (Array.isArray(tags)) {
    for (const item of tags) {
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        const value = (item as { value?: unknown }).value;
        if (typeof name === "string" && name.length > 0) {
          out[name] = value == null ? "" : String(value);
        }
      }
    }
    return out;
  }

  // Forma oggetto-mappa: { key: value, ... }
  if (typeof tags === "object") {
    for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
      if (typeof key === "string" && key.length > 0) {
        out[key] = value == null ? "" : String(value);
      }
    }
  }

  return out;
}

// ── Mapping event_type → eventuale email_log.status ─────────────────────────────
/**
 * Solo `delivered`/`bounced`/`failed` toccano `email_log.status` (tutti e tre già ammessi dal CHECK
 * esistente `('sent','delivered','bounced','failed')` → nessuna estensione, AC#4). `email.failed`
 * (fallimento Resend post-`sent`) porta la riga a `failed`; il caller applica no-downgrade
 * (`failed` solo da `sent`, non sovrascrive `delivered`/`bounced`). Tutto il resto
 * (`sent`/`complained`/`delivery_delayed`/`opened`/`clicked`) → `null` = NON toccare email_log
 * (granularità solo in email_events; `complained`/`delivery_delayed` NON sono nel CHECK).
 * Vedi anti-pattern #3/#4.
 */
export function emailLogStatusForEvent(
  eventType: string,
): "delivered" | "bounced" | "failed" | null {
  switch (eventType) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

// ── Parsing evento → record pronto per l'insert in email_events ──────────────────
export interface ParsedResendEvent {
  /** event_type completo, es. "email.delivered" (salvato as-is in email_events). */
  eventType: string;
  /** data.email_id = email_log.resend_message_id (84-3 salva resendData.id). null se assente. */
  emailId: string | null;
  /** primo destinatario (data.to può essere array o stringa). null se assente. */
  recipient: string | null;
  /** tag user_id SOLO se UUID valido, altrimenti null (§user_id: niente insert su colonna uuid). */
  userId: string | null;
  /** tag threshold come intero, altrimenti null. */
  threshold: number | null;
  /** tag category, altrimenti null. */
  category: string | null;
  /** URL cliccato (solo email.clicked, campo difensivo). null altrimenti. */
  clickedUrl: string | null;
  /** tipo di bounce (solo email.bounced, campo difensivo). null altrimenti. */
  bounceType: string | null;
  /** timestamp dell'EVENTO = top-level created_at del payload (NON data.created_at). null → caller usa now(). */
  occurredAt: string | null;
}

/** Ritorna la stringa solo se è un timestamp parsabile (ISO 8601), altrimenti null. */
function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.length > 0);
    return typeof first === "string" ? first : null;
  }
  return null;
}

/**
 * Estrae i campi noti dal payload webhook Resend in modo difensivo: ogni campo mancante o
 * di shape inatteso → `null` (mai un throw, mai un valore che farebbe fallire l'insert).
 * Il payload integrale va salvato comunque in `raw_payload` (l'index.ts) per audit/debug.
 */
export function parseResendEvent(payload: unknown): ParsedResendEvent {
  const p = (payload ?? {}) as Record<string, unknown>;
  const data = (p.data ?? {}) as Record<string, unknown>;

  const eventType = typeof p.type === "string" ? p.type : "";
  // §user_id-style difesa anche sul timestamp: un created_at NON-parsabile farebbe fallire l'insert
  // su colonna timestamptz → 500 → retry-storm. Validare → else null (caller usa now()).
  const occurredAt = isoOrNull(p.created_at);
  const emailId = typeof data.email_id === "string" ? data.email_id : null;
  const recipient = firstString(data.to);

  const tags = normalizeTags(data.tags);
  const userId = isUuid(tags.user_id) ? tags.user_id : null;
  const threshold = parseThreshold(tags.threshold);
  const category =
    typeof tags.category === "string" && tags.category.length > 0
      ? tags.category
      : null;

  // §6: NON assumere i nomi esatti dei sotto-campi data.* (bounce/click). Lettura difensiva
  // con fallback multipli; mancante → null. Il raw_payload conserva tutto per riconciliazione.
  const clickedUrl =
    eventType === "email.clicked" ? extractClickedUrl(data) : null;
  const bounceType =
    eventType === "email.bounced" ? extractBounceType(data) : null;

  return {
    eventType,
    emailId,
    recipient,
    userId,
    threshold,
    category,
    clickedUrl,
    bounceType,
    occurredAt,
  };
}

function parseThreshold(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  return Number.isInteger(n) ? n : null;
}

function extractClickedUrl(data: Record<string, unknown>): string | null {
  const click = data.click as Record<string, unknown> | undefined;
  if (click && typeof click === "object") {
    const link = firstString(click.link) ?? firstString(click.url);
    if (link) return link;
  }
  // Fallback su forme alternative osservate in alcuni payload.
  return firstString(data.link) ?? firstString(data.url);
}

function extractBounceType(data: Record<string, unknown>): string | null {
  const bounce = data.bounce as Record<string, unknown> | undefined;
  if (bounce && typeof bounce === "object") {
    const t = firstString(bounce.type) ?? firstString(bounce.subType);
    if (t) return t;
  }
  return firstString(data.bounce_type) ?? firstString(data.type_bounce);
}

// ── Aggregazione pura (AC#7: conteggi base; la dashboard ricca è 84-9) ───────────
export interface EmailEventLike {
  event_type: string;
  category?: string | null;
  threshold?: number | null;
}

export interface EmailEventStats {
  total: number;
  byEventType: Record<string, number>;
  /** Scorciatoie di recapito (i numeri che contano per igiene lista/reputazione). */
  delivered: number;
  bounced: number;
  complained: number;
  /** Predisposti ma OFF al lancio (vedi disclaimer MPP: opened NON è verità). */
  opened: number;
  clicked: number;
  /** Breakdown per "category:threshold" (chiave composita), conteggio per event_type. */
  byCampaign: Record<string, Record<string, number>>;
}

/**
 * Aggregazione in-memory in stile `get_email_event_stats` (RPC SQL), con in più il breakdown
 * `byCampaign` (category:threshold). Usata oggi solo dai test puri; resta a disposizione di un
 * consumer Node/Deno futuro (es. job 84-9) — NON è importata dall'EF, che delega alla RPC.
 * NB: la RPC è la fonte di verità in produzione (filtra/aggrega lato DB); questa funzione la
 * affianca per i conteggi in-memory, non la sostituisce.
 * Disclaimer MPP: i conteggi `opened`, quando esisteranno, sono gonfiati da Apple Mail Privacy
 * Protection (+15-40%) → il **click** è la metrica primaria.
 */
export function aggregateEvents(rows: EmailEventLike[]): EmailEventStats {
  const byEventType: Record<string, number> = {};
  const byCampaign: Record<string, Record<string, number>> = {};

  const countFor = (type: string): number => byEventType[type] ?? 0;

  for (const row of rows) {
    const type = row.event_type;
    byEventType[type] = countFor(type) + 1;

    const cat = row.category ?? "unknown";
    const thr = row.threshold == null ? "na" : String(row.threshold);
    const key = `${cat}:${thr}`;
    const bucket = (byCampaign[key] ??= {});
    bucket[type] = (bucket[type] ?? 0) + 1;
  }

  return {
    total: rows.length,
    byEventType,
    delivered: countFor("email.delivered"),
    bounced: countFor("email.bounced"),
    complained: countFor("email.complained"),
    opened: countFor("email.opened"),
    clicked: countFor("email.clicked"),
    byCampaign,
  };
}
