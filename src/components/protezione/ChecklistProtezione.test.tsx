import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChecklistProtezione } from "./ChecklistProtezione";

// ── Mocks ──
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, track: vi.fn(), trackAnonymous: vi.fn() };
});

describe("ChecklistProtezione", () => {
  const onNavigate = vi.fn();
  const onScrollToPensione = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renderizza tutte e 7 le voci con label e prezzo", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);

    expect(screen.getByText("Infortuni/Malattia")).toBeDefined();
    expect(screen.getByText("RC Professionale")).toBeDefined();
    expect(screen.getByText("Mutua Sanitaria")).toBeDefined();
    expect(screen.getByText("Tutela Legale")).toBeDefined();
    expect(screen.getByText("Pensione Integrativa")).toBeDefined();
    expect(screen.getByText("Cyber Risk")).toBeDefined();
    expect(screen.getByText("TCM/Vita")).toBeDefined();

    expect(screen.getByText("€15-40/mese")).toBeDefined();
    expect(screen.getByText("€10-40/mese")).toBeDefined();
  });

  it("tutte le voci iniziano con stato 'Non so' (segmento attivo)", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);
    // Each item has 3 segments; "Non so" is aria-pressed=true for all 7
    const nonSoButtons = screen.getAllByRole("button", { pressed: true });
    const nonSoActive = nonSoButtons.filter((btn) => btn.textContent === "Non so");
    expect(nonSoActive.length).toBe(7);
  });

  it("segmented control imposta direttamente lo stato scelto", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);

    // Click "Ce l'ho" for Infortuni
    fireEvent.click(screen.getByRole("button", { name: "Infortuni/Malattia: Ce l'ho" }));
    expect(screen.getByText(/1 su 7 coperture attive/)).toBeDefined();

    // Click "Non ce l'ho" for Infortuni
    fireEvent.click(screen.getByRole("button", { name: "Infortuni/Malattia: Non ce l'ho" }));
    expect(screen.getByText(/0 su 7 coperture attive/)).toBeDefined();

    // Click "Non so" for Infortuni (back to default)
    fireEvent.click(screen.getByRole("button", { name: "Infortuni/Malattia: Non so" }));
    expect(screen.getByText(/0 su 7 coperture attive/)).toBeDefined();
  });

  it("badge contatore aggiornato con voci 'Ce l'ho'", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);

    // Default: 0 su 7
    expect(screen.getByText(/0 su 7 coperture attive/)).toBeDefined();

    // Set 2 items to "ho"
    fireEvent.click(screen.getByRole("button", { name: "Infortuni/Malattia: Ce l'ho" }));
    expect(screen.getByText(/1 su 7 coperture attive/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "RC Professionale: Ce l'ho" }));
    expect(screen.getByText(/2 su 7 coperture attive/)).toBeDefined();
  });

  it("click link percorso chiama onNavigate", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);
    const links = screen.getAllByText(/Approfondisci nel percorso/);
    // Click first link (Infortuni)
    fireEvent.click(links[0]);
    expect(onNavigate).toHaveBeenCalledWith("infortuni");
  });

  it("Mutua mostra link personalizzato verso percorso Infortuni", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);
    const mutuaLink = screen.getByText(/Scopri di pi/);
    expect(mutuaLink).toBeDefined();
    fireEvent.click(mutuaLink);
    expect(onNavigate).toHaveBeenCalledWith("infortuni");
  });

  it("voci 'coming-soon' mostrano testo educativo", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);
    expect(screen.getByText(/Copre crediti insoluti e controversie contrattuali/)).toBeDefined();
    expect(screen.getByText(/attacco hacker.*ransomware/)).toBeDefined();
    expect(screen.getByText(/Temporanea Caso Morte/)).toBeDefined();
  });

  it("voci 'coming-soon' mostrano badge 'Approfondimento in arrivo'", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} />);
    const badges = screen.getAllByText("Approfondimento in arrivo");
    expect(badges.length).toBe(3); // tutela, cyber, tcm
    badges.forEach((badge) => {
      expect(badge.getAttribute("role")).toBe("status");
    });
  });

  it("voce pensione ha link 'Vai alla sezione Pensione'", () => {
    render(<ChecklistProtezione onNavigate={onNavigate} onScrollToPensione={onScrollToPensione} />);
    const link = screen.getByText("Vai alla sezione Pensione");
    expect(link).toBeDefined();
    fireEvent.click(link);
    expect(onScrollToPensione).toHaveBeenCalledTimes(1);
  });

  // ── sessionStorage persistence ──

  it("stato viene persistito in sessionStorage e ripristinato al remount", () => {
    const { unmount } = render(<ChecklistProtezione onNavigate={onNavigate} />);

    // Set Infortuni to "ho" via segmented control
    fireEvent.click(screen.getByRole("button", { name: "Infortuni/Malattia: Ce l'ho" }));
    expect(screen.getByText(/1 su 7 coperture attive/)).toBeDefined();

    // Unmount + remount
    unmount();
    render(<ChecklistProtezione onNavigate={onNavigate} />);

    // State restored from sessionStorage
    expect(screen.getByText(/1 su 7 coperture attive/)).toBeDefined();
  });
});
