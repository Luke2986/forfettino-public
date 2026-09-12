import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { PrivacyConsentModal } from "./PrivacyConsentModal";

// Mock usePrivacyConsent
const mockAcceptConsent = vi.fn();
let mockNeedsConsent = true;
let mockIsFirstTime = true;
let mockIsPending = false;

vi.mock("@/hooks/usePrivacyConsent", () => ({
  usePrivacyConsent: () => ({
    needsConsent: mockNeedsConsent,
    isFirstTime: mockIsFirstTime,
    acceptConsent: mockAcceptConsent,
    isLoading: false,
    isPending: mockIsPending,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function renderModal() {
  const Wrapper = createWrapper();
  return render(createElement(Wrapper, null, createElement(PrivacyConsentModal)));
}

describe("PrivacyConsentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedsConsent = true;
    mockIsFirstTime = true;
    mockIsPending = false;
  });

  it("renders when needsConsent is true", () => {
    renderModal();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/Privacy Policy e Termini di Servizio/i)).toBeInTheDocument();
  });

  it("does NOT render when needsConsent is false", () => {
    mockNeedsConsent = false;
    renderModal();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows 'Benvenuto' text for isFirstTime=true", () => {
    mockIsFirstTime = true;
    renderModal();
    expect(screen.getByText(/Benvenuto/i)).toBeInTheDocument();
  });

  it("shows 'aggiornato' text for isFirstTime=false", () => {
    mockIsFirstTime = false;
    renderModal();
    expect(screen.getByText(/aggiornato/i)).toBeInTheDocument();
  });

  it("has checkbox unchecked → button disabled", () => {
    renderModal();
    const button = screen.getByRole("button", { name: /Accetta e continua/i });
    expect(button).toBeDisabled();
  });

  it("checkbox checked → button enabled", () => {
    renderModal();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const button = screen.getByRole("button", { name: /Accetta e continua/i });
    expect(button).toBeEnabled();
  });

  it("clicking accept button calls acceptConsent", () => {
    renderModal();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const button = screen.getByRole("button", { name: /Accetta e continua/i });
    fireEvent.click(button);
    expect(mockAcceptConsent).toHaveBeenCalledTimes(1);
  });

  it("has links to privacy policy and terms of service", () => {
    renderModal();
    const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
    const tosLink = screen.getByRole("link", { name: /Termini di Servizio/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy-policy");
    expect(privacyLink).toHaveAttribute("target", "_blank");
    expect(tosLink).toHaveAttribute("href", "/terms");
    expect(tosLink).toHaveAttribute("target", "_blank");
  });

  it("has correct aria attributes", () => {
    renderModal();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Accettazione Privacy Policy e Termini di Servizio");
  });

  it("escape key does NOT close the modal", () => {
    renderModal();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    // Modal should still be present
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("button is disabled when isPending", () => {
    mockIsPending = true;
    renderModal();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const button = screen.getByRole("button", { name: /Salvataggio/i });
    expect(button).toBeDisabled();
  });
});
