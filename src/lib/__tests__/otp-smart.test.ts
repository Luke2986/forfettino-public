import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldRequireOtp,
  OTP_THRESHOLD_DAYS,
  DEVICE_TRUST_EXPIRY_DAYS,
  saveDeviceTrust,
  isDeviceTrusted,
  clearDeviceTrust,
} from "../otp-smart";

describe("shouldRequireOtp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when lastOtpVerifiedAt is null (mai verificato)", () => {
    expect(shouldRequireOtp(null)).toBe(true);
  });

  it("returns true when lastOtpVerifiedAt is empty string", () => {
    expect(shouldRequireOtp("")).toBe(true);
  });

  it("returns true when lastOtpVerifiedAt is invalid date", () => {
    expect(shouldRequireOtp("not-a-date")).toBe(true);
  });

  it("returns false when verified 1 day ago", () => {
    vi.setSystemTime(new Date("2026-04-01T12:00:00+00:00"));
    const oneDayAgo = "2026-03-31T12:00:00+00:00";
    expect(shouldRequireOtp(oneDayAgo)).toBe(false);
  });

  it("returns true when verified 15 days ago", () => {
    vi.setSystemTime(new Date("2026-04-01T12:00:00+00:00"));
    const fifteenDaysAgo = "2026-03-17T12:00:00+00:00";
    expect(shouldRequireOtp(fifteenDaysAgo)).toBe(true);
  });

  it("returns false when verified exactly 14 days ago (boundary — not exceeded)", () => {
    vi.setSystemTime(new Date("2026-04-01T12:00:00+00:00"));
    const fourteenDaysAgo = "2026-03-18T12:00:00+00:00";
    expect(shouldRequireOtp(fourteenDaysAgo)).toBe(false);
  });

  it("returns true when verified 14 days + 1 hour ago (boundary — exceeded)", () => {
    vi.setSystemTime(new Date("2026-04-01T13:00:00+00:00"));
    const fourteenDaysAgo = "2026-03-18T12:00:00+00:00";
    expect(shouldRequireOtp(fourteenDaysAgo)).toBe(true);
  });

  it("respects custom thresholdDays parameter", () => {
    vi.setSystemTime(new Date("2026-04-01T12:00:00+00:00"));
    const threeDaysAgo = "2026-03-29T12:00:00+00:00";
    expect(shouldRequireOtp(threeDaysAgo, 2)).toBe(true);
    expect(shouldRequireOtp(threeDaysAgo, 7)).toBe(false);
  });

  it("handles date-only string (no T) via timezone safety append", () => {
    vi.setSystemTime(new Date("2026-04-01T12:00:00+00:00"));
    const recent = "2026-03-31";
    expect(shouldRequireOtp(recent)).toBe(false);
  });

  it("exports OTP_THRESHOLD_DAYS as 14", () => {
    expect(OTP_THRESHOLD_DAYS).toBe(14);
  });
});

// ────────────────────────────────────────────────────────────
// Device Trust — Story 67.2
// ────────────────────────────────────────────────────────────

describe("DEVICE_TRUST_EXPIRY_DAYS", () => {
  it("is 30", () => {
    expect(DEVICE_TRUST_EXPIRY_DAYS).toBe(30);
  });
});

describe("saveDeviceTrust", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-01T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves a valid token in localStorage", () => {
    saveDeviceTrust("user-1");
    const raw = localStorage.getItem("device_trust_user-1");
    expect(raw).not.toBeNull();
    const token = JSON.parse(raw!);
    expect(token.userId).toBe("user-1");
    expect(token.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Expiry should be ~30 days after createdAt
    const created = new Date(token.createdAt).getTime();
    const expires = new Date(token.expiresAt).getTime();
    const diffDays = (expires - created) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it("respects custom expiryDays", () => {
    saveDeviceTrust("user-1", 7);
    const token = JSON.parse(localStorage.getItem("device_trust_user-1")!);
    const created = new Date(token.createdAt).getTime();
    const expires = new Date(token.expiresAt).getTime();
    const diffDays = (expires - created) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });
});

describe("isDeviceTrusted", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-01T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for a valid, non-expired token", () => {
    saveDeviceTrust("user-1");
    expect(isDeviceTrusted("user-1")).toBe(true);
  });

  it("returns false when token is missing", () => {
    expect(isDeviceTrusted("user-1")).toBe(false);
  });

  it("returns false when token is expired", () => {
    saveDeviceTrust("user-1", 1); // 1 day expiry
    // Advance 2 days
    vi.setSystemTime(new Date("2026-04-03T12:00:00"));
    expect(isDeviceTrusted("user-1")).toBe(false);
  });

  it("returns false when JSON is corrupted", () => {
    localStorage.setItem("device_trust_user-1", "not-json");
    expect(isDeviceTrusted("user-1")).toBe(false);
  });

  it("returns false when userId does not match", () => {
    saveDeviceTrust("user-2");
    // Read with different userId key — should not find it
    expect(isDeviceTrusted("user-1")).toBe(false);
  });

  it("returns false when token has wrong userId field", () => {
    // Manually write a token with mismatched userId
    localStorage.setItem(
      "device_trust_user-1",
      JSON.stringify({ userId: "user-other", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() }),
    );
    expect(isDeviceTrusted("user-1")).toBe(false);
  });
});

describe("clearDeviceTrust", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes a specific user token", () => {
    saveDeviceTrust("user-1");
    saveDeviceTrust("user-2");
    clearDeviceTrust("user-1");
    expect(localStorage.getItem("device_trust_user-1")).toBeNull();
    expect(localStorage.getItem("device_trust_user-2")).not.toBeNull();
  });

  it("removes all device_trust_* tokens when no userId provided", () => {
    saveDeviceTrust("user-1");
    saveDeviceTrust("user-2");
    localStorage.setItem("other_key", "keep");
    clearDeviceTrust();
    expect(localStorage.getItem("device_trust_user-1")).toBeNull();
    expect(localStorage.getItem("device_trust_user-2")).toBeNull();
    expect(localStorage.getItem("other_key")).toBe("keep");
  });
});
