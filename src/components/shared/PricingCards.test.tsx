import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PricingCards } from "./PricingCards";

// ── Mocks ──

const mockUseAuth = vi.fn(() => ({ user: { id: "u1" } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseLaunchWindow = vi.fn();
vi.mock("@/hooks/useLaunchWindow", () => ({
  useLaunchWindow: () => mockUseLaunchWindow(),
}));

vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => ({
    isJoined: false,
    wasRevoked: false,
    rejoin: { mutate: vi.fn(), isPending: false },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useWaitlistCount", () => ({
  useWaitlistCount: () => ({ count: 50 }),
  formatWaitlistCount: (n: number) => `${n}+`,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/subscription/ProWaitlistConsentDialog", () => ({
  ProWaitlistConsentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="waitlist-dialog">Dialog</div> : null,
}));

// ── Helpers ──

const MOCK_WINDOW = {
  id: "w1",
  name: "Launch 1",
  starts_at: "2026-01-01T00:00:00Z",
  ends_at: "2026-01-06T00:00:00Z",
  lifetime_ends_at: "2026-01-04T00:00:00Z",
  cap_total: 100,
  cap_remaining: 80,
  prices: { six_month: 4900, annual: 6900, lifetime: 16900 },
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function closedWindow() {
  return {
    window: null,
    isOpen: false,
    isLifetimeOpen: false,
    daysRemaining: 0,
    lifetimeDaysRemaining: 0,
    spotsRemaining: 0,
    isLoading: false,
  };
}

function openFullWindow(spots = 80) {
  return {
    window: MOCK_WINDOW,
    isOpen: true,
    isLifetimeOpen: true,
    daysRemaining: 5,
    lifetimeDaysRemaining: 3,
    spotsRemaining: spots,
    isLoading: false,
  };
}

function openLifetimeClosedWindow(spots = 60) {
  return {
    window: MOCK_WINDOW,
    isOpen: true,
    isLifetimeOpen: false,
    daysRemaining: 2,
    lifetimeDaysRemaining: 0,
    spotsRemaining: spots,
    isLoading: false,
  };
}

function soldOutWindow() {
  return {
    window: MOCK_WINDOW,
    isOpen: true,
    isLifetimeOpen: true,
    daysRemaining: 3,
    lifetimeDaysRemaining: 2,
    spotsRemaining: 0,
    isLoading: false,
  };
}

function renderPricing(variant: "landing" | "settings" = "landing") {
  return render(
    <MemoryRouter>
      <PricingCards variant={variant} />
    </MemoryRouter>,
  );
}

// ── Tests ──

describe("PricingCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC #1, #15 — 8.1: stato closed (2 card)
  describe("stato closed (2 card)", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue(closedWindow());
    });

    it("renderizza solo 2 card (Free e Pro)", () => {
      renderPricing();
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.queryByText("Semestrale")).not.toBeInTheDocument();
      expect(screen.queryByText("Annuale")).not.toBeInTheDocument();
      expect(screen.queryByText("Lifetime")).not.toBeInTheDocument();
    });

    it("non mostra prezzi Pro", () => {
      renderPricing();
      expect(screen.getByText("Prezzo rivelato al lancio")).toBeInTheDocument();
      expect(screen.queryByText(/€49/)).not.toBeInTheDocument();
      expect(screen.queryByText(/€69/)).not.toBeInTheDocument();
    });

    it("CTA waitlist presente per Pro", () => {
      renderPricing();
      expect(screen.getByText("Notificami al lancio")).toBeInTheDocument();
    });

    it("nessuna garanzia o testimonial visibili", () => {
      renderPricing();
      expect(screen.queryByTestId("guarantee-section")).not.toBeInTheDocument();
      expect(screen.queryByTestId("testimonial-section")).not.toBeInTheDocument();
    });
  });

  // AC #2, #15 — 8.2: stato open_full (4 card)
  describe("stato open_full (4 card)", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue(openFullWindow());
    });

    it("renderizza 4 card con i nomi corretti", () => {
      renderPricing();
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Semestrale")).toBeInTheDocument();
      expect(screen.getByText("Annuale")).toBeInTheDocument();
      expect(screen.getByText("Lifetime")).toBeInTheDocument();
    });

    it("prezzi visibili e formattati", () => {
      renderPricing();
      expect(screen.getByText("€49")).toBeInTheDocument();
      expect(screen.getByText("€69")).toBeInTheDocument();
      expect(screen.getByText("€169")).toBeInTheDocument();
    });

    it("badge Consigliato su card 12 mesi", () => {
      renderPricing();
      expect(screen.getByText("Consigliato")).toBeInTheDocument();
    });

    it("badge posti rimasti visibile", () => {
      renderPricing();
      // 80 spots > 30, so teal neutral badge
      const badges = screen.getAllByText("80 posti rimasti");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("garanzia visibile", () => {
      renderPricing();
      expect(screen.getByTestId("guarantee-section")).toBeInTheDocument();
      expect(screen.getByText(/Garanzia 14 giorni/)).toBeInTheDocument();
    });

    it("testimonial visibili", () => {
      renderPricing();
      expect(screen.getByTestId("testimonial-section")).toBeInTheDocument();
    });

    it("CTA Acquista presente sulle card paid", () => {
      renderPricing();
      const buyButtons = screen.getAllByText("Acquista");
      expect(buyButtons).toHaveLength(3); // six_month, annual, lifetime
    });
  });

  // AC #3, #15 — 8.3: stato open_lifetime_closed (3+1 card)
  describe("stato open_lifetime_closed (3+1 card)", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue(openLifetimeClosedWindow());
    });

    it("renderizza 4 card inclusa Lifetime", () => {
      renderPricing();
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Semestrale")).toBeInTheDocument();
      expect(screen.getByText("Annuale")).toBeInTheDocument();
      expect(screen.getByText("Lifetime")).toBeInTheDocument();
    });

    it("Lifetime ha overlay Chiuso", () => {
      renderPricing();
      expect(screen.getByText("Chiuso")).toBeInTheDocument();
    });

    it("tutte 3 le card paid hanno CTA Acquista (Lifetime disabilitata visualmente)", () => {
      renderPricing();
      const buyButtons = screen.getAllByText("Acquista");
      expect(buyButtons).toHaveLength(3);
    });
  });

  // AC #5, #15 — 8.4: stato sold_out
  describe("stato sold_out", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue(soldOutWindow());
    });

    it("fallback a 2 card", () => {
      renderPricing();
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Posti esauriti")).toBeInTheDocument();
      expect(screen.queryByText("Semestrale")).not.toBeInTheDocument();
      expect(screen.queryByText("Annuale")).not.toBeInTheDocument();
    });

    it("CTA waitlist presente", () => {
      renderPricing();
      expect(screen.getByText("Iscriviti alla waitlist")).toBeInTheDocument();
    });
  });

  // AC #6 — 8.5: urgency badge
  describe("urgency badge", () => {
    it("spots=50 mostra badge teal neutro", () => {
      mockUseLaunchWindow.mockReturnValue(openFullWindow(50));
      renderPricing();
      const badges = screen.getAllByText("50 posti rimasti");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("spots=25 mostra badge ambra", () => {
      mockUseLaunchWindow.mockReturnValue(openFullWindow(25));
      renderPricing();
      const badges = screen.getAllByText("25 posti rimasti");
      expect(badges.length).toBeGreaterThan(0);
      // Badge should have amber classes
      expect(badges[0].className).toMatch(/amber/);
    });

    it("spots=5 mostra badge rosso ULTIMI", () => {
      mockUseLaunchWindow.mockReturnValue(openFullWindow(5));
      renderPricing();
      const badges = screen.getAllByText("ULTIMI 5 POSTI");
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].className).toMatch(/red/);
    });
  });

  // Loading state — no flash of 4 cards
  it("durante loading mostra 2 card default", () => {
    mockUseLaunchWindow.mockReturnValue({
      ...openFullWindow(),
      isLoading: true,
    });
    renderPricing();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.queryByText("Semestrale")).not.toBeInTheDocument();
  });

  // M1 — variant="settings" con launch window aperta
  describe("variant=settings con launch window aperta", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue(openFullWindow());
    });

    it("renderizza 4 card con i nomi corretti", () => {
      renderPricing("settings");
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Semestrale")).toBeInTheDocument();
      expect(screen.getByText("Annuale")).toBeInTheDocument();
      expect(screen.getByText("Lifetime")).toBeInTheDocument();
    });

    it("card Free mostra 'Piano attuale' (SettingsCTA)", () => {
      renderPricing("settings");
      const matches = screen.getAllByText("Piano attuale");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("card paid mostrano CTA Acquista (LaunchCTA)", () => {
      renderPricing("settings");
      const buyButtons = screen.getAllByText("Acquista");
      expect(buyButtons).toHaveLength(3);
    });

    it("garanzia e testimonial visibili", () => {
      renderPricing("settings");
      expect(screen.getByTestId("guarantee-section")).toBeInTheDocument();
      expect(screen.getByTestId("testimonial-section")).toBeInTheDocument();
    });
  });
});
