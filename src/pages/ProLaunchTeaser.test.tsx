import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { createElement, type ReactNode } from "react";

// Mock hooks
vi.mock("@/hooks/useNextLaunchWindow", () => ({
  useNextLaunchWindow: () => ({ startsAt: null, isLoading: false }),
}));

const mockWaitlistCount = vi.fn(() => ({ count: 25, isLoading: false }));
vi.mock("@/hooks/useWaitlistCount", () => ({
  useWaitlistCount: () => mockWaitlistCount(),
  formatWaitlistCount: (c: number) => {
    if (c < 10) return null;
    const step = c < 100 ? 10 : 25;
    return `${Math.floor(c / step) * step}+`;
  },
}));

vi.mock("@/hooks/usePublicUserCount", () => ({
  usePublicUserCount: () => ({ count: 150, isLoading: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => ({
    isJoined: false,
    join: { mutate: vi.fn(), isPending: false },
    data: null,
    isLoading: false,
    wasRevoked: false,
    revoke: {},
    rejoin: {},
  }),
  PRO_WAITLIST_CONSENT_TEXT: "Consenso test",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
}));

vi.mock("@/hooks/useWaitlistReferral", () => ({
  useWaitlistReferral: () => ({
    referralToken: null,
    invitesCount: 0,
    boostLevel: 0,
    nextBoostAt: 3,
    nextBoostLabel: "Priority +1 slot",
    referralUrl: null,
    isLoading: false,
  }),
}));

vi.mock("@/lib/posthog", () => ({
  posthog: { capture: vi.fn() },
  isPosthogReady: false,
}));

import ProLaunchTeaser from "./ProLaunchTeaser";
import { supabase } from "@/integrations/supabase/client";

function createWrapper(initialEntries?: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      HelmetProvider,
      null,
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: initialEntries ?? ["/pro-presto"] }, children),
      ),
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWaitlistCount.mockReturnValue({ count: 25, isLoading: false });
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
});

describe("ProLaunchTeaser", () => {
  it("renders without crash", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText("Forfettino PRO arriva presto")).toBeInTheDocument();
  });

  it("shows feature cards", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
    expect(screen.getByText("Report Clienti")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Tariffe")).toBeInTheDocument();
    expect(screen.getByText("Task Board")).toBeInTheDocument();
    expect(screen.getByText("Budget Allocazione")).toBeInTheDocument();
    expect(screen.getByText("Multi-Anno")).toBeInTheDocument();
  });

  it("shows social proof badge with count", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText(/20\+ persone già in lista/)).toBeInTheDocument();
  });

  it("shows progress bar with 'in lista' label", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText("20+ / 100 in lista")).toBeInTheDocument();
  });

  it("shows trust badge with user count", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText(/150\+ forfettari usano Forfettino/)).toBeInTheDocument();
  });

  it("shows FAQ section", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText("Quando aprirà il lancio?")).toBeInTheDocument();
    expect(screen.getByText("Devo creare un account per iscrivermi?")).toBeInTheDocument();
  });

  it("shows 'Come funziona il lancio' steps", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText(/Iscriviti in waitlist/)).toBeInTheDocument();
    expect(screen.getByText(/Ricevi email 24h prima dell'apertura/)).toBeInTheDocument();
    expect(screen.getByText(/5 giorni per acquistare/)).toBeInTheDocument();
  });

  it("shows animated counter when count >= 50", () => {
    mockWaitlistCount.mockReturnValue({ count: 75, isLoading: false });
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.getByText("persone in lista")).toBeInTheDocument();
  });

  it("hides animated counter when count < 50", () => {
    render(<ProLaunchTeaser />, { wrapper: createWrapper() });
    expect(screen.queryByText("persone in lista")).not.toBeInTheDocument();
  });

  it("renders with ?wl= referral token in URL", () => {
    render(<ProLaunchTeaser />, {
      wrapper: createWrapper(["/pro-presto?wl=testtoken123"]),
    });
    expect(screen.getByText("Forfettino PRO arriva presto")).toBeInTheDocument();
  });

  it("passes ?wl= referral token to WaitlistCaptureForm RPC on submit", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    render(<ProLaunchTeaser />, {
      wrapper: createWrapper(["/pro-presto?wl=referralABC123"]),
    });

    const emailInput = screen.getByPlaceholderText("La tua email");
    fireEvent.change(emailInput, { target: { value: "nuovo@example.com" } });
    fireEvent.click(screen.getByRole("checkbox"));
    // Submit the form directly (avoid ambiguity with hero CTA button)
    fireEvent.submit(emailInput.closest("form")!);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "join_waitlist_lead",
        expect.objectContaining({
          p_referred_by_token: "referralABC123",
        })
      );
    });
  });
});
