/**
 * Tests for BenchmarkNudgeBanner — Story 46.2
 *
 * Verifies visibility conditions (isPro/isAdmin, incassi >= 3, dismiss),
 * ATECO mapping preview, and generic fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { BenchmarkNudgeBanner } from "./BenchmarkNudgeBanner";

// --- Mock state ---
const mockUser = { id: "user-123" };
let mockIsPro = true;
let mockSubLoading = false;
let mockUserRole: string | null = "user";
let mockRoleLoading = false;
let mockIncomeStats: { count_total: number } | null = { count_total: 5 };
let mockAtecoCode: string | null = "62.01.00"; // software_developer

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: mockIsPro, isLoading: mockSubLoading }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: mockUserRole, isLoading: mockRoleLoading }),
}));

vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({ data: mockIncomeStats }),
}));

vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({ selectedYear: 2026 }),
}));

// Mock supabase — return ateco_code from fiscal_year_settings
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: mockAtecoCode ? { ateco_code: mockAtecoCode } : null,
                error: null,
              }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: {},
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("BenchmarkNudgeBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockIsPro = true;
    mockSubLoading = false;
    mockUserRole = "user";
    mockRoleLoading = false;
    mockIncomeStats = { count_total: 5 };
    mockAtecoCode = "62.01.00";
  });

  it("renders banner when all conditions met (isPro, >=3 incassi)", async () => {
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Scopri se le tue tariffe sono competitive")).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "Confronta" })).toBeDefined();
  });

  it("shows personalized preview when ATECO maps to a jobTitle", async () => {
    mockAtecoCode = "62.01.00"; // → software_developer
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    // Wait for ateco query to resolve and preview to render
    await waitFor(() => {
      const description = screen.getByText(/fatturano in media/);
      expect(description).toBeDefined();
      expect(description.textContent).toMatch(/€\d+\/ora/);
    });
  });

  it("shows generic message when ATECO is not mappable", async () => {
    mockAtecoCode = "43.21.01"; // artigiano — non mappabile
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Scopri se le tue tariffe sono competitive")).toBeDefined();
    });
    expect(screen.getByText(/Confronta quanto fatturi con la mediana/)).toBeDefined();
  });

  it("hides banner when user has fewer than 3 incassi", async () => {
    mockIncomeStats = { count_total: 2 };
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.queryByText("Scopri se le tue tariffe sono competitive")).toBeNull();
    });
  });

  it("hides banner for free (non-admin) users", async () => {
    mockIsPro = false;
    mockUserRole = "user";
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.queryByText("Scopri se le tue tariffe sono competitive")).toBeNull();
    });
  });

  it("shows banner for admin even if not isPro", async () => {
    mockIsPro = false;
    mockUserRole = "admin";
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Scopri se le tue tariffe sono competitive")).toBeDefined();
    });
  });

  it("dismisses permanently on 'Non mi interessa' click", async () => {
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Non mi interessa" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Non mi interessa" }));
    expect(localStorage.getItem("forfettino:benchmark-nudge-dismissed")).toBe("1");
    expect(screen.queryByText("Scopri se le tue tariffe sono competitive")).toBeNull();
  });

  it("stays hidden when already dismissed via localStorage", async () => {
    localStorage.setItem("forfettino:benchmark-nudge-dismissed", "1");
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.queryByText("Scopri se le tue tariffe sono competitive")).toBeNull();
    });
  });

  it("dismisses on X button click", async () => {
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByLabelText("Chiudi banner benchmark")).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText("Chiudi banner benchmark"));
    expect(localStorage.getItem("forfettino:benchmark-nudge-dismissed")).toBe("1");
    expect(screen.queryByText("Scopri se le tue tariffe sono competitive")).toBeNull();
  });

  it("has correct aria-label on region", async () => {
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Confronta le tue tariffe" })).toBeDefined();
    });
  });

  it("Story 81-6 (AC #9) — outer ha squircle-md, NON rounded-lg", async () => {
    render(<BenchmarkNudgeBanner />, { wrapper: createWrapper() });
    const region = await screen.findByRole("region", { name: "Confronta le tue tariffe" });
    expect(region.className).toContain("squircle-md");
    expect(region.className).not.toMatch(/(?:^|\s)rounded-lg(?:\s|$)/);
  });
});
