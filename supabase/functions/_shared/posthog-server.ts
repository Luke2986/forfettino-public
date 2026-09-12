/**
 * posthog-server.ts — PostHog server-side capture (Story 84-6).
 *
 * Cattura HTTP verso l'endpoint pubblico di ingestione PostHog `POST {host}/capture/`
 * dalla Edge Function `send-deadline-reminder-email` (evento `deadline_email_sent`).
 *
 * VINCOLI cross-runtime (come deadline-email-logic.ts 84-3):
 *  - TS puro, dependency-free. NO `import ... from "https://esm.sh/..."`. NO import da `src/`.
 *  - NO `Deno.*` qui dentro: host/key arrivano come ARGOMENTI (la EF li legge dall'env).
 *  - I builder di payload/props sono PURI e testabili da Node; il solo `fetch` di
 *    `capturePostHog` non è coperto da test (pattern 84-3/84-5: pura testata, orchestrazione no).
 *
 * Privacy: il `distinct_id = user.id` (PII) → l'evento va emesso SOLO per utenti con
 * `analytics_consent = true` (gating nella EF, §Consenso AC#4). Nessuna altra PII nel payload.
 *
 * Fail-silent ovunque: una capture fallita NON deve MAI bloccare/ritentare l'invio email.
 */

/** Forma del body atteso da `POST {host}/capture/` (key nel body, no auth header). */
export interface CapturePayload {
  api_key: string;
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export interface BuildCapturePayloadArgs {
  apiKey: string;
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  timestamp: string; // ISO 8601 con offset (es. new Date().toISOString())
}

/**
 * Costruisce il payload `/capture/`. Difensivo: stringhe coerced, properties default `{}`.
 * Mai throw — un input sporco produce comunque un oggetto ben formato (il capture è best-effort).
 */
export function buildCapturePayload(args: BuildCapturePayloadArgs): CapturePayload {
  return {
    api_key: String(args.apiKey ?? ""),
    event: String(args.event ?? ""),
    distinct_id: String(args.distinctId ?? ""),
    properties: args.properties ?? {},
    timestamp: String(args.timestamp ?? ""),
  };
}

export interface DeadlineEmailSentPropsArgs {
  campaign: string;
  bucket: string;
  threshold: number;
  daysUntil: number;
  batchId: string;
}

/**
 * Property dell'evento `deadline_email_sent` (84-6, AC#2).
 * `threshold`/`days_until` numerici; `batch_id` per correlare l'invio al batch EF.
 * NESSUNA PII (no email, no nome) — solo metadati di campagna.
 *
 * NB (M2 review 84-6): `days_until` è SEMPRE uguale a `threshold` per costruzione — l'invio
 * avviene esattamente quando `daysUntil ∈ soglie` (`selectSchedulesInThreshold`), quindi il
 * valore è il bucket DISCRETO della soglia (`0|3|7`, `30` con 84-8), NON un continuo. Tenuto
 * per coerenza con l'AC#2 e con un eventuale futuro disaccoppiamento. Annotato nel tracking
 * plan §1: NON usare `days_until` come se fosse "giorni reali residui" (≡ `threshold`).
 */
export function buildDeadlineEmailSentProps(
  args: DeadlineEmailSentPropsArgs,
): Record<string, unknown> {
  return {
    campaign: String(args.campaign ?? ""),
    bucket: String(args.bucket ?? ""),
    threshold: Number(args.threshold),
    days_until: Number(args.daysUntil),
    batch_id: String(args.batchId ?? ""),
  };
}

/** Host di default coerente col client (`VITE_POSTHOG_HOST`). */
export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

/**
 * Thin sender fire-and-forget verso `/capture/`. NON testato (è il solo pezzo I/O).
 *
 * Total `try/catch`: un 5xx/timeout/abort PostHog viene ingoiato. La funzione non rigetta
 * MAI → il chiamante può fare `await capturePostHog(...)` senza rischiare di rompere l'invio.
 * `fetch` è globale sia in Deno che in Node 18+ (nessun import runtime-specifico).
 */
export async function capturePostHog(
  payload: CapturePayload,
  host: string = DEFAULT_POSTHOG_HOST,
): Promise<void> {
  try {
    const base = (host || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
    const res = await fetch(`${base}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // Osservabilità (M1 review 84-6): fire-and-forget ≠ cieco. Un 4xx/5xx (es.
    // POSTHOG_PROJECT_KEY errata → 401, payload rifiutato → 400) va LOGGATO: Task 6 si
    // fonda sulla verifica Network/log post-deploy, e una key sbagliata altrimenti darebbe
    // "zero eventi" silenziosi. MAI throw: l'invio email resta intoccato.
    if (!res.ok) {
      console.warn(
        `[posthog] capture non-ok ${res.status} ${res.statusText} (event=${payload.event})`,
      );
    }
  } catch (err) {
    // fail-silent sull'errore di rete (timeout/abort/DNS): l'analytics non deve mai propagare
    // un errore all'invio email. Logghiamo per renderlo osservabile senza compromettere il batch.
    console.warn(
      `[posthog] capture fetch failed (event=${payload.event}):`,
      err instanceof Error ? err.message : err,
    );
  }
}
