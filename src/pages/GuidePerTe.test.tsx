/**
 * Test per GuidePerTe.tsx
 * Copertura:
 * - Rendering entry point hub (titolo, sottotitolo, macro-aree, risorse)
 * - Click su card Infortuni mostra PercorsoInfortuni
 * - Click su card RC mostra PercorsoRcProfessionale
 * - Click su card Pensione mostra PensioneIntegrativa (senza Checklist)
 * - Click su Checklist in Risorse mostra ChecklistProtezione standalone
 * - Click su Guida Completa: Pro → GuidaCompletaDownload, Free → GuidaCompletaPreview
 * - Torna indietro riporta all'entry point
 * - Disclaimer visibile solo su entry point
 * - MobileHeader su mobile
 * - Pro badge visibile per Free, nascosto per Pro
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { FREE_SUBSCRIPTION, PRO_SUBSCRIPTION } from "@/test/mock-subscription";

// ── Mocks ──

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(() => FREE_SUBSCRIPTION),
}));
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "mobile-header" }, title),
}));
vi.mock("@/components/shared/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "error-boundary" }, children),
}));
vi.mock("@/components/protezione/PercorsoInfortuni", () => ({
  PercorsoInfortuni: ({ onBack }: { onBack: () => void }) =>
    createElement("div", { "data-testid": "percorso-infortuni" },
      createElement("button", { onClick: onBack }, "Torna indietro"),
    ),
}));
vi.mock("@/components/protezione/PercorsoRcProfessionale", () => ({
  PercorsoRcProfessionale: ({ onBack }: { onBack: () => void }) =>
    createElement("div", { "data-testid": "percorso-rc" },
      createElement("button", { onClick: onBack }, "Torna indietro"),
    ),
}));
vi.mock("@/components/protezione/PensioneIntegrativa", () => ({
  PensioneIntegrativa: ({ onBack }: { onBack: () => void }) =>
    createElement("div", { "data-testid": "pensione-integrativa" },
      createElement("button", { onClick: onBack }, "Torna indietro"),
    ),
}));
vi.mock("@/components/protezione/ChecklistProtezione", () => ({
  ChecklistProtezione: ({ onNavigate }: { onNavigate?: (p: string) => void }) =>
    createElement("div", { "data-testid": "checklist-protezione" },
      createElement("button", { onClick: () => onNavigate?.("infortuni") }, "Vai a Infortuni"),
    ),
}));
vi.mock("@/components/protezione/GuidaCompletaDownload", () => ({
  GuidaCompletaDownload: ({ onBack }: { onBack: () => void }) =>
    createElement("div", { "data-testid": "guida-download" },
      createElement("button", { onClick: onBack }, "Torna indietro"),
    ),
}));
vi.mock("@/components/protezione/GuidaCompletaPreview", () => ({
  GuidaCompletaPreview: ({ onBack }: { onBack: () => void }) =>
    createElement("div", { "data-testid": "guida-preview" },
      createElement("button", { onClick: onBack }, "Torna indietro"),
    ),
}));

import GuidePerTe from "./GuidePerTe";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/hooks/useSubscription";

const renderPage = () =>
  render(
    <MemoryRouter>
      <GuidePerTe />
    </MemoryRouter>,
  );

describe("GuidePerTe Page", () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  // ── Entry Point Hub ──

  it("renderizza titolo e sottotitolo hub", () => {
    renderPage();
    expect(screen.getByText("Proteggi il tuo lavoro")).toBeDefined();
    expect(screen.getByText(/Le coperture che contano/)).toBeDefined();
  });

  it("renderizza le 4 categorie macro-area", () => {
    renderPage();
    expect(screen.getByText("Protezione del reddito")).toBeDefined();
    expect(screen.getByText("Protezione del patrimonio")).toBeDefined();
    expect(screen.getByText("Previdenza")).toBeDefined();
    expect(screen.getByText("Famiglia")).toBeDefined();
  });

  it("renderizza le card delle aree con label e prezzo", () => {
    renderPage();
    expect(screen.getByText("Infortuni e malattia")).toBeDefined();
    expect(screen.getByText("RC Professionale")).toBeDefined();
    expect(screen.getByText("Pensione integrativa")).toBeDefined();
    expect(screen.getByText("Mutua sanitaria")).toBeDefined();
  });

  it("renderizza la sezione Risorse con Checklist e Guida Completa", () => {
    renderPage();
    expect(screen.getByText("Risorse")).toBeDefined();
    expect(screen.getByText("Checklist di Protezione")).toBeDefined();
    expect(screen.getByText("Guida Completa")).toBeDefined();
  });

  it("renderizza disclaimer su entry point", () => {
    renderPage();
    expect(screen.getByText(/Forfettino ti aiuta a orientarti/)).toBeDefined();
  });

  it("card coming-soon mostrano 'In arrivo'", () => {
    renderPage();
    // Tutela legale, Cyber Risk, TCM sono coming-soon
    const inArrivoItems = screen.getAllByText("In arrivo");
    expect(inArrivoItems.length).toBeGreaterThanOrEqual(3);
  });

  // ── Percorso Infortuni ──

  it("click su card Infortuni mostra PercorsoInfortuni", () => {
    renderPage();
    fireEvent.click(screen.getByText("Infortuni e malattia"));
    expect(screen.getByTestId("percorso-infortuni")).toBeDefined();
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
  });

  // ── Percorso RC Professionale ──

  it("click su card RC mostra PercorsoRcProfessionale", () => {
    renderPage();
    fireEvent.click(screen.getByText("RC Professionale"));
    expect(screen.getByTestId("percorso-rc")).toBeDefined();
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
  });

  // ── Pensione Integrativa (separata dalla Checklist) ──

  it("click su Pensione mostra PensioneIntegrativa senza Checklist", () => {
    renderPage();
    fireEvent.click(screen.getByText("Pensione integrativa"));
    expect(screen.getByTestId("pensione-integrativa")).toBeDefined();
    expect(screen.queryByTestId("checklist-protezione")).toBeNull();
  });

  // ── Checklist standalone ──

  it("click su Checklist di Protezione mostra la checklist", () => {
    renderPage();
    fireEvent.click(screen.getByText("Checklist di Protezione"));
    expect(screen.getByTestId("checklist-protezione")).toBeDefined();
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
  });

  it("ChecklistProtezione onNavigate naviga al percorso", () => {
    renderPage();
    fireEvent.click(screen.getByText("Checklist di Protezione"));
    fireEvent.click(screen.getByText("Vai a Infortuni"));
    expect(screen.getByTestId("percorso-infortuni")).toBeDefined();
    expect(screen.queryByTestId("checklist-protezione")).toBeNull();
  });

  // ── Navigazione indietro ──

  it("Torna indietro da Infortuni riporta all'hub", () => {
    renderPage();
    fireEvent.click(screen.getByText("Infortuni e malattia"));
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(screen.getByText("Proteggi il tuo lavoro")).toBeDefined();
  });

  it("Torna indietro da RC riporta all'hub", () => {
    renderPage();
    fireEvent.click(screen.getByText("RC Professionale"));
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(screen.getByText("Proteggi il tuo lavoro")).toBeDefined();
  });

  it("Torna indietro da Pensione riporta all'hub", () => {
    renderPage();
    fireEvent.click(screen.getByText("Pensione integrativa"));
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(screen.getByText("Proteggi il tuo lavoro")).toBeDefined();
  });

  // ── Disclaimer ──

  it("disclaimer nascosto su percorso Infortuni", () => {
    renderPage();
    fireEvent.click(screen.getByText("Infortuni e malattia"));
    expect(screen.queryByText(/Forfettino ti aiuta a orientarti/)).toBeNull();
  });

  it("disclaimer nascosto su percorso RC", () => {
    renderPage();
    fireEvent.click(screen.getByText("RC Professionale"));
    expect(screen.queryByText(/Forfettino ti aiuta a orientarti/)).toBeNull();
  });

  it("disclaimer nascosto su percorso Pensione", () => {
    renderPage();
    fireEvent.click(screen.getByText("Pensione integrativa"));
    expect(screen.queryByText(/Forfettino ti aiuta a orientarti/)).toBeNull();
  });

  // ── Mobile ──

  it("mostra MobileHeader su mobile", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    renderPage();
    expect(screen.getByTestId("mobile-header")).toBeDefined();
    expect(screen.getByText("Guide per te")).toBeDefined();
  });

  it("non mostra MobileHeader su desktop", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    renderPage();
    expect(screen.queryByTestId("mobile-header")).toBeNull();
  });

  // ── Guida Completa — Free user (default mock) ──

  it("click su Guida Completa (Free) mostra GuidaCompletaPreview", () => {
    renderPage();
    fireEvent.click(screen.getByText("Guida Completa"));
    expect(screen.getByTestId("guida-preview")).toBeDefined();
    expect(screen.queryByTestId("guida-download")).toBeNull();
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
  });

  it("Free user vede badge Pro sulla card Guida Completa", () => {
    renderPage();
    expect(screen.getByText("Pro")).toBeDefined();
  });

  it("Torna indietro da Guida Preview riporta all'hub", () => {
    renderPage();
    fireEvent.click(screen.getByText("Guida Completa"));
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(screen.getByText("Proteggi il tuo lavoro")).toBeDefined();
  });

  // ── Guida Completa — Pro user ──

  it("click su Guida Completa (Pro) mostra GuidaCompletaDownload", () => {
    vi.mocked(useSubscription as ReturnType<typeof vi.fn>).mockReturnValue(PRO_SUBSCRIPTION);
    renderPage();
    fireEvent.click(screen.getByText("Guida Completa"));
    expect(screen.getByTestId("guida-download")).toBeDefined();
    expect(screen.queryByTestId("guida-preview")).toBeNull();
  });

  it("Pro user NON vede badge Pro sulla card Guida Completa", () => {
    vi.mocked(useSubscription as ReturnType<typeof vi.fn>).mockReturnValue(PRO_SUBSCRIPTION);
    renderPage();
    expect(screen.queryByText("Pro")).toBeNull();
  });

  it("Torna indietro da Guida Download riporta all'hub", () => {
    vi.mocked(useSubscription as ReturnType<typeof vi.fn>).mockReturnValue(PRO_SUBSCRIPTION);
    renderPage();
    fireEvent.click(screen.getByText("Guida Completa"));
    expect(screen.queryByText("Proteggi il tuo lavoro")).toBeNull();
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(screen.getByText("Proteggi il tuo lavoro")).toBeDefined();
  });
});
