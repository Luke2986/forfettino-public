import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { usePrivacyConsent } from "./usePrivacyConsent";
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from "@/lib/legal-versions";

// Mock useAuth
const mockUser = { id: "user-123" };
vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("usePrivacyConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain: from().select().eq().maybeSingle()
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    // Default chain for update: from().update().eq().select().single()
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    });
  });

  it("needsConsent = true when privacy_policy_accepted_at is null", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: null,
        privacy_policy_version: null,
        tos_accepted_at: null,
        tos_version: null,
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsConsent).toBe(true);
    expect(result.current.isFirstTime).toBe(true);
  });

  it("needsConsent = true when privacy_policy_version mismatches", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: "2025-01-01T00:00:00Z",
        privacy_policy_version: "2025-01-01-v1.0",
        tos_accepted_at: "2025-01-01T00:00:00Z",
        tos_version: CURRENT_TOS_VERSION,
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsConsent).toBe(true);
    expect(result.current.isFirstTime).toBe(false);
  });

  it("needsConsent = true when tos_version mismatches", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: "2025-01-01T00:00:00Z",
        privacy_policy_version: CURRENT_PRIVACY_VERSION,
        tos_accepted_at: "2025-01-01T00:00:00Z",
        tos_version: "2024-01-01-v0.9",
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsConsent).toBe(true);
    expect(result.current.isFirstTime).toBe(false);
  });

  it("needsConsent = false when versions are current", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: "2026-03-01T00:00:00Z",
        privacy_policy_version: CURRENT_PRIVACY_VERSION,
        tos_accepted_at: "2026-03-01T00:00:00Z",
        tos_version: CURRENT_TOS_VERSION,
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsConsent).toBe(false);
    expect(result.current.isFirstTime).toBe(false);
  });

  it("isFirstTime = true only when accepted_at is null", async () => {
    // accepted_at present but version mismatch → NOT first time
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: "2025-06-01T00:00:00Z",
        privacy_policy_version: "old-version",
        tos_accepted_at: "2025-06-01T00:00:00Z",
        tos_version: "old-version",
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFirstTime).toBe(false);
  });

  it("needsConsent = false when localStorage signup flag is set (Story 35.3 — no double modal)", async () => {
    // Simulate user who accepted consent at signup but profiles not yet updated
    localStorage.setItem("forfettino:privacy-accepted-at-signup", "true");
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: null,
        privacy_policy_version: null,
        tos_accepted_at: null,
        tos_version: null,
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Flag suppresses needsConsent → no BlockingModal
    expect(result.current.needsConsent).toBe(false);
    // Cleanup
    localStorage.removeItem("forfettino:privacy-accepted-at-signup");
  });

  it("needsConsent = true for users on the PREVIOUS privacy version (Story 84-7 re-consenso via version-bump)", async () => {
    // Utente che aveva accettato la versione precedente (pre-84-7). Il bump di
    // CURRENT_PRIVACY_VERSION a 2026-06-27-v2.1 deve far scattare il re-consenso in-app.
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: "2026-04-01T00:00:00Z",
        privacy_policy_version: "2026-03-27-v2.0", // versione precedente hardcoded
        tos_accepted_at: "2026-04-01T00:00:00Z",
        tos_version: CURRENT_TOS_VERSION, // ToS invariati: NON deve essere causa del re-consenso
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsConsent).toBe(true);
    expect(result.current.isFirstTime).toBe(false);
  });

  it("exports acceptConsent function", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        privacy_policy_accepted_at: null,
        privacy_policy_version: null,
        tos_accepted_at: null,
        tos_version: null,
      },
      error: null,
    });

    const { result } = renderHook(() => usePrivacyConsent(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.acceptConsent).toBe("function");
  });
});
