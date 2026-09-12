import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock useAuth
const mockUser = { id: "user-123" };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { useNpsEligibility } from "../useNpsEligibility";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useNpsEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns activeCampaign: null when no active campaigns exist", async () => {
    // Real chain: select → eq → or → or → order → limit
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useNpsEligibility(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeCampaign).toBeNull();
    expect(result.current.hasRespondedCurrentCampaign).toBe(false);
    expect(result.current.enabledTriggers).toEqual([]);
  });

  it("returns campaign when active campaign exists and user has NOT responded", async () => {
    const campaign = {
      id: "camp-1",
      is_active: true,
      enabled_triggers: ["third_receipt", "30days_active"],
      repeat_interval: "never",
      start_date: "2026-01-01T00:00:00",
      end_date: "2026-12-31T00:00:00",
      created_at: "2026-01-01T00:00:00",
    };

    // nps_campaigns query returns a campaign
    mockFrom.mockImplementation((table: string) => {
      if (table === "nps_campaigns") {
        // Real chain: select → eq → or → or → order → limit
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [campaign], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // survey_responses query returns empty (no response) — chain: select → eq(user_id) → eq(survey_key) → eq(campaign_id) → order → limit
      if (table === "survey_responses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useNpsEligibility(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeCampaign).toEqual(campaign);
    expect(result.current.hasRespondedCurrentCampaign).toBe(false);
    expect(result.current.enabledTriggers).toEqual(["third_receipt", "30days_active"]);
  });

  it("returns hasRespondedCurrentCampaign: true when user already responded", async () => {
    const campaign = {
      id: "camp-1",
      is_active: true,
      enabled_triggers: [],
      repeat_interval: "never",
      start_date: "2026-01-01T00:00:00",
      end_date: null,
      created_at: "2026-01-01T00:00:00",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "nps_campaigns") {
        // Real chain: select → eq → or → or → order → limit
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [campaign], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // survey_responses: chain includes user_id filter
      if (table === "survey_responses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: "resp-1" }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useNpsEligibility(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeCampaign).toEqual(campaign);
    expect(result.current.hasRespondedCurrentCampaign).toBe(true);
  });

  it("returns empty enabledTriggers when campaign has null/empty triggers (all enabled)", async () => {
    const campaign = {
      id: "camp-2",
      is_active: true,
      enabled_triggers: null,
      repeat_interval: "6m",
      start_date: "2026-01-01T00:00:00",
      end_date: null,
      created_at: "2026-01-01T00:00:00",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "nps_campaigns") {
        // Real chain: select → eq → or → or → order → limit
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [campaign], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // survey_responses: chain includes user_id filter
      if (table === "survey_responses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useNpsEligibility(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Empty/null triggers means ALL triggers are enabled
    expect(result.current.enabledTriggers).toEqual([]);
  });
});
