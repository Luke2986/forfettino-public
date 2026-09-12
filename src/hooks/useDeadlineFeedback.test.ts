import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useDeadlineFeedback } from "./useDeadlineFeedback";

// ── Mocks ──

const mockInsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useDeadlineFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("submits 'yes' response — INSERT feedback only", async () => {
    const { result } = renderHook(() => useDeadlineFeedback(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        scheduleEventId: "sched-1",
        notificationId: "notif-1",
        response: "yes",
      });
    });

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      schedule_event_id: "sched-1",
      response: "yes",
      reason: null,
      free_text: null,
    });
  });

  it("submits 'no' response with reason and free_text", async () => {
    const { result } = renderHook(() => useDeadlineFeedback(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        scheduleEventId: "sched-2",
        notificationId: "notif-2",
        response: "no",
        reason: "no_money",
        freeText: "Non avevo liquidità",
      });
    });

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      schedule_event_id: "sched-2",
      response: "no",
      reason: "no_money",
      free_text: "Non avevo liquidità",
    });
  });

  it("submits 'dismissed' response with null reason", async () => {
    const { result } = renderHook(() => useDeadlineFeedback(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        scheduleEventId: "sched-3",
        notificationId: "notif-3",
        response: "dismissed",
      });
    });

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      schedule_event_id: "sched-3",
      response: "dismissed",
      reason: null,
      free_text: null,
    });
  });

  it("truncates free_text to 200 characters", async () => {
    const longText = "A".repeat(300);
    const { result } = renderHook(() => useDeadlineFeedback(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        scheduleEventId: "sched-4",
        notificationId: "notif-4",
        response: "no",
        reason: "other",
        freeText: longText,
      });
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        free_text: "A".repeat(200),
      })
    );
  });

  it("throws on feedback INSERT error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "DB error" } });

    const { result } = renderHook(() => useDeadlineFeedback(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          scheduleEventId: "sched-5",
          notificationId: "notif-5",
          response: "yes",
        });
      })
    ).rejects.toEqual({ message: "DB error" });
  });
});
