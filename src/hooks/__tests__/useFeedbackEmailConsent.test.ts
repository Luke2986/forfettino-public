/**
 * Test per useFeedbackEmailConsent hook (Story 14.6)
 *
 * Copertura:
 * - needsEmailConsent = true quando feedback_email_consent_at è null
 * - needsEmailConsent = false quando feedback_email_consent_at ha valore (sia SI che NO)
 * - needsEmailConsent = false quando privacy consent è ancora pendente
 * - needsEmailConsent = false durante il caricamento
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock hooks
const mockProfile = {
  id: "1",
  user_id: "u1",
  first_name: "Test",
  last_name: null,
  onboarding_completed: true,
  user_code: "TEST123",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  privacy_policy_accepted_at: "2026-01-01",
  privacy_policy_version: "1.0",
  tos_accepted_at: "2026-01-01",
  tos_version: "1.0",
  analytics_consent: false,
  analytics_consent_at: null,
  marketing_email_consent: false,
  marketing_email_consent_at: null,
  feedback_email_consent: false,
  feedback_email_consent_at: null as string | null,
  partita_iva: null,
};

let mockProfileLoading = false;
let mockNeedsPrivacyConsent = false;
let mockPrivacyLoading = false;

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: mockProfile,
    isLoading: mockProfileLoading,
  }),
}));

vi.mock("@/hooks/usePrivacyConsent", () => ({
  usePrivacyConsent: () => ({
    needsConsent: mockNeedsPrivacyConsent,
    isLoading: mockPrivacyLoading,
  }),
}));

import { useFeedbackEmailConsent } from "../useFeedbackEmailConsent";

describe("useFeedbackEmailConsent (Story 14.6)", () => {
  beforeEach(() => {
    mockProfile.feedback_email_consent_at = null;
    mockProfile.feedback_email_consent = false;
    mockProfileLoading = false;
    mockNeedsPrivacyConsent = false;
    mockPrivacyLoading = false;
  });

  it("returns needsEmailConsent=true when feedback_email_consent_at is null", () => {
    const { result } = renderHook(() => useFeedbackEmailConsent());
    expect(result.current.needsEmailConsent).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns needsEmailConsent=false when user already answered YES", () => {
    mockProfile.feedback_email_consent = true;
    mockProfile.feedback_email_consent_at = "2026-03-13T10:00:00.000Z";

    const { result } = renderHook(() => useFeedbackEmailConsent());
    expect(result.current.needsEmailConsent).toBe(false);
  });

  it("returns needsEmailConsent=false when user already answered NO", () => {
    mockProfile.feedback_email_consent = false;
    mockProfile.feedback_email_consent_at = "2026-03-13T10:00:00.000Z";

    const { result } = renderHook(() => useFeedbackEmailConsent());
    expect(result.current.needsEmailConsent).toBe(false);
  });

  it("returns needsEmailConsent=false when privacy consent is pending", () => {
    mockNeedsPrivacyConsent = true;

    const { result } = renderHook(() => useFeedbackEmailConsent());
    expect(result.current.needsEmailConsent).toBe(false);
  });

  it("returns needsEmailConsent=false during loading", () => {
    mockProfileLoading = true;

    const { result } = renderHook(() => useFeedbackEmailConsent());
    expect(result.current.needsEmailConsent).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("returns needsEmailConsent=false during privacy loading", () => {
    mockPrivacyLoading = true;

    const { result } = renderHook(() => useFeedbackEmailConsent());
    expect(result.current.needsEmailConsent).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });
});
