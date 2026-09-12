import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PercorsoInfortuni } from "./PercorsoInfortuni";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

describe("PercorsoInfortuni", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza il titolo del percorso", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    expect(
      screen.getByText("Non poter lavorare per settimane"),
    ).toBeDefined();
  });

  it("renderizza la prima scheda (Shock INPS)", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    expect(
      screen.getByText(/Quanto ti dà l'INPS se ti ammali/),
    ).toBeDefined();
  });

  it("naviga attraverso tutte e 6 le schede", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    // Scheda 1
    expect(screen.getByText("1 / 6")).toBeDefined();
    // Naviga alle schede successive
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("2 / 6")).toBeDefined();
    expect(screen.getByText(/Cos'è la diaria/i)).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("3 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("4 / 6")).toBeDefined();

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("5 / 6")).toBeDefined();
    expect(screen.getAllByText(/Le mutue sanitarie/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("6 / 6")).toBeDefined();
    expect(screen.getByText("Riepilogo")).toBeDefined();
  });

  it("ultima scheda mostra CTA con testo commercialista", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    // Naviga all'ultima scheda
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Avanti"));
    }
    expect(screen.getByText(/Parlane con il tuo commercialista/)).toBeDefined();
  });

  it("renderizza sezione FAQ", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    expect(screen.getByText("Domande frequenti")).toBeDefined();
    expect(screen.getByText("Il burnout è coperto?")).toBeDefined();
    expect(screen.getByText("Cos'è la franchigia?")).toBeDefined();
    expect(screen.getByText("Cosa copre l'INAIL?")).toBeDefined();
  });

  it("renderizza disclaimer", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    expect(
      screen.getByText(/Forfettino ti aiuta a orientarti/),
    ).toBeDefined();
  });

  it("Torna indietro chiama onBack", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("include copy test Ferraro nell'ultima scheda", () => {
    render(<PercorsoInfortuni onBack={onBack} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Avanti"));
    }
    expect(
      screen.getByText(/forfettario.*costi assicurativi.*non sono deducibili/i),
    ).toBeDefined();
  });
});
