import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PercorsoRcProfessionale } from "./PercorsoRcProfessionale";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

describe("PercorsoRcProfessionale", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza il titolo del percorso", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    expect(
      screen.getByText("Un cliente che mi fa causa"),
    ).toBeDefined();
  });

  it("renderizza il sottotitolo del percorso", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    expect(
      screen.getByText(/Cos'è la RC Professionale/),
    ).toBeDefined();
  });

  it("renderizza la prima scheda (Shock scenario)", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    expect(
      screen.getByText(/Chi paga se sbagli/),
    ).toBeDefined();
  });

  it("naviga attraverso tutte e 6 le schede (indicatore progresso)", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    // Verifica navigazione completa via indicatore di progresso — non accoppiato ai titoli
    expect(screen.getByText("1 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("2 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("3 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("4 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("5 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("6 / 6")).toBeDefined();
  });

  it("ogni scheda mostra un titolo diverso", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    const titles: string[] = [];
    for (let i = 0; i < 6; i++) {
      // Get the slide title from within the tabpanel
      const tabpanel = screen.getByRole("tabpanel");
      const heading = tabpanel.querySelector("h3");
      titles.push(heading?.textContent ?? "");
      if (i < 5) fireEvent.click(screen.getByText("Avanti"));
    }
    // All 6 titles should be unique
    expect(new Set(titles).size).toBe(6);
  });

  it("navigazione indietro funziona", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("2 / 6")).toBeDefined();
    fireEvent.click(screen.getByText("Indietro"));
    expect(screen.getByText("1 / 6")).toBeDefined();
  });

  it("ultima scheda mostra CTA con testo commercialista", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Avanti"));
    }
    expect(screen.getByText(/Parlane con il tuo commercialista/)).toBeDefined();
  });

  it("renderizza sezione FAQ RC", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    expect(screen.getByText("Domande frequenti")).toBeDefined();
    expect(screen.getByText("Devo chiedere al mio commercialista?")).toBeDefined();
    expect(screen.getByText("È obbligatoria per me?")).toBeDefined();
    expect(screen.getByText("La RC del mio settore esiste?")).toBeDefined();
  });

  it("renderizza disclaimer", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    expect(
      screen.getByText(/Forfettino ti aiuta a orientarti/),
    ).toBeDefined();
  });

  it("Torna indietro chiama onBack", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("include copy test Ferraro nell'ultima scheda", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Avanti"));
    }
    expect(
      screen.getByText(/forfettario.*costi assicurativi.*non sono deducibili/i),
    ).toBeDefined();
  });

  it("renderizza hint glossario", () => {
    render(<PercorsoRcProfessionale onBack={onBack} />);
    expect(screen.getByText(/Tocca o passa il mouse/)).toBeDefined();
  });
});
