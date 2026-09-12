/**
 * Test per GuidaCompletaPreview.tsx
 * Copertura:
 * - Rendering titolo, Pro badge, indice capitoli
 * - Lock CTA (non download)
 * - Analytics trackAnonymous fired on mount
 * - Focus management a11y
 * - Back button
 * - Disclaimer presente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidaCompletaPreview } from "./GuidaCompletaPreview";

// ── Mocks ──

vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, track: vi.fn(), trackAnonymous: vi.fn() };
});

import { trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";

describe("GuidaCompletaPreview", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza il titolo principale", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    expect(
      screen.getByText("Guida Completa alla Protezione Freelancer"),
    ).toBeDefined();
  });

  it("renderizza il badge Pro", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    expect(screen.getByText("Pro")).toBeDefined();
  });

  it("renderizza tutti gli 11 capitoli dell'indice", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
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

  it("mostra CTA con Lock — nessun link di download", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    expect(screen.getByText("Scarica la Guida Completa (PDF)")).toBeDefined();
    expect(screen.getByText(/Funzionalità in arrivo/)).toBeDefined();

    // No download link present
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("trackAnonymous fired on mount con evento corretto", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    expect(trackAnonymous).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GUIDE_PDF_PREVIEW_VIEWED,
    );
    expect(trackAnonymous).toHaveBeenCalledTimes(1);
  });

  it("focus si sposta sul titolo al mount", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    const heading = screen.getByText(
      "Guida Completa alla Protezione Freelancer",
    );
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  it("click 'Torna indietro' chiama onBack", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renderizza ProtezioneDisclaimer", () => {
    render(<GuidaCompletaPreview onBack={onBack} />);
    expect(screen.getByText(/Forfettino ti aiuta a orientarti/)).toBeDefined();
  });
});
