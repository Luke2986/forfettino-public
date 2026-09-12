import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useBlockingModalQueue } from "./useBlockingModalQueue";

// --- Mocks ---

const mockUser = { id: "user-123" };

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  },
}));

// --- Helpers ---

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockPopup1 = {
  id: "notif-1",
  user_id: "user-123",
  type: "admin_individual",
  category: "aggiornamenti",
  title: "Messaggio admin",
  body: "Corpo del messaggio",
  delivery_channel: "popup",
  dismissed_at: null,
  read_at: null,
  action_url: null,
  action_label: null,
  metadata: {},
  created_at: "2026-02-26T10:00:00Z",
  updated_at: "2026-02-26T10:00:00Z",
  email_sent_at: null,
  sms_sent_at: null,
};

const mockPopup2 = {
  ...mockPopup1,
  id: "notif-2",
  title: "Secondo messaggio",
  created_at: "2026-02-26T11:00:00Z",
};

describe("useBlockingModalQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ritorna il primo popup della coda (FIFO)", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [mockPopup1, mockPopup2],
        error: null,
      }),
    });

    const { result } = renderHook(() => useBlockingModalQueue(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentPopup).toBeTruthy();
    });

    expect(result.current.currentPopup?.id).toBe("notif-1");
    expect(result.current.queueLength).toBe(2);
  });

  it("ritorna null e queueLength 0 quando la coda è vuota", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const { result } = renderHook(() => useBlockingModalQueue(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.queueLength).toBe(0);
    });

    expect(result.current.currentPopup).toBeNull();
  });

  it("ritorna null quando isAppReady=false anche con coda non vuota", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [mockPopup1],
        error: null,
      }),
    });

    const { result } = renderHook(
      () => useBlockingModalQueue({ isAppReady: false }),
      { wrapper: createWrapper() },
    );

    // Con isAppReady=false, la query non è abilitata → currentPopup è null
    expect(result.current.currentPopup).toBeNull();
    expect(result.current.queueLength).toBe(0);
  });

  it("dismissCurrent chiama update con dismissed_at", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [mockPopup1],
        error: null,
      }),
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const { result } = renderHook(() => useBlockingModalQueue(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentPopup).toBeTruthy();
    });

    result.current.dismissCurrent();

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ dismissed_at: expect.any(String) }),
      );
    });
  });
});
