/**
 * Tests for analytics consent gating (Story 35-4, updated 2026-08-31).
 *
 * Under the current model PostHog captures anonymous events by default.
 * Consent gates PII only; the pseudonymous Supabase id is attached to every
 * authenticated session so that client events and events replayed by the
 * backfill edge function land on the same person.
 *
 * - consent true                → identify(user_id, { email })
 * - consent false, not explicit → identify(user_id), no PII
 * - consent false, explicit     → reset() (drops identified distinct_id)
 * - track() / trackAnonymous() always capture on PostHog when ready
 * - Supabase side (event_logs, increment_analytics_event) is unaffected
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──
const {
  mockPosthogCapture,
  mockPosthogOptOut,
  mockPosthogOptIn,
  mockPosthogReset,
  mockPosthogSetConfig,
  mockPosthogIdentify,
  mockPosthogHasOptedIn,
  mockInsert,
} = vi.hoisted(() => ({
  mockPosthogCapture: vi.fn(),
  mockPosthogOptOut: vi.fn(),
  mockPosthogOptIn: vi.fn(),
  mockPosthogReset: vi.fn(),
  mockPosthogSetConfig: vi.fn(),
  mockPosthogIdentify: vi.fn(),
  mockPosthogHasOptedIn: vi.fn().mockReturnValue(false),
  mockInsert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/posthog", () => ({
  isPosthogReady: true,
  posthog: {
    capture: mockPosthogCapture,
    opt_out_capturing: mockPosthogOptOut,
    opt_in_capturing: mockPosthogOptIn,
    has_opted_in_capturing: mockPosthogHasOptedIn,
    reset: mockPosthogReset,
    set_config: mockPosthogSetConfig,
    identify: mockPosthogIdentify,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
    },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
    rpc: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }),
  },
}));

import { track, trackAnonymous, setAnalyticsConsent, hasExplicitAnalyticsOptOut, ANALYTICS_EVENTS } from "@/lib/analytics";

describe("Analytics consent gating", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset consent to false (default)
    await setAnalyticsConsent(false);
    vi.clearAllMocks(); // Clear the reset() call from setAnalyticsConsent(false)
  });

  describe("setAnalyticsConsent", () => {
    it("calls posthog.reset() when consent is false (no hard opt-out)", async () => {
      await setAnalyticsConsent(false);
      expect(mockPosthogReset).toHaveBeenCalled();
      expect(mockPosthogOptOut).not.toHaveBeenCalled();
    });

    it("identifies user when consent is true (no opt-in since capturing is already on)", async () => {
      await setAnalyticsConsent(true);
      expect(mockPosthogIdentify).toHaveBeenCalledWith("u1", expect.any(Object));
      expect(mockPosthogOptIn).not.toHaveBeenCalled();
    });

    it("identifies pseudonymously when no preference was ever expressed", async () => {
      await setAnalyticsConsent(false, { explicit: false });
      expect(mockPosthogIdentify).toHaveBeenCalledWith("u1");
      expect(mockPosthogReset).not.toHaveBeenCalled();
    });

    it("resets instead of identifying when consent is explicitly revoked", async () => {
      await setAnalyticsConsent(false, { explicit: true });
      expect(mockPosthogReset).toHaveBeenCalled();
      expect(mockPosthogIdentify).not.toHaveBeenCalled();
    });

    it("attaches no PII on the pseudonymous path", async () => {
      await setAnalyticsConsent(false, { explicit: false });
      expect(mockPosthogIdentify).toHaveBeenCalledTimes(1);
      expect(mockPosthogIdentify.mock.calls[0]).toHaveLength(1);
    });
  });

  describe("explicit opt-out is durable across reloads", () => {
    it("records the opt-out so useAuth can honour it before the profile loads", async () => {
      await setAnalyticsConsent(false, { explicit: true });
      expect(hasExplicitAnalyticsOptOut()).toBe(true);
    });

    it("does not record an opt-out when no preference was expressed", async () => {
      await setAnalyticsConsent(false, { explicit: false });
      expect(hasExplicitAnalyticsOptOut()).toBe(false);
    });

    it("clears the opt-out when consent is granted again", async () => {
      await setAnalyticsConsent(false, { explicit: true });
      expect(hasExplicitAnalyticsOptOut()).toBe(true);

      await setAnalyticsConsent(true);
      expect(hasExplicitAnalyticsOptOut()).toBe(false);
    });
  });

  describe("track() — always captures, PII only attached when identify()'d", () => {
    it("calls posthog.capture even when consent is false (anonymous distinct_id)", async () => {
      await setAnalyticsConsent(false);
      vi.clearAllMocks();

      await track("test_event", { source: "test" });

      expect(mockPosthogCapture).toHaveBeenCalledWith("test_event", { source: "test" });
    });

    it("calls posthog.capture when consent is true (identified distinct_id)", async () => {
      await setAnalyticsConsent(true);
      vi.clearAllMocks();

      await track("test_event", { source: "test" });

      expect(mockPosthogCapture).toHaveBeenCalledWith("test_event", { source: "test" });
    });

    it("always inserts into event_logs regardless of consent", async () => {
      await setAnalyticsConsent(false);
      vi.clearAllMocks();

      const { supabase } = await import("@/integrations/supabase/client");

      await track("test_event");

      expect(supabase.from).toHaveBeenCalledWith("event_logs");
    });
  });

  describe("trackAnonymous() — always captures", () => {
    it("calls posthog.capture when consent is false", async () => {
      await setAnalyticsConsent(false);
      vi.clearAllMocks();

      trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD);

      expect(mockPosthogCapture).toHaveBeenCalledWith("page_view_dashboard");
    });

    it("calls posthog.capture when consent is true", async () => {
      await setAnalyticsConsent(true);
      vi.clearAllMocks();

      trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD);

      expect(mockPosthogCapture).toHaveBeenCalledWith("page_view_dashboard");
    });

    it("always calls Supabase RPC regardless of consent", async () => {
      await setAnalyticsConsent(false);
      vi.clearAllMocks();
      const { supabase } = await import("@/integrations/supabase/client");

      trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD);

      expect(supabase.rpc).toHaveBeenCalledWith("increment_analytics_event", { p_event_name: "page_view_dashboard" });
    });
  });
});
