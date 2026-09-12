import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockReferralData = {
  referralToken: "abc123def456",
  invitesCount: 2,
  boostLevel: 0,
  nextBoostAt: 3 as number | null,
  nextBoostLabel: "Priority +1 slot" as string | null,
  referralUrl: "https://forfettino.it/pro-presto?wl=abc123def456",
  isLoading: false,
};

vi.mock("@/hooks/useWaitlistReferral", () => ({
  useWaitlistReferral: () => mockReferralData,
}));

vi.mock("@/lib/posthog", () => ({
  posthog: { capture: vi.fn() },
  isPosthogReady: true,
}));

import { WaitlistReferralPanel } from "./WaitlistReferralPanel";
import { posthog } from "@/lib/posthog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("WaitlistReferralPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mockReferralData.referralToken = "abc123def456";
    mockReferralData.invitesCount = 2;
    mockReferralData.boostLevel = 0;
    mockReferralData.nextBoostAt = 3;
    mockReferralData.nextBoostLabel = "Priority +1 slot";
    mockReferralData.referralUrl = "https://forfettino.it/pro-presto?wl=abc123def456";
    mockReferralData.isLoading = false;
  });

  it("renders referral link and copy button", () => {
    render(<WaitlistReferralPanel />, { wrapper });
    expect(screen.getByDisplayValue(/pro-presto\?wl=abc123def456/)).toBeInTheDocument();
    expect(screen.getByLabelText("Copia link referral")).toBeInTheDocument();
  });

  it("shows invite count", () => {
    render(<WaitlistReferralPanel />, { wrapper });
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("amici iscritti")).toBeInTheDocument();
  });

  it("shows progress bar toward next boost", () => {
    render(<WaitlistReferralPanel />, { wrapper });
    expect(screen.getByText("2/3 per Priority +1 slot")).toBeInTheDocument();
  });

  it("shows share buttons", () => {
    render(<WaitlistReferralPanel />, { wrapper });
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
  });

  it("tracks copy event on click", async () => {
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<WaitlistReferralPanel />, { wrapper });
    fireEvent.click(screen.getByLabelText("Copia link referral"));

    await waitFor(() => {
      expect((posthog.capture as any)).toHaveBeenCalledWith("pro_referral_link_copied", undefined);
    });
  });

  it("tracks share event on share button click", () => {
    render(<WaitlistReferralPanel />, { wrapper });
    fireEvent.click(screen.getByText("WhatsApp"));
    expect((posthog.capture as any)).toHaveBeenCalledWith("pro_referral_shared", {
      channel: "whatsapp",
    });
  });

  it("shows lifetime badge when invites >= 10", () => {
    mockReferralData.invitesCount = 12;
    mockReferralData.boostLevel = 3;
    mockReferralData.nextBoostAt = null;
    mockReferralData.nextBoostLabel = null;

    render(<WaitlistReferralPanel />, { wrapper });
    expect(screen.getByText("Lifetime tier garantito")).toBeInTheDocument();
  });

  it("renders nothing when loading", () => {
    mockReferralData.isLoading = true;
    mockReferralData.referralUrl = null as any;

    const { container } = render(<WaitlistReferralPanel />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no referral URL", () => {
    mockReferralData.referralUrl = null as any;

    const { container } = render(<WaitlistReferralPanel />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("shows singular 'amico iscritto' for count 1", () => {
    mockReferralData.invitesCount = 1;

    render(<WaitlistReferralPanel />, { wrapper });
    expect(screen.getByText("amico iscritto")).toBeInTheDocument();
  });
});
