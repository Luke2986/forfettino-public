import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PensioneIntegrativa } from "./PensioneIntegrativa";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/hooks/useSubscription";
import { track } from "@/lib/analytics";
import { FREE_SUBSCRIPTION, PRO_SUBSCRIPTION } from "@/test/mock-subscription";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(() => FREE_SUBSCRIPTION),
}));

vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, track: vi.fn(), trackAnonymous: vi.fn() };
});

describe("PensioneIntegrativa", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  // ── Sezioni renderizzate ──

  it("renderizza il titolo principale", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText("Pensione integrativa per forfettari")).toBeDefined();
  });

  it("renderizza Sezione A — Il Gap Pensionistico", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/Il Gap Pensionistico/)).toBeDefined();
    expect(screen.getByText(/Versando il minimo INPS per 30 anni/)).toBeDefined();
  });

  it("renderizza Sezione B — FPA vs PIP", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/FPA vs PIP/)).toBeDefined();
  });

  it("renderizza la tabella comparativa FPA vs PIP (desktop)", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText("Banche/SGR")).toBeDefined();
    expect(screen.getByText(/Assicurazioni \(unit linked\)/)).toBeDefined();
    expect(screen.getByText(/1,1%-1,5%/)).toBeDefined();
    expect(screen.getByText(/1,8%-2,5%/)).toBeDefined();
    // Desktop shows <table> with header "Aspetto"
    expect(screen.getByText("Aspetto")).toBeDefined();
  });

  it("renderizza la tabella FPA vs PIP in layout mobile (stacked cards)", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(<PensioneIntegrativa onBack={onBack} />);

    // Mobile shows stacked cards with aspect labels as uppercase headings
    expect(screen.getByText("Gestione")).toBeDefined();
    expect(screen.getByText("Costo (ISC)")).toBeDefined();
    expect(screen.getByText("Rendimenti (10 anni)")).toBeDefined();
    expect(screen.getByText("Messaggio chiave")).toBeDefined();

    // Data still present
    expect(screen.getByText("Banche/SGR")).toBeDefined();
    expect(screen.getByText(/1,1%-1,5%/)).toBeDefined();

    // Desktop-only header "Aspetto" NOT present in mobile
    expect(screen.queryByText("Aspetto")).toBeNull();
  });

  it("renderizza Sezione C — Il vantaggio fiscale del forfettario", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/vantaggio fiscale del forfettario/)).toBeDefined();
  });

  it("renderizza Vantaggio 1 — Deduzione INPS", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/Deduzione INPS.*Quadro LM/)).toBeDefined();
    expect(screen.getByText(/€2.000\/anno al fondo pensione/)).toBeDefined();
  });

  it("renderizza Vantaggio 2 — Esenzione Fiscale in highlight teal", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/Esenzione fiscale totale alla pensione/)).toBeDefined();
    expect(screen.getByText(/Comunica al tuo fondo entro il 31 dicembre/)).toBeDefined();
  });

  it("renderizza Sezione D — Risorse e FAQ", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/Risorse e FAQ/)).toBeDefined();
  });

  // ── FAQ ──

  it("renderizza 4 FAQ collapsabili", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText("Devo comunicare al fondo i contributi non dedotti?")).toBeDefined();
    expect(screen.getByText("L'INPS non basta per la pensione?")).toBeDefined();
    expect(screen.getByText("FPA o PIP: quale scelgo?")).toBeDefined();
    expect(screen.getByText("Quanto devo versare?")).toBeDefined();
  });

  it("la prima FAQ è 'comunicare al fondo' (più urgente)", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    const faqButtons = screen.getAllByRole("button").filter((btn) =>
      btn.textContent?.includes("contributi non dedotti") ||
      btn.textContent?.includes("L'INPS non basta") ||
      btn.textContent?.includes("FPA o PIP") ||
      btn.textContent?.includes("Quanto devo versare"),
    );
    expect(faqButtons[0].textContent).toContain("contributi non dedotti");
  });

  // ── Link CiaoElsa ──

  it("CiaoElsa è un link cliccabile con target _blank", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    const link = screen.getByText("CiaoElsa.com");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://www.ciaoelsa.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("menziona CiaoElsa con disclaimer", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText("CiaoElsa.com")).toBeDefined();
    expect(screen.getByText(/non ha rapporti commerciali/)).toBeDefined();
  });

  // ── Disclaimer ──

  it("renderizza ProtezioneDisclaimer", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/Forfettino ti aiuta a orientarti/)).toBeDefined();
  });

  // ── Navigazione ──

  it("click 'Torna indietro' chiama onBack", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // ── Focus management ──

  it("focus si sposta sul titolo al mount", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    const heading = screen.getByText("Pensione integrativa per forfettari");
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  // ── Glossario ──

  it("termini glossario sono presenti nel DOM", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    // enrichWithGlossario wraps terms in <span> with border-dashed
    const dashedSpans = document.querySelectorAll(".border-dashed");
    expect(dashedSpans.length).toBeGreaterThan(0);
  });

  // ── CTA Guida Completa ──

  it("Free user vede CTA con testo 'disponibile per utenti Pro' (no download link)", () => {
    render(<PensioneIntegrativa onBack={onBack} />);
    expect(screen.getByText(/Vuoi ancora più dettagli/)).toBeDefined();
    expect(screen.getByText(/disponibile per utenti Pro/)).toBeDefined();
    expect(screen.getByText("Pro")).toBeDefined();
    expect(screen.queryByRole("link", { name: /Guida Completa/ })).toBeNull();
  });

  it("Pro user vede download link Guida Completa", () => {
    vi.mocked(useSubscription as ReturnType<typeof vi.fn>).mockReturnValue(PRO_SUBSCRIPTION);

    render(<PensioneIntegrativa onBack={onBack} />);
    const link = screen.getByRole("link", { name: /Guida Completa/ });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/guide/guida-protezione-freelancer.pdf");
    expect(link.getAttribute("download")).toBe("guida-protezione-freelancer.pdf");
  });

  it("Pro user — click download chiama track con source 'pensione'", () => {
    vi.mocked(useSubscription as ReturnType<typeof vi.fn>).mockReturnValue(PRO_SUBSCRIPTION);

    render(<PensioneIntegrativa onBack={onBack} />);
    fireEvent.click(screen.getByRole("link", { name: /Guida Completa/ }));
    expect(track).toHaveBeenCalledWith("guide_pdf_downloaded", expect.objectContaining({
      source: "pensione",
    }));
  });
});
