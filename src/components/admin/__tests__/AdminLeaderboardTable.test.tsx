/**
 * Test per AdminLeaderboardTable
 * Story 41.1 — Admin: Breakdown azioni per utente nella leaderboard
 *
 * Copertura:
 * - Render tabella con entries
 * - Click su riga espande pannello breakdown
 * - Click di nuovo chiude il pannello
 * - Pannello mostra badge con label e punti
 * - Chevron down/up cambia stato
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock supabase
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { AdminLeaderboardTable } from "../AdminLeaderboardTable";
import type { AdminLeaderboardEntry } from "@/hooks/useAdminLeaderboard";

const mockEntries: AdminLeaderboardEntry[] = [
  { rank: 1, userId: "uid-1", userCode: "AB123CD45", firstName: "Mario", totalPts: 95 },
  { rank: 2, userId: "uid-2", userCode: "EF678GH90", firstName: "Luigi", totalPts: 60 },
];

const mockActionConfigs = [
  {
    action_type: "feedback_submitted",
    points: 15,
    label: "Feedback inviato",
    frequency_label: "max 1/7 days",
    color_bg: "bg-blue-500",
    color_text: "text-blue-700",
    display_order: 1,
  },
  {
    action_type: "referral_signup",
    points: 30,
    label: "Invita un amico",
    frequency_label: "max 10/mese",
    color_bg: "bg-green-500",
    color_text: "text-green-700",
    display_order: 2,
  },
];

const mockBreakdownData = [
  { action_type: "feedback_submitted", total_points: 45, action_count: 3 },
  { action_type: "referral_signup", total_points: 30, action_count: 1 },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("AdminLeaderboardTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_action_config") {
        return Promise.resolve({ data: mockActionConfigs, error: null });
      }
      if (fnName === "get_admin_user_contribution_breakdown") {
        return Promise.resolve({ data: mockBreakdownData, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("renderizza la tabella con le entries", () => {
    render(<AdminLeaderboardTable entries={mockEntries} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("AB123CD45")).toBeTruthy();
    expect(screen.getByText("Mario")).toBeTruthy();
    expect(screen.getByText("95 pt")).toBeTruthy();
    expect(screen.getByText("Luigi")).toBeTruthy();
  });

  it("click su riga espande il pannello breakdown", async () => {
    render(<AdminLeaderboardTable entries={mockEntries} />, {
      wrapper: createWrapper(),
    });

    const row = screen.getByTestId("leaderboard-row-AB123CD45");
    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByText(/Feedback inviato/)).toBeTruthy();
    });

    expect(screen.getByText(/45 pt/)).toBeTruthy();
  });

  it("click di nuovo chiude il pannello", async () => {
    render(<AdminLeaderboardTable entries={mockEntries} />, {
      wrapper: createWrapper(),
    });

    const row = screen.getByTestId("leaderboard-row-AB123CD45");

    // Expand
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByText(/Feedback inviato/)).toBeTruthy();
    });

    // Collapse
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.queryByText(/Feedback inviato/)).toBeNull();
    });
  });

  it("mostra messaggio per utente senza azioni", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_action_config") {
        return Promise.resolve({ data: mockActionConfigs, error: null });
      }
      if (fnName === "get_admin_user_contribution_breakdown") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<AdminLeaderboardTable entries={mockEntries} />, {
      wrapper: createWrapper(),
    });

    const row = screen.getByTestId("leaderboard-row-AB123CD45");
    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByText("Nessuna azione registrata")).toBeTruthy();
    });
  });
});
