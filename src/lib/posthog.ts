import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

/** True when PostHog was initialised (non-localhost). */
export let isPosthogReady = false;

if (typeof window !== "undefined" && window.location.hostname !== "localhost" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // No Person profile is created for anonymous visitors → no PII build-up.
    // identify() runs for authenticated users via setAnalyticsConsent in
    // AppLayout; email and person properties stay behind explicit consent.
    person_profiles: "identified_only",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    disable_session_recording: true,
    // Auto-capture uncaught errors / unhandled promise rejections as
    // $exception events (complements Sentry in main.tsx — PostHog links
    // exceptions to user context + session replay when enabled).
    capture_exceptions: true,
  });
  isPosthogReady = true;

  // ── Cookiebot consent integration ───────────────────────────────
  // Cookiebot in index.html uses data-blockingmode="auto" which blocks
  // the network requests to tracking endpoints until the user grants
  // consent, so GDPR compliance is handled at the network layer.
  // Client-side we still honour an explicit rejection of the "statistics"
  // category by calling opt_out_capturing() to stop PostHog emission.
  // Anonymous pageviews + custom events are captured by default: for logged
  // out visitors person_profiles: "identified_only" prevents profile creation
  // entirely, and for logged in users identify() attaches only the
  // pseudonymous Supabase id until consent adds the email.
  const applyCookiebotConsent = () => {
    const cb = (window as unknown as { Cookiebot?: { consent?: { statistics?: boolean } } }).Cookiebot;
    if (!cb?.consent) return;
    try {
      if (cb.consent.statistics === false) {
        posthog.opt_out_capturing();
      }
    } catch {
      // fail-silent
    }
  };

  // Fires on every page load once Cookiebot resolves the stored consent.
  window.addEventListener("CookiebotOnConsentReady", applyCookiebotConsent);
  // Handle the race where Cookiebot already resolved before listener attached.
  if ((window as unknown as { Cookiebot?: { consent?: unknown } }).Cookiebot?.consent) {
    applyCookiebotConsent();
  }
}

export { posthog };
