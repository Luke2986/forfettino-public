import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProGateOverlay } from "./ProGateOverlay";

// --- Mocks ---

const mockUseSubscription = vi.fn(() => ({
  isPro: false,
  isLoading: false,
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockUseUserRole = vi.fn(() => ({
  data: "user" as string | null,
  isLoading: false,
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));

const mockUseProWaitlist = vi.fn(() => ({
  isJoined: false,
  isLoading: false,
}));
vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => mockUseProWaitlist(),
}));

const mockUseLaunchWindow = vi.fn(() => ({ isOpen: false }));
vi.mock("@/hooks/useLaunchWindow", () => ({
  useLaunchWindow: () => mockUseLaunchWindow(),
}));

vi.mock("@/components/subscription/ProWaitlistConsentDialog", () => ({
  ProWaitlistConsentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="waitlist-dialog">Dialog</div> : null,
}));

// --- Helpers ---

function renderOverlay() {
  return render(
    <MemoryRouter>
      <ProGateOverlay
        featureName="Task Board"
        featureDescription="Organizza il tuo lavoro con la board personale."
      >
        <div data-testid="child-content">Contenuto protetto</div>
      </ProGateOverlay>
    </MemoryRouter>
  );
}

// --- Tests ---

describe("ProGateOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSubscription.mockReturnValue({ isPro: false, isLoading: false });
    mockUseUserRole.mockReturnValue({ data: "user", isLoading: false });
    mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false });
    mockUseLaunchWindow.mockReturnValue({ isOpen: false });
  });

  // 2.2: utente Free → overlay visibile, children blurrati, CTA presente
  it("mostra overlay con CTA per utente Free", () => {
    renderOverlay();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Task Board")).toBeInTheDocument();
    expect(
      screen.getByText("Organizza il tuo lavoro con la board personale.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Scopri PRO" })
    ).toBeInTheDocument();
  });

  // 2.3: utente Free con isJoined → variante success
  it("mostra variante joined per utente in waitlist", () => {
    mockUseProWaitlist.mockReturnValue({ isJoined: true, isLoading: false });

    renderOverlay();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/Sei in lista — ti avviseremo/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Scopri PRO" })
    ).not.toBeInTheDocument();
  });

  // 2.4: utente isPro → children normali, nessun overlay
  it("renderizza solo children per utente Pro", () => {
    mockUseSubscription.mockReturnValue({ isPro: true, isLoading: false });

    renderOverlay();

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 2.5: utente isAdmin → children normali, nessun overlay
  it("renderizza solo children per utente Admin", () => {
    mockUseUserRole.mockReturnValue({ data: "admin", isLoading: false });

    renderOverlay();

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 2.6: click CTA apre ProWaitlistConsentDialog
  it("apre ProWaitlistConsentDialog al click su CTA", () => {
    renderOverlay();

    expect(screen.queryByTestId("waitlist-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Scopri PRO" }));

    expect(screen.getByTestId("waitlist-dialog")).toBeInTheDocument();
  });

  // 2.7: link "Vedi cosa include PRO"
  it('mostra link "Vedi cosa include PRO" con href corretto', () => {
    renderOverlay();

    const link = screen.getByText("Vedi cosa include PRO");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/impostazioni?tab=abbonamento"
    );
  });

  // 2.8: featureName e featureDescription renderizzati
  it("renderizza featureName e featureDescription", () => {
    renderOverlay();

    expect(screen.getByText("Task Board")).toBeInTheDocument();
    expect(
      screen.getByText("Organizza il tuo lavoro con la board personale.")
    ).toBeInTheDocument();
  });

  // 2.9: children con blur-sm e aria-hidden
  it("applica blur-sm e aria-hidden ai children quando overlay attivo", () => {
    renderOverlay();

    const childContent = screen.getByTestId("child-content");
    const blurWrapper = childContent.closest("[aria-hidden]");
    expect(blurWrapper).toHaveAttribute("aria-hidden", "true");
    expect(blurWrapper).toHaveClass("blur-sm");
    expect(blurWrapper).toHaveClass("pointer-events-none");
    expect(blurWrapper).toHaveClass("select-none");
  });

  // 2.10: loading state → null (fail-closed)
  it("renderizza null durante il loading (fail-closed)", () => {
    mockUseSubscription.mockReturnValue({ isPro: false, isLoading: true });

    const { container } = renderOverlay();
    expect(container.innerHTML).toBe("");
  });

  it("renderizza null se useUserRole e' in loading", () => {
    mockUseUserRole.mockReturnValue({ data: null, isLoading: true });

    const { container } = renderOverlay();
    expect(container.innerHTML).toBe("");
  });

  it("renderizza null se useProWaitlist e' in loading", () => {
    mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: true });

    const { container } = renderOverlay();
    expect(container.innerHTML).toBe("");
  });

  // M2 fix: Pro + Admin contemporaneamente → children normali
  it("renderizza solo children per utente Pro + Admin", () => {
    mockUseSubscription.mockReturnValue({ isPro: true, isLoading: false });
    mockUseUserRole.mockReturnValue({ data: "admin", isLoading: false });

    renderOverlay();

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // M2 fix: loading state NON mostra child-content nel DOM
  it("loading state non mostra child-content nel DOM (no FOUC)", () => {
    mockUseSubscription.mockReturnValue({ isPro: false, isLoading: true });

    renderOverlay();

    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
  });

  // 2.11: ARIA attributes
  it("ha role=dialog, aria-labelledby e aria-describedby corretti", () => {
    renderOverlay();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();

    // Verify the IDs match actual elements
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toBe("Task Board");

    const descEl = document.getElementById(describedBy!);
    expect(descEl).toBeInTheDocument();
    expect(descEl?.textContent).toBe(
      "Organizza il tuo lavoro con la board personale."
    );
  });

  // AC #14 — 8.8: Launch window contestuale
  describe("launch window aperta", () => {
    beforeEach(() => {
      mockUseLaunchWindow.mockReturnValue({ isOpen: true });
    });

    it("mostra bottone 'Passa a PRO' con link a /pricing", () => {
      renderOverlay();
      const link = screen.getByText("Passa a PRO");
      expect(link.closest("a")).toHaveAttribute("href", "/pricing");
    });

    it("non mostra 'Scopri PRO' (waitlist CTA)", () => {
      renderOverlay();
      expect(
        screen.queryByRole("button", { name: "Scopri PRO" })
      ).not.toBeInTheDocument();
    });

    it("mostra link 'Vedi i piani PRO' a /pricing", () => {
      renderOverlay();
      const link = screen.getByText("Vedi i piani PRO");
      expect(link.closest("a")).toHaveAttribute("href", "/pricing");
    });
  });
});
