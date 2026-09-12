import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { REFERRAL_CODE_KEY } from "./ReferralLanding";

// Mock supabase
const mockGetSession = vi.fn();
const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  setAnalyticsConsent: vi.fn(),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AuthCallbackPage from "./AuthCallback";

describe("AuthCallback — referral processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("processes referral code via Edge Function after session established", async () => {
    localStorage.setItem(REFERRAL_CODE_KEY, "REF123");
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    render(
      <HelmetProvider>
        <MemoryRouter>
          <AuthCallbackPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    // Wait for async callback to complete
    await vi.waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("process-referral", {
        body: { referrer_code: "REF123" },
      });
    });

    // localStorage should be cleared
    expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBeNull();
  });

  it("does not call Edge Function when no referral code in localStorage", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    render(
      <HelmetProvider>
        <MemoryRouter>
          <AuthCallbackPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("does not process referral when session has error", async () => {
    vi.useFakeTimers();

    localStorage.setItem(REFERRAL_CODE_KEY, "REF456");
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Session expired" },
    });

    render(
      <HelmetProvider>
        <MemoryRouter>
          <AuthCallbackPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    // Wait for the async handleCallback to complete
    await vi.advanceTimersByTimeAsync(100);

    // Error path sets a 2000ms setTimeout before navigating
    vi.advanceTimersByTime(2100);

    expect(mockNavigate).toHaveBeenCalledWith("/login");

    // Edge Function should NOT have been called
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    // Code should still be in localStorage for next attempt
    expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("REF456");

    vi.useRealTimers();
  });
});
