import { describe, it, expect } from "vitest";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TOS_VERSION,
  type LegalConsent,
} from "../legal-versions";

describe("legal-versions", () => {
  it("exports CURRENT_PRIVACY_VERSION as a non-empty string", () => {
    expect(typeof CURRENT_PRIVACY_VERSION).toBe("string");
    expect(CURRENT_PRIVACY_VERSION.length).toBeGreaterThan(0);
    // Bump 2026-09-01: base giuridica analytics rivista (legittimo interesse per
    // l'identificativo pseudonimo, consenso per email e attributi di profilo).
    expect(CURRENT_PRIVACY_VERSION).toBe("2026-09-01-v2.2");
  });

  it("exports CURRENT_TOS_VERSION as a non-empty string", () => {
    expect(typeof CURRENT_TOS_VERSION).toBe("string");
    expect(CURRENT_TOS_VERSION.length).toBeGreaterThan(0);
    expect(CURRENT_TOS_VERSION).toBe("2026-03-05-v1.0");
  });

  it("LegalConsent type is structurally correct", () => {
    // Compile-time check: ensure this object satisfies the LegalConsent type
    const consent: LegalConsent = {
      privacy_policy_accepted_at: "2026-03-05T12:00:00Z",
      privacy_policy_version: "2026-03-05-v1.0",
      tos_accepted_at: null,
      tos_version: null,
      analytics_consent: false,
      analytics_consent_at: null,
      marketing_email_consent: false,
      marketing_email_consent_at: null,
    };
    expect(consent.analytics_consent).toBe(false);
    expect(consent.analytics_consent_at).toBeNull();
    expect(consent.marketing_email_consent_at).toBeNull();
    expect(consent.privacy_policy_accepted_at).toBe("2026-03-05T12:00:00Z");
  });
});
