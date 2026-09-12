import { supabase } from "@/integrations/supabase/client";
import { posthog, isPosthogReady } from "@/lib/posthog";

// --- Consent gating for PostHog (Story 35-4, updated 2026-08-31) ---
// Anonymous pageviews and custom events are captured by default. This flag
// controls only whether PII (email, person properties) is attached.
let _analyticsConsent = false;

// Un opt-out esplicito deve valere PRIMA che il profilo sia caricato: useAuth
// identifica al SIGNED_IN, cioe' molto prima che useProfile risolva, e senza
// questo flag re-identificherebbe ad ogni accesso chi ha disattivato l'analytics.
const OPT_OUT_KEY = "ph_analytics_opt_out";

/** True quando l'utente ha disattivato esplicitamente l'analytics. */
export function hasExplicitAnalyticsOptOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function setOptOutFlag(optedOut: boolean): void {
  try {
    if (optedOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // fail-silent (Safari private mode, storage pieno)
  }
}

/**
 * Set analytics consent state.
 *
 * On public pages Cookiebot is the network-level consent gate
 * (data-blockingmode="auto" in index.html): nothing reaches PostHog at all
 * until the "statistics" category is granted. This function handles the
 * *in-app* preference, which gates PII only — three states:
 *
 *   - consent granted           → identify(user.id, { email }) + person props
 *   - no preference expressed   → identify(user.id) pseudonymous, no PII
 *   - consent explicitly revoked → reset(), events go back to anonymous
 *
 * The middle state is the fix for the identity split found on 2026-08-31:
 * events replayed server-side by the `backfill-posthog` edge function use
 * distinct_id = user_id, while client events stayed anonymous whenever the
 * user never ticked the wizard opt-in. The same person landed on two
 * different PostHog records, making the signup → first income funnel
 * uncomputable. Identifying with the pseudonymous Supabase id (no PII)
 * unifies both paths and lets PostHog merge the prior anonymous events.
 *
 * `explicit` distinguishes "never chose" from "chose no": pass false when
 * replaying a stored preference that the user never actually set
 * (profiles.analytics_consent_at IS NULL).
 *
 * We never call opt_out_capturing(): that would kill anonymous pageviews
 * too. Supabase event_logs are unaffected (legittimo interesse).
 */
export async function setAnalyticsConsent(
  consent: boolean,
  options?: { explicit?: boolean }
): Promise<void> {
  _analyticsConsent = consent;
  if (!isPosthogReady) return;

  const explicit = options?.explicit ?? true;

  try {
    if (!consent && explicit) {
      setOptOutFlag(true);
      posthog.reset();
      return;
    }
    setOptOutFlag(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (consent) {
      posthog.identify(user.id, { email: user.email });
    } else {
      posthog.identify(user.id);
    }
  } catch {
    // fail-silent
  }
}

// --- PostHog User Properties sync ---

/**
 * Sync user profile + fiscal data as PostHog person properties.
 * Call once per session after profile is loaded and consent is granted.
 * Fail-silent, never blocks UI.
 */
export async function syncPosthogUserProperties(profile: {
  onboarding_completed: boolean;
  created_at: string;
  admin_override_tier: string | null;
  is_internal?: boolean;
}): Promise<void> {
  if (!isPosthogReady || !_analyticsConsent) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentYear = new Date().getFullYear();
    const { data: settings } = await supabase
      .from("fiscal_year_settings")
      .select("anno_apertura_piva, inps_management, ateco_code, profit_coefficient")
      .eq("user_id", user.id)
      .eq("fiscal_year", currentYear)
      .maybeSingle();

    const { count: incomeCount } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    posthog.setPersonProperties({
      email: user.email,
      created_at: profile.created_at,
      onboarding_completed: profile.onboarding_completed,
      plan: profile.admin_override_tier ?? "free",
      // Tag staff/test users so the PostHog test-account filter can exclude them
      // (filter: person.is_internal = true). Audit 2026-06-21.
      is_internal: profile.is_internal ?? false,
      anno_apertura_piva: settings?.anno_apertura_piva ?? null,
      gestione_inps: settings?.inps_management ?? null,
      codice_ateco: settings?.ateco_code ?? null,
      profit_coefficient: settings?.profit_coefficient ?? null,
      income_count: incomeCount ?? 0,
    });

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[analytics] PostHog user properties synced");
    }
  } catch {
    // fail-silent
  }
}

