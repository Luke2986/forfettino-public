import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock the nurture stats hook
const mockUseWaitlistNurtureStats = vi.fn();

vi.mock("@/hooks/useWaitlistNurtureStats", () => ({
  useWaitlistNurtureStats: () => mockUseWaitlistNurtureStats(),
  EMAIL_TYPE_LABELS: {
    nurture_t14: { label: "T-14 (2 settimane)", deltaDays: 14 },
    nurture_t7: { label: "T-7 (1 settimana)", deltaDays: 7 },
    nurture_t48h: { label: "T-48h (2 giorni)", deltaDays: 2 },
  },
}));

// Mock supabase for AdminProWaitlist main query
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({ data: [], error: null })
        ),
      })),
    })),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { AdminProWaitlist } from "./AdminProWaitlist";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("AdminProWaitlist — Nurture section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nurture section with 3 rows per window", async () => {
    mockUseWaitlistNurtureStats.mockReturnValue({
      data: [
        {
          windowId: "win-1",
          windowName: "Early Bird",
          startsAt: "2026-05-01T08:00:00Z",
          rows: [
            { email_type: "nurture_t14", sent: 10, pending: 5, unsubscribed: 2, status: "completed" },
            { email_type: "nurture_t7", sent: 8, pending: 7, unsubscribed: 2, status: "in_progress" },
            { email_type: "nurture_t48h", sent: 0, pending: 15, unsubscribed: 2, status: "scheduled" },
          ],
        },
      ],
      isLoading: false,
    });

    render(createElement(AdminProWaitlist), { wrapper: createWrapper() });

    // Wait for the main query to resolve and skeleton to disappear
    await waitFor(() => {
      expect(screen.getByText("Email Nurture")).toBeDefined();
    });

    // Check window name
    expect(screen.getByText(/Early Bird/)).toBeDefined();

    // Check all 3 email type rows
    expect(screen.getByText("T-14 (2 settimane)")).toBeDefined();
    expect(screen.getByText("T-7 (1 settimana)")).toBeDefined();
    expect(screen.getByText("T-48h (2 giorni)")).toBeDefined();

    // Check badges
    expect(screen.getByText("Completata")).toBeDefined();
    expect(screen.getByText("In corso")).toBeDefined();
    expect(screen.getByText("Programmata")).toBeDefined();
  });

  it("does not render nurture section when no stats", async () => {
    mockUseWaitlistNurtureStats.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(createElement(AdminProWaitlist), { wrapper: createWrapper() });

    // Wait for main query to resolve, then check nurture section is absent
    await waitFor(() => {
      expect(screen.getByText("Waitlist Pro")).toBeDefined();
    });
    expect(screen.queryByText("Email Nurture")).toBeNull();
  });
});
