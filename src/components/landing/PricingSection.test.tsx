/**
 * Test per PricingSection.tsx
 * Verifica che PricingSection wrappa PricingCards correttamente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PricingSection } from "./PricingSection";

// ── Mocks ──

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useLaunchWindow", () => ({
  useLaunchWindow: () => ({
    window: null,
    isOpen: false,
    isLifetimeOpen: false,
    daysRemaining: 0,
    lifetimeDaysRemaining: 0,
    spotsRemaining: 0,
    isLoading: false,
  }),
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

function renderPricing() {
  return render(
    <MemoryRouter>
      <PricingSection />
    </MemoryRouter>,
  );
}

describe("PricingSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section heading", () => {
    renderPricing();
    expect(
      screen.getByRole("heading", {
        name: /Quanto costa Forfettino e cosa include il piano gratuito/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders Free and Pro cards in closed state", () => {
    renderPricing();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("shows €0 price on Free card", () => {
    renderPricing();
    expect(screen.getByText("€0")).toBeInTheDocument();
  });

  it("shows waitlist CTA on Pro card", () => {
    renderPricing();
    expect(screen.getByText("Notificami al lancio")).toBeInTheDocument();
  });
});
