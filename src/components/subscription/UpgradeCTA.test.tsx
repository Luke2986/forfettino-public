import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeCTA } from "./UpgradeCTA";
import { MemoryRouter } from "react-router-dom";

const mockUseProWaitlist = vi.fn();
vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => mockUseProWaitlist(),
}));

const mockUseLaunchWindow = vi.fn();
vi.mock("@/hooks/useLaunchWindow", () => ({
  useLaunchWindow: () => mockUseLaunchWindow(),
}));
vi.mock("@/components/subscription/ProWaitlistConsentDialog", () => ({
  ProWaitlistConsentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="waitlist-dialog">Dialog</div> : null,
}));

function renderCTA(props: { feature: string; variant?: "inline" | "banner" }) {
  return render(
    <MemoryRouter>
      <UpgradeCTA {...props} />
    </MemoryRouter>
  );
}

describe("UpgradeCTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLaunchWindow.mockReturnValue({ isOpen: false });
  });

  describe("variant='banner'", () => {
    it("Loading: mostra feature senza CTA né stato waitlist", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: true });
      renderCTA({ feature: "Navigazione Multi-anno", variant: "banner" });

      expect(screen.getByText("Navigazione Multi-anno")).toBeInTheDocument();
      expect(screen.queryByText("Scopri PRO")).not.toBeInTheDocument();
      expect(screen.queryByText("Sei in lista per PRO")).not.toBeInTheDocument();
    });

    it("Free non in waitlist: mostra CTA Scopri PRO, click apre dialog", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
      renderCTA({ feature: "Navigazione Multi-anno", variant: "banner" });

      expect(screen.getByText("Navigazione Multi-anno")).toBeInTheDocument();
      expect(screen.getByText("Scopri PRO")).toBeInTheDocument();
      expect(screen.getByText("Disponibile con PRO")).toBeInTheDocument();

      // Dialog non visibile prima del click
      expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();

      // Click apre dialog
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByTestId("waitlist-dialog")).toBeInTheDocument();
    });

    it("Free in waitlist: mostra stato success, nessuna CTA", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: true, isLoading: false });
      renderCTA({ feature: "Navigazione Multi-anno", variant: "banner" });

      expect(screen.getByText("Navigazione Multi-anno")).toBeInTheDocument();
      expect(screen.getByText("Sei in lista per PRO")).toBeInTheDocument();
      expect(screen.queryByText("Scopri PRO")).not.toBeInTheDocument();
    });

    it("Keyboard a11y: Enter apre dialog", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
      renderCTA({ feature: "Test Feature", variant: "banner" });

      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: "Enter" });
      expect(screen.getByTestId("waitlist-dialog")).toBeInTheDocument();
    });

    it("Keyboard a11y: Space apre dialog", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
      renderCTA({ feature: "Test Feature", variant: "banner" });

      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: " " });
      expect(screen.getByTestId("waitlist-dialog")).toBeInTheDocument();
    });
  });

  describe("variant='inline'", () => {
    it("Loading: mostra feature + (PRO) con lock, nessun dialog", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: true });
      renderCTA({ feature: "Sblocca ranking", variant: "inline" });

      expect(screen.getByText(/Sblocca ranking/)).toBeInTheDocument();
      expect(screen.getByText(/\(PRO\)/)).toBeInTheDocument();
      expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();
    });

    it("Free non in waitlist: click apre dialog", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
      renderCTA({ feature: "Sblocca ranking", variant: "inline" });

      expect(screen.getByText(/Sblocca ranking/)).toBeInTheDocument();
      expect(screen.getByText(/\(PRO\)/)).toBeInTheDocument();

      // Click apre dialog
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByTestId("waitlist-dialog")).toBeInTheDocument();
    });

    it("Free non in waitlist: usa <button> nativo (keyboard a11y garantita)", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
      renderCTA({ feature: "Sblocca ranking", variant: "inline" });

      const button = screen.getByRole("button");
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
    });

    it("Free in waitlist: mostra stato teal, nessun dialog on click", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: true, isLoading: false });
      renderCTA({ feature: "Sblocca ranking", variant: "inline" });

      const el = screen.getByText(/Sblocca ranking/);
      expect(el).toBeInTheDocument();
      expect(el.closest("span")).toHaveClass("text-teal-600");
      // Non è un button, nessun dialog
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();
    });
  });

  describe("default variant", () => {
    it("senza variant prop usa inline come default", () => {
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
      renderCTA({ feature: "Test default" });

      // Inline: ha button, non ha "Scopri PRO"
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.queryByText("Scopri PRO")).not.toBeInTheDocument();
    });
  });

  // AC #14 — 8.6: Launch window contestuale
  describe("launch window aperta", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue({ isOpen: true });
      mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
    });

    it("banner: mostra 'Passa a PRO' con link a /pricing", () => {
      renderCTA({ feature: "Navigazione Multi-anno", variant: "banner" });
      const link = screen.getByText("Passa a PRO");
      expect(link.closest("a")).toHaveAttribute("href", "/pricing");
    });

    it("inline: mostra link a /pricing", () => {
      renderCTA({ feature: "Navigazione Multi-anno" });
      const link = screen.getByText(/Passa a PRO/);
      expect(link.closest("a")).toHaveAttribute("href", "/pricing");
    });

    it("banner: nessun dialog waitlist visibile", () => {
      renderCTA({ feature: "Test", variant: "banner" });
      expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("Scopri PRO")).not.toBeInTheDocument();
    });
  });
});
