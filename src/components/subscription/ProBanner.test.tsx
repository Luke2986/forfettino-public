import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ProBanner } from "./ProBanner";

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
  PRO_WAITLIST_CONSENT_TEXT: "mock consent",
}));

const mockUseLaunchWindow = vi.fn();
vi.mock("@/hooks/useLaunchWindow", () => ({
  useLaunchWindow: () => mockUseLaunchWindow(),
}));

const mockDismiss = vi.fn();
const mockUseProBannerDismiss = vi.fn();
vi.mock("@/hooks/useProBannerDismiss", () => ({
  useProBannerDismiss: (id: string) => mockUseProBannerDismiss(id),
}));

// Mock ProWaitlistConsentDialog to avoid deep dependency tree
vi.mock("@/components/subscription/ProWaitlistConsentDialog", () => ({
  ProWaitlistConsentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="waitlist-dialog">Dialog open</div> : null,
}));

function renderBanner(props?: Partial<React.ComponentProps<typeof ProBanner>>) {
  return render(
    <BrowserRouter>
      <ProBanner
        triggerId="test"
        title="Prova PRO"
        description="Descrizione test"
        {...props}
      />
    </BrowserRouter>
  );
}

describe("ProBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSubscription.mockReturnValue({ isPro: false });
    mockUseUserRole.mockReturnValue({ data: "user" });
    mockUseProWaitlist.mockReturnValue({ isJoined: false });
    mockUseLaunchWindow.mockReturnValue({ isOpen: false });
    mockUseProBannerDismiss.mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });
  });

  // AC #1: render default con titolo, descrizione, CTA, icona
  it("renders banner with title, description, CTA and Sparkles icon", () => {
    renderBanner();
    expect(screen.getByText("Prova PRO")).toBeInTheDocument();
    expect(screen.getByText("Descrizione test")).toBeInTheDocument();
    expect(screen.getByText("Scopri PRO")).toBeInTheDocument();
  });

  // AC #4: isPro=true → non renderizza
  it("returns null when isPro is true", () => {
    mockUseSubscription.mockReturnValue({ isPro: true });
    const { container } = renderBanner();
    expect(container.innerHTML).toBe("");
  });

  // AC #4: isAdmin=true → non renderizza
  it("returns null when user is admin", () => {
    mockUseUserRole.mockReturnValue({ data: "admin" });
    const { container } = renderBanner();
    expect(container.innerHTML).toBe("");
  });

  // AC #5: dismiss X → banner sparisce
  it("calls dismiss when X button is clicked", () => {
    renderBanner();
    const dismissBtn = screen.getByRole("button", { name: /chiudi/i });
    fireEvent.click(dismissBtn);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // AC #5: dismiss persistente
  it("does not render when isDismissed is true", () => {
    mockUseProBannerDismiss.mockReturnValue({
      isDismissed: true,
      dismiss: mockDismiss,
    });
    const { container } = renderBanner();
    expect(container.innerHTML).toBe("");
  });

  // AC #2: click CTA apre ProWaitlistConsentDialog
  it("opens ProWaitlistConsentDialog when CTA is clicked (not joined)", () => {
    renderBanner();
    expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Scopri PRO"));
    expect(screen.getByTestId("waitlist-dialog")).toBeInTheDocument();
  });

  // AC #3: isJoined → variante soft
  it("shows soft variant when user is already joined", () => {
    mockUseProWaitlist.mockReturnValue({ isJoined: true });
    renderBanner();
    expect(
      screen.getByText(/Sei in lista per PRO/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Vedi i dettagli/i)).toBeInTheDocument();
    expect(screen.queryByText("Scopri PRO")).not.toBeInTheDocument();
    // No dismiss X in joined variant
    expect(
      screen.queryByRole("button", { name: /chiudi/i })
    ).not.toBeInTheDocument();
  });

  // AC #3: link naviga a impostazioni
  it("joined variant links to /impostazioni?tab=abbonamento", () => {
    mockUseProWaitlist.mockReturnValue({ isJoined: true });
    renderBanner();
    const link = screen.getByText("Vedi i dettagli");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/impostazioni?tab=abbonamento"
    );
  });

  // AC #6: hook receives correct triggerId
  it("passes triggerId to useProBannerDismiss", () => {
    renderBanner({ triggerId: "custom-id" });
    expect(mockUseProBannerDismiss).toHaveBeenCalledWith("custom-id");
  });

  // onCtaClick override
  it("calls onCtaClick instead of opening dialog when provided", () => {
    const onCta = vi.fn();
    renderBanner({ onCtaClick: onCta });
    fireEvent.click(screen.getByText("Scopri PRO"));
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();
  });

  // AC #14 — 8.7: Launch window contestuale
  describe("launch window aperta", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue({ isOpen: true });
    });

    it("mostra 'Vedi i piani PRO' con link a /pricing", () => {
      renderBanner();
      const link = screen.getByText("Vedi i piani PRO");
      expect(link.closest("a")).toHaveAttribute("href", "/pricing");
    });

    it("non mostra 'Scopri PRO' (waitlist CTA)", () => {
      renderBanner();
      expect(screen.queryByText("Scopri PRO")).not.toBeInTheDocument();
    });

    it("non renderizza ProWaitlistConsentDialog", () => {
      renderBanner();
      expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();
    });

    it("isJoined=true mostra comunque 'Vedi i piani PRO' (non la variante soft)", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: true });
      renderBanner();
      expect(screen.getByText("Vedi i piani PRO")).toBeInTheDocument();
      expect(screen.queryByText(/Sei in lista per PRO/)).not.toBeInTheDocument();
    });
  });
});
