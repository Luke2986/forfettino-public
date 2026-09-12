/**
 * Tests for FirstIncomeBanner — Aha moment after first income
 *
 * Story 27.2: Dashboard aha moment for first-year freelancers.
 * Tests that the banner renders correctly with fiscal data and
 * handles edge cases (zero obligations, no monthly suggestion).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FirstIncomeBanner } from "./FirstIncomeBanner";
import { track } from "@/lib/analytics";

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: {},
}));

// Mock formatCurrency — jsdom doesn't support Intl.NumberFormat("it-IT") fully
vi.mock("@/hooks/useFiscalCalculations", () => ({
  formatCurrency: (v: number) => `€ ${v.toLocaleString("en-US")}`,
}));

const defaultProps = {
  spendable: 5840,
  futureObligations: 3480,
  nextYear: 2027,
  onDismiss: vi.fn(),
};

describe("FirstIncomeBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the banner with test id", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByTestId("first-income-banner")).toBeDefined();
  });

  it("should show the title 'Il tuo primo incasso è registrato!'", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByText("Il tuo primo incasso è registrato!")).toBeDefined();
  });

  it("should display spendable amount", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByText(/5,840/)).toBeDefined();
  });

  it("should display 'Puoi spendere oggi' label", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByText("Puoi spendere oggi")).toBeDefined();
  });

  it("should display future obligations amount", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByText(/3,480/)).toBeDefined();
  });

  it("should display 'Pagherai nel {nextYear}' label", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByText("Pagherai nel 2027")).toBeDefined();
  });

  it("should show educational text about forfettario", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByText(/Nel forfettario le tasse si pagano l'anno dopo/)).toBeDefined();
  });

  it("should call onDismiss when X is clicked", () => {
    const onDismiss = vi.fn();
    render(<FirstIncomeBanner {...defaultProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("aha-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should have an accessible close button", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(screen.getByLabelText("Chiudi banner")).toBeDefined();
  });
});

describe("FirstIncomeBanner — analytics (AC10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should track aha_banner_shown on mount with fiscal data", () => {
    render(<FirstIncomeBanner {...defaultProps} />);
    expect(track).toHaveBeenCalledWith("aha_banner_shown", {
      spendable: 5840,
      futureObligations: 3480,
    });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("should track aha_banner_dismissed on X click", () => {
    render(<FirstIncomeBanner {...defaultProps} onDismiss={vi.fn()} />);
    vi.mocked(track).mockClear();
    fireEvent.click(screen.getByTestId("aha-dismiss"));
    expect(track).toHaveBeenCalledWith("aha_banner_dismissed");
  });

});

describe("FirstIncomeBanner — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should hide obligations card when futureObligations is 0", () => {
    render(
      <FirstIncomeBanner
        {...defaultProps}
        futureObligations={0}
      />
    );
    expect(screen.queryByText("Pagherai nel 2027")).toBeNull();
    expect(screen.getByText("Puoi spendere oggi")).toBeDefined();
  });

  it("should show fallback text when no obligations", () => {
    render(
      <FirstIncomeBanner
        {...defaultProps}
        futureObligations={0}
      />
    );
    expect(screen.getByText(/Continua a registrare i tuoi incassi/)).toBeDefined();
  });

  it("should handle zero spendable gracefully", () => {
    render(<FirstIncomeBanner {...defaultProps} spendable={0} />);
    expect(screen.getByTestId("first-income-banner")).toBeDefined();
    expect(screen.getByText("Puoi spendere oggi")).toBeDefined();
  });

  it("should handle negative spendable without crashing", () => {
    render(<FirstIncomeBanner {...defaultProps} spendable={-500} />);
    expect(screen.getByTestId("first-income-banner")).toBeDefined();
    expect(screen.getByText("Puoi spendere oggi")).toBeDefined();
    // formatCurrency handles negative display
    expect(screen.getByText(/-500/)).toBeDefined();
  });
});
