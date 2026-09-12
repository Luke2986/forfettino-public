import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// --- Chainable Supabase mock builder ---
function createChainMock(resolvedValue: any) {
  const chain: any = {};
  const methods = ["from", "select", "eq", "gt", "is", "not", "in", "order", "limit", "maybeSingle"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Terminal: the chain resolves to the value
  chain.then = (resolve: any) => resolve(resolvedValue);
  // Make it thenable for await
  chain[Symbol.toStringTag] = "Promise";
  return chain;
}

let mockFromCalls: Record<string, any> = {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      return mockFromCalls[table] || createChainMock({ data: [], error: null, count: 0 });
    }),
  },
}));

import { useWaitlistNurtureStats, EMAIL_TYPE_LABELS, computeStatus } from "./useWaitlistNurtureStats";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useWaitlistNurtureStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromCalls = {};
  });

  it("returns empty array when no active launch windows", async () => {
    // launch_windows query returns empty
    const windowChain = createChainMock({ data: [], error: null });
    mockFromCalls["launch_windows"] = windowChain;

    const { result } = renderHook(() => useWaitlistNurtureStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it("returns stats with correct structure for a window", async () => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // launch_windows
    const windowChain = createChainMock({
      data: [{ id: "win-1", name: "Early Bird", starts_at: futureDate }],
      error: null,
    });
    mockFromCalls["launch_windows"] = windowChain;

    // pro_waitlist active count
    const activeChain = createChainMock({ data: null, error: null, count: 20 });
    // pro_waitlist unsubscribed count
    const unsubChain = createChainMock({ data: null, error: null, count: 2 });

    let waitlistCallCount = 0;
    mockFromCalls["pro_waitlist"] = {
      select: vi.fn(() => {
        waitlistCallCount++;
        if (waitlistCallCount === 1) return activeChain;
        return unsubChain;
      }),
    };

    // waitlist_email_sent
    const sentChain = createChainMock({
      data: [
        { window_id: "win-1", email_type: "nurture_t14" },
        { window_id: "win-1", email_type: "nurture_t14" },
        { window_id: "win-1", email_type: "nurture_t14" },
      ],
      error: null,
    });
    mockFromCalls["waitlist_email_sent"] = sentChain;

    const { result } = renderHook(() => useWaitlistNurtureStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(1);
    });

    const win = result.current.data![0];
    expect(win.windowId).toBe("win-1");
    expect(win.windowName).toBe("Early Bird");
    expect(win.rows).toHaveLength(3);

    // T-14 row: 3 sent, 18 eligible total (20 active - 2 unsub), pending = 15
    const t14 = win.rows.find((r) => r.email_type === "nurture_t14")!;
    expect(t14.sent).toBe(3);
    expect(t14.pending).toBe(15); // 18 - 3
    expect(t14.unsubscribed).toBe(2);

    // T-7 and T-48h: 0 sent
    const t7 = win.rows.find((r) => r.email_type === "nurture_t7")!;
    expect(t7.sent).toBe(0);
    expect(t7.pending).toBe(18);
  });
});

describe("computeStatus", () => {
  it("returns 'completed' when pending=0 and sent>0", () => {
    expect(computeStatus("nurture_t14", 20, 10, 0)).toBe("completed");
    expect(computeStatus("nurture_t7", 3, 5, 0)).toBe("completed");
    expect(computeStatus("nurture_t48h", 0, 1, 0)).toBe("completed");
  });

  it("returns 'scheduled' when pending=0 and sent=0 (no recipients)", () => {
    expect(computeStatus("nurture_t14", 20, 0, 0)).toBe("scheduled");
  });

  it("returns 'in_progress' when delta is within the email type window", () => {
    // nurture_t14: 12.5..15.5
    expect(computeStatus("nurture_t14", 14, 5, 10)).toBe("in_progress");
    expect(computeStatus("nurture_t14", 12.5, 0, 10)).toBe("in_progress");
    // nurture_t7: 5.5..8.5
    expect(computeStatus("nurture_t7", 7, 3, 7)).toBe("in_progress");
    // nurture_t48h: 1.0..3.0
    expect(computeStatus("nurture_t48h", 2, 1, 5)).toBe("in_progress");
  });

  it("returns 'scheduled' when delta is outside the email type window", () => {
    // T-14 window but delta=20 (too far)
    expect(computeStatus("nurture_t14", 20, 0, 10)).toBe("scheduled");
    // T-7 window but delta=10 (in gap)
    expect(computeStatus("nurture_t7", 10, 0, 10)).toBe("scheduled");
    // T-48h window but delta=5 (in gap)
    expect(computeStatus("nurture_t48h", 5, 0, 10)).toBe("scheduled");
  });

  it("'completed' takes priority over 'in_progress' (all sent even if within window)", () => {
    expect(computeStatus("nurture_t14", 14, 10, 0)).toBe("completed");
  });
});

describe("EMAIL_TYPE_LABELS", () => {
  it("has entries for all 3 email types", () => {
    expect(EMAIL_TYPE_LABELS.nurture_t14).toBeDefined();
    expect(EMAIL_TYPE_LABELS.nurture_t7).toBeDefined();
    expect(EMAIL_TYPE_LABELS.nurture_t48h).toBeDefined();
  });

  it("has correct delta days", () => {
    expect(EMAIL_TYPE_LABELS.nurture_t14.deltaDays).toBe(14);
    expect(EMAIL_TYPE_LABELS.nurture_t7.deltaDays).toBe(7);
    expect(EMAIL_TYPE_LABELS.nurture_t48h.deltaDays).toBe(2);
  });
});
