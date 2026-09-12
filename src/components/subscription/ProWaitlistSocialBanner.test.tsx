import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ProWaitlistSocialBanner } from "./ProWaitlistSocialBanner";

// ---- Mocks ----

const mockUseSubscription = vi.fn();
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockUseUserRole = vi.fn();
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));

const mockUseProWaitlist = vi.fn();
vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => mockUseProWaitlist(),
}));

const mockDismiss = vi.fn();
const mockUseProBannerDismiss = vi.fn();
vi.mock("@/hooks/useProBannerDismiss", () => ({
  useProBannerDismiss: (id: string) => mockUseProBannerDismiss(id),
}));

const mockUseWaitlistCount = vi.fn();
vi.mock("@/hooks/useWaitlistCount", () => ({
  useWaitlistCount: () => mockUseWaitlistCount(),
  formatWaitlistCount: (c: number) => {
    if (c < 10) return null;
    const step = c < 100 ? 10 : 25;
    return `${Math.floor(c / step) * step}+`;
  },
}));

function defaults() {
  mockUseSubscription.mockReturnValue({ isPro: false, isLoading: false });
  mockUseUserRole.mockReturnValue({ data: "user", isLoading: false });
  mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
  mockUseProBannerDismiss.mockReturnValue({ isDismissed: false, dismiss: mockDismiss });
  mockUseWaitlistCount.mockReturnValue({ count: 35, isLoading: false });
}

function renderBanner(props?: { showOnboarding?: boolean }) {
  return render(
    <BrowserRouter>
      <ProWaitlistSocialBanner {...props} />
    </BrowserRouter>
  );
}

describe("ProWaitlistSocialBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaults();
  });

  it("renders when count >= 30 and user is Free", () => {
    renderBanner();
    expect(screen.getByText(/PRO arriva presto/)).toBeInTheDocument();
    expect(screen.getByText(/30\+ in lista/)).toBeInTheDocument();
    expect(screen.getByText("Iscriviti")).toBeInTheDocument();
  });

  it("hides when user is Pro", () => {
    mockUseSubscription.mockReturnValue({ isPro: true, isLoading: false });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides when user is admin", () => {
    mockUseUserRole.mockReturnValue({ data: "admin", isLoading: false });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides when already joined", () => {
    mockUseProWaitlist.mockReturnValue({ isJoined: true, isLoading: false });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides when dismissed", () => {
    mockUseProBannerDismiss.mockReturnValue({ isDismissed: true, dismiss: mockDismiss });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides when count < 15 (soglia social proof)", () => {
    mockUseWaitlistCount.mockReturnValue({ count: 12, isLoading: false });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides when showOnboarding is true", () => {
    renderBanner({ showOnboarding: true });
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("dismiss button calls dismiss", () => {
    renderBanner();
    fireEvent.click(screen.getByLabelText("Chiudi banner waitlist"));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it("CTA links to /pro-presto", () => {
    renderBanner();
    const link = screen.getByText("Iscriviti");
    expect(link.closest("a")).toHaveAttribute("href", "/pro-presto");
  });

  it("shows cap-reached variant when count >= 100", () => {
    mockUseWaitlistCount.mockReturnValue({ count: 105, isLoading: false });
    renderBanner();
    expect(screen.getByText(/quasi piena/)).toBeInTheDocument();
    expect(screen.getByText("Iscriviti ora")).toBeInTheDocument();
  });

  it("uses triggerId 'waitlist-social' for dismiss", () => {
    renderBanner();
    expect(mockUseProBannerDismiss).toHaveBeenCalledWith("waitlist-social");
  });

  it("hides when count is null (loading)", () => {
    mockUseWaitlistCount.mockReturnValue({ count: null, isLoading: true });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides while subscription is loading", () => {
    mockUseSubscription.mockReturnValue({ isPro: false, isLoading: true });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides while role is loading", () => {
    mockUseUserRole.mockReturnValue({ data: undefined, isLoading: true });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });

  it("hides while waitlist membership is loading", () => {
    mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: true });
    renderBanner();
    expect(screen.queryByText(/PRO arriva presto/)).not.toBeInTheDocument();
  });
});