// --- Anonymous aggregate analytics (analytics_events table, ZERO user_id) ---

export const ANALYTICS_EVENTS = {
  PAGE_VIEW_DASHBOARD: "page_view_dashboard",
  PAGE_VIEW_SCADENZIARIO: "page_view_scadenziario",
  INCASSO_CREATO: "incasso_creato",
  SCADENZA_PAGATA: "scadenza_pagata",
  ONBOARDING_COMPLETATO: "onboarding_completato",
  CHECKLIST_DISMISSED: "checklist_dismissed",
  NOTIFICA_LETTA: "notifica_letta",
  GUIDE_PDF_PREVIEW_VIEWED: "guide_pdf_preview_viewed",
  GUIDE_PDF_DOWNLOADED: "guide_pdf_downloaded",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

const VALID_EVENTS = new Set<string>(Object.values(ANALYTICS_EVENTS));

/**
 * Fire-and-forget anonymous counter increment.
 * Uses RPC `increment_analytics_event` for atomic UPSERT.
 * Never blocks UI, never throws, works without auth check.
 *
 * Also captures the same event name on PostHog (anonymous until identify()
 * via setAnalyticsConsent(true)). Pass `{ skipPosthog: true }` when the
 * caller has ALREADY sent a richer `track()` PostHog event for the same
 * user action — avoids duplicate PostHog events with the same name.
 */
export function trackAnonymous(
  eventName: AnalyticsEvent,
  options?: { skipPosthog?: boolean }
): void {
  if (!VALID_EVENTS.has(eventName)) return;

  if (isPosthogReady && !options?.skipPosthog) {
    try { posthog.capture(eventName); } catch { /* fail-silent */ }
  }

  supabase
    .rpc("increment_analytics_event", { p_event_name: eventName })
    .then(
      () => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[analytics:anon]", eventName);
        }
      },
      () => {
        // fail-silent: analytics should never break the app
      }
    );
}

// --- Per-user event tracking (event_logs table, WITH user_id) ---

/**
 * Lightweight per-user analytics wrapper.
 * Inserts events into the `event_logs` Supabase table.
 * Fail-silent: never blocks UI or throws.
 *
 * NOTE: eventName accepts any string (not restricted to ANALYTICS_EVENTS)
 * because per-user events are ad-hoc across many pages. For new events,
 * prefer using ANALYTICS_EVENTS constants at the call site for consistency.
 *
 * Usage:
 *   track(ANALYTICS_EVENTS.GUIDE_PDF_DOWNLOADED, { source: "dashboard" });
 *   track("add_income_click", { source: "dashboard" });
 */
export async function track(
  eventName: string,
  props?: Record<string, unknown>
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return; // anonymous → skip

    const row = {
      user_id: user.id,
      event_name: eventName,
      props: props ?? null,
    };

    // PostHog captures always; identify() only attaches PII when
    // analytics_consent=true (handled by setAnalyticsConsent). Without
    // consent, events are tied to an anonymous distinct_id.
    if (isPosthogReady) {
      try { posthog.capture(eventName, props ?? undefined); } catch { /* fail-silent */ }
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[analytics]", eventName, props ?? "");
    }

    const { error } = await (supabase as any).from("event_logs").insert(row);
    if (error && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] insert failed:", eventName, error.message);
    }
  } catch {
    // fail-silent: analytics should never break the app
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] failed to track", eventName);
    }
  }
}
