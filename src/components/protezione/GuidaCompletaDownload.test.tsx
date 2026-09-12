/**
 * Test per GuidaCompletaDownload.tsx
 * Copertura:
 * - Rendering titolo, edizione, indice capitoli, info line
 * - Link download con href e attributo download
 * - Tracking onClick
 * - Focus management a11y
 * - Back button
 * - Disclaimer presente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidaCompletaDownload } from "./GuidaCompletaDownload";

// ── Mocks ──

vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, track: vi.fn(), trackAnonymous: vi.fn() };
});

import { track } from "@/lib/analytics";

describe("GuidaCompletaDownload", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza il titolo principale", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    expect(
      screen.getByText("Guida Completa alla Protezione Freelancer"),
    ).toBeDefined();
  });

  it("renderizza l'edizione badge", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    expect(screen.getByText(/Marzo 2026/)).toBeDefined();
  });

  it("renderizza tutti gli 11 capitoli dell'indice", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    expect(screen.getByText("Ecco Cosa Non Ti Copre Nessuno")).toBeDefined();
    expect(screen.getByText("Infortuni e Malattia")).toBeDefined();
    expect(screen.getByText("Mutue Sanitarie")).toBeDefined();
    expect(screen.getByText("RC Professionale")).toBeDefined();
    expect(screen.getByText("Tutela Legale")).toBeDefined();
    expect(screen.getByText("Cyber Risk")).toBeDefined();
    expect(screen.getByText("Pensione Integrativa")).toBeDefined();
    expect(screen.getByText("Protezione Home Office")).toBeDefined();
    expect(screen.getByText("Assicurazione sulla Vita")).toBeDefined();
    expect(screen.getByText("Tabella Riassuntiva")).toBeDefined();
    expect(screen.getByText("Checklist di Protezione")).toBeDefined();
  });

  it("renderizza il link di download con attributi corretti", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    const link = screen.getByRole("link", { name: /Scarica la Guida/ });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      "/guide/guida-protezione-freelancer.pdf",
    );
    expect(link.getAttribute("download")).toBe(
      "guida-protezione-freelancer.pdf",
    );
  });

  it("click download chiama track con parametri corretti", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    fireEvent.click(screen.getByRole("link", { name: /Scarica la Guida/ }));
    expect(track).toHaveBeenCalledWith("guide_pdf_downloaded", {
      version: "1.0",
      edition: "Marzo 2026",
      source: "download-page",
    });
  });

  it("focus si sposta sul titolo al mount", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    const heading = screen.getByText(
      "Guida Completa alla Protezione Freelancer",
    );
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  it("click 'Torna indietro' chiama onBack", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renderizza ProtezioneDisclaimer", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    expect(screen.getByText(/Forfettino ti aiuta a orientarti/)).toBeDefined();
  });

  it("renderizza info line con conteggio pagine", () => {
    render(<GuidaCompletaDownload onBack={onBack} />);
    expect(screen.getByText(/14 pagine/)).toBeDefined();
  });
});
