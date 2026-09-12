import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Hoisted mocks ──
const { mockFrom, mockNotifFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotifFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "notifications") return mockNotifFrom();
      return mockFrom();
    },
  },
}));

import { useAdminUserMessages } from "./useAdminUserMessages";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ── Test data ──

const sampleAnnouncements = [
  {
    id: "ann-1",
    title: "Benvenuto!",
    body: "Grazie per esserti registrato.",
    action_url: null,
    action_label: null,
    delivery_type: "sidebar",
    sent_count: 1,
    created_at: "2026-02-27T10:00:00Z",
    published_at: "2026-02-27T10:00:00Z",
    target_type: "individual",
    target_user_id: "user-abc",
  },
  {
    id: "ann-2",
    title: "Aggiornamento",
    body: "Nuove funzionalità disponibili.",
    action_url: "/novita",
    action_label: "Scopri",
    delivery_type: "popup",
    sent_count: 0,
    created_at: "2026-02-26T15:00:00Z",
    published_at: "2026-02-26T15:00:00Z",
    target_type: "individual",
    target_user_id: "user-abc",
  },
];

const sampleNotifications = [
  {
    metadata: { announcement_id: "ann-1" },
    read_at: "2026-02-27T11:00:00Z",
    dismissed_at: null,
  },
  {
    metadata: { announcement_id: "ann-2", suppressed: true },
    read_at: "2026-02-26T15:00:00Z",
    dismissed_at: "2026-02-26T15:00:00Z",
  },
];

// ── Helper to build mock chain ──

function buildAnnouncementChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function buildNotificationChain(result: { data: any; error?: any }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAdminUserMessages", () => {
  it("returns empty array when userId is null", async () => {
    const { result } = renderHook(() => useAdminUserMessages(null), {
      wrapper: createWrapper(),
    });

    // enabled: false → data stays undefined, no fetch
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // fetchStatus should be "idle" since query is disabled
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches and merges announcements with notification status", async () => {
    const annChain = buildAnnouncementChain({
      data: sampleAnnouncements,
      error: null,
    });
    const notifChain = buildNotificationChain({
      data: sampleNotifications,
    });

    mockFrom.mockReturnValue(annChain);
    mockNotifFrom.mockReturnValue(notifChain);

    const { result } = renderHook(() => useAdminUserMessages("user-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const messages = result.current.data!;
    expect(messages).toHaveLength(2);

    // First message: ann-1, read, not suppressed
    expect(messages[0].id).toBe("ann-1");
    expect(messages[0].title).toBe("Benvenuto!");
    expect(messages[0].read_at).toBe("2026-02-27T11:00:00Z");
    expect(messages[0].dismissed_at).toBeNull();
    expect(messages[0].suppressed).toBe(false);
    expect(messages[0].delivery_type).toBe("sidebar");
    expect(messages[0].sent_count).toBe(1);

    // Second message: ann-2, suppressed
    expect(messages[1].id).toBe("ann-2");
    expect(messages[1].title).toBe("Aggiornamento");
    expect(messages[1].suppressed).toBe(true);
    expect(messages[1].sent_count).toBe(0);
    expect(messages[1].delivery_type).toBe("popup");
    expect(messages[1].action_url).toBe("/novita");
    expect(messages[1].action_label).toBe("Scopri");
  });

  it("returns empty array when no announcements found", async () => {
    const annChain = buildAnnouncementChain({
      data: [],
      error: null,
    });
    mockFrom.mockReturnValue(annChain);

    const { result } = renderHook(() => useAdminUserMessages("user-xyz"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("returns empty array when announcements data is null", async () => {
    const annChain = buildAnnouncementChain({
      data: null,
      error: null,
    });
    mockFrom.mockReturnValue(annChain);

    const { result } = renderHook(() => useAdminUserMessages("user-xyz"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("throws error when announcement query fails", async () => {
    const annChain = buildAnnouncementChain({
      data: null,
      error: new Error("DB error"),
    });
    mockFrom.mockReturnValue(annChain);

    const { result } = renderHook(() => useAdminUserMessages("user-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it("handles missing notification data gracefully (defaults to not-read, not-suppressed)", async () => {
    // Announcement exists but no matching notification
    const annChain = buildAnnouncementChain({
      data: [sampleAnnouncements[0]],
      error: null,
    });
    const notifChain = buildNotificationChain({
      data: [], // no matching notifications
    });

    mockFrom.mockReturnValue(annChain);
    mockNotifFrom.mockReturnValue(notifChain);

    const { result } = renderHook(() => useAdminUserMessages("user-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const messages = result.current.data!;
    expect(messages).toHaveLength(1);
    expect(messages[0].read_at).toBeNull();
    expect(messages[0].dismissed_at).toBeNull();
    expect(messages[0].suppressed).toBe(false);
  });

  it("defaults delivery_type to 'sidebar' when missing", async () => {
    const annWithoutDelivery = {
      ...sampleAnnouncements[0],
      delivery_type: undefined,
    };
    const annChain = buildAnnouncementChain({
      data: [annWithoutDelivery],
      error: null,
    });
    const notifChain = buildNotificationChain({ data: [] });

    mockFrom.mockReturnValue(annChain);
    mockNotifFrom.mockReturnValue(notifChain);

    const { result } = renderHook(() => useAdminUserMessages("user-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data![0].delivery_type).toBe("sidebar");
  });

  it("defaults sent_count to 0 when missing", async () => {
    const annWithoutCount = {
      ...sampleAnnouncements[0],
      sent_count: undefined,
    };
    const annChain = buildAnnouncementChain({
      data: [annWithoutCount],
      error: null,
    });
    const notifChain = buildNotificationChain({ data: [] });

    mockFrom.mockReturnValue(annChain);
    mockNotifFrom.mockReturnValue(notifChain);

    const { result } = renderHook(() => useAdminUserMessages("user-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data![0].sent_count).toBe(0);
  });

  it("queries announcements with correct filters", async () => {
    const annChain = buildAnnouncementChain({
      data: [],
      error: null,
    });
    mockFrom.mockReturnValue(annChain);

    renderHook(() => useAdminUserMessages("user-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(annChain.select).toHaveBeenCalledWith("*");
    });

    expect(annChain.eq).toHaveBeenCalledWith("target_user_id", "user-abc");
    expect(annChain.eq).toHaveBeenCalledWith("target_type", "individual");
    expect(annChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});
