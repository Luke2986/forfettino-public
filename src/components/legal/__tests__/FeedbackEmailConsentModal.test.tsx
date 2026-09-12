/**
 * Test per FeedbackEmailConsentModal (Story 14.6)
 *
 * Copertura:
 * - Modal appare quando needsEmailConsent è true (dopo il delay)
 * - Modal NON appare quando needsEmailConsent è false
 * - Modal NON appare prima che il delay sia trascorso
 * - Click "Sì, contattami" salva consent=true con timestamp
 * - Click "No, grazie" salva consent=false con timestamp
 * - Chiusura X non salva nulla (modal riappare)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

let mockNeedsEmailConsent = true;
const mockMutate = vi.fn();

vi.mock("@/hooks/useFeedbackEmailConsent", () => ({
  useFeedbackEmailConsent: () => ({
    needsEmailConsent: mockNeedsEmailConsent,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useUpdateProfile: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { FeedbackEmailConsentModal } from "../FeedbackEmailConsentModal";

describe("FeedbackEmailConsentModal (Story 14.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNeedsEmailConsent = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Render with delayMs=0 for tests that don't care about the delay */
  function renderImmediate() {
    render(<FeedbackEmailConsentModal delayMs={0} />);
    act(() => { vi.advanceTimersByTime(0); });
  }

  it("does NOT render before delay has elapsed", () => {
    render(<FeedbackEmailConsentModal delayMs={30_000} />);
    expect(screen.queryByText("Vuoi ricevere email da noi?")).not.toBeInTheDocument();
  });

  it("renders modal after delay when needsEmailConsent is true", () => {
    render(<FeedbackEmailConsentModal delayMs={30_000} />);
    act(() => { vi.advanceTimersByTime(30_000); });

    expect(screen.getByText("Vuoi ricevere email da noi?")).toBeInTheDocument();
    expect(screen.getByText(/Occasionalmente inviamo sondaggi/)).toBeInTheDocument();
    expect(screen.getByText("Sì, contattami")).toBeInTheDocument();
    expect(screen.getByText("No, grazie")).toBeInTheDocument();
  });

  it("does NOT render when needsEmailConsent is false", () => {
    mockNeedsEmailConsent = false;
    const { container } = render(<FeedbackEmailConsentModal delayMs={0} />);
    act(() => { vi.advanceTimersByTime(0); });
    expect(container.innerHTML).toBe("");
  });

  it("saves consent=true with timestamp on 'Sì, contattami' click", () => {
    renderImmediate();

    fireEvent.click(screen.getByText("Sì, contattami"));

    expect(mockMutate).toHaveBeenCalledOnce();
    const args = mockMutate.mock.calls[0][0];
    expect(args.feedback_email_consent).toBe(true);
    expect(args.feedback_email_consent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("saves consent=false with timestamp on 'No, grazie' click", () => {
    renderImmediate();

    fireEvent.click(screen.getByText("No, grazie"));

    expect(mockMutate).toHaveBeenCalledOnce();
    const args = mockMutate.mock.calls[0][0];
    expect(args.feedback_email_consent).toBe(false);
    expect(args.feedback_email_consent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("renders close button (X) for dismissal without saving", () => {
    renderImmediate();

    // DialogContent includes a built-in close button with sr-only "Chiudi" text
    const closeButton = screen.getByRole("button", { name: /chiudi/i });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    // No mutation should be called on dismiss
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("renders Mail icon in blue circle", () => {
    renderImmediate();

    const iconContainer = screen.getByText("Vuoi ricevere email da noi?")
      .closest("div")
      ?.querySelector(".bg-blue-50");
    expect(iconContainer).toBeInTheDocument();
  });
});
