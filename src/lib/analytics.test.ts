import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted so the mock fn is available when vi.mock factory runs (hoisted)
const mockRpc = vi.hoisted(() => vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })));
const mockPosthogCapture = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })) }),
  },
}));

vi.mock("@/lib/posthog", () => ({
  posthog: {
    capture: mockPosthogCapture,
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    has_opted_in_capturing: vi.fn().mockReturnValue(false),
    reset: vi.fn(),
    set_config: vi.fn(),
    identify: vi.fn(),
  },
  isPosthogReady: true,
}));

import { ANALYTICS_EVENTS, trackAnonymous, setAnalyticsConsent } from "./analytics";
import type { AnalyticsEvent } from "./analytics";

describe("analytics — anonymous tracking", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setAnalyticsConsent(true);
    vi.clearAllMocks();
  });

  it("ANALYTICS_EVENTS contains all 9 event names", () => {
    const keys = Object.keys(ANALYTICS_EVENTS);
    expect(keys).toHaveLength(9);
    expect(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD).toBe("page_view_dashboard");
    expect(ANALYTICS_EVENTS.PAGE_VIEW_SCADENZIARIO).toBe("page_view_scadenziario");
    expect(ANALYTICS_EVENTS.INCASSO_CREATO).toBe("incasso_creato");
    expect(ANALYTICS_EVENTS.SCADENZA_PAGATA).toBe("scadenza_pagata");
    expect(ANALYTICS_EVENTS.ONBOARDING_COMPLETATO).toBe("onboarding_completato");
    expect(ANALYTICS_EVENTS.CHECKLIST_DISMISSED).toBe("checklist_dismissed");
    expect(ANALYTICS_EVENTS.NOTIFICA_LETTA).toBe("notifica_letta");
    expect(ANALYTICS_EVENTS.GUIDE_PDF_PREVIEW_VIEWED).toBe("guide_pdf_preview_viewed");
    expect(ANALYTICS_EVENTS.GUIDE_PDF_DOWNLOADED).toBe("guide_pdf_downloaded");
  });

  it("trackAnonymous calls supabase.rpc with correct params", () => {
    trackAnonymous(ANALYTICS_EVENTS.INCASSO_CREATO);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("increment_analytics_event", {
      p_event_name: "incasso_creato",
    });
  });

  it("trackAnonymous also fires posthog.capture", () => {
    trackAnonymous(ANALYTICS_EVENTS.INCASSO_CREATO);

    expect(mockPosthogCapture).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("incasso_creato");
  });

  it("trackAnonymous with skipPosthog skips PostHog but still increments Supabase counter", () => {
    trackAnonymous(ANALYTICS_EVENTS.INCASSO_CREATO, { skipPosthog: true });

    expect(mockPosthogCapture).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("increment_analytics_event", {
      p_event_name: "incasso_creato",
    });
  });

  it("trackAnonymous skips invalid event names (both Supabase and PostHog)", () => {
    trackAnonymous("non_existent_event" as AnalyticsEvent);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockPosthogCapture).not.toHaveBeenCalled();
  });

  it("trackAnonymous is fire-and-forget (returns void)", () => {
    const result = trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD);
    expect(result).toBeUndefined();
  });

  it("trackAnonymous does not throw on RPC failure", async () => {
    mockRpc.mockReturnValueOnce(Promise.reject(new Error("Network error")));

    // Should not throw
    expect(() => trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD)).not.toThrow();

    // Wait for the promise to settle
    await vi.waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  });

  it("trackAnonymous does not throw on PostHog failure", () => {
    mockPosthogCapture.mockImplementationOnce(() => {
      throw new Error("PostHog error");
    });

    expect(() => trackAnonymous(ANALYTICS_EVENTS.PAGE_VIEW_DASHBOARD)).not.toThrow();
  });

  it("each ANALYTICS_EVENTS value is a unique string", () => {
    const values = Object.values(ANALYTICS_EVENTS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});
