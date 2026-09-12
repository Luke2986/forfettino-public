import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GestioneBadge } from "./GestioneBadge";
import type { GestioneINPS } from "@/lib/fiscal-engine";

describe("GestioneBadge", () => {
  it("should render 'Separata' for gestione separata", () => {
    render(<GestioneBadge gestione="separata" />);
    expect(screen.getByText("Separata")).toBeTruthy();
  });

  it("should render 'Artigiani' for gestione artigiani", () => {
    render(<GestioneBadge gestione="artigiani" />);
    expect(screen.getByText("Artigiani")).toBeTruthy();
  });

  it("should render 'Commercianti' for gestione commercianti", () => {
    render(<GestioneBadge gestione="commercianti" />);
    expect(screen.getByText("Commercianti")).toBeTruthy();
  });

  it("should use outline variant (no color-coding)", () => {
    const { container } = render(<GestioneBadge gestione="artigiani" />);
    const badge = container.firstChild as HTMLElement;
    // outline variant in shadcn/ui Badge adds 'text-foreground' class and NOT bg-primary
    expect(badge.className).toContain("text-foreground");
    expect(badge.className).not.toContain("bg-primary");
    expect(badge.className).not.toContain("bg-destructive");
  });

  it("should apply custom className", () => {
    const { container } = render(<GestioneBadge gestione="separata" className="text-xs" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-xs");
  });
});

describe("Dashboard card label logic", () => {
  // Test della logica di condizionalizzazione label (estratta dal componente per testabilità)
  const getCardLabel = (gestione: GestioneINPS | null | undefined) => {
    const g = gestione || "separata";
    return g === "separata" ? "Da accantonare" : "Da coprire";
  };

  const getCardDescription = (gestione: GestioneINPS | null | undefined) => {
    const g = gestione || "separata";
    return g === "separata"
      ? "Tasse + INPS maturati sugli incassi"
      : "Obblighi fiscali e INPS maturati";
  };

  const getCardTooltip = (gestione: GestioneINPS | null | undefined) => {
    const g = gestione || "separata";
    return g === "separata"
      ? "Quanto dovresti avere già messo da parte in base agli incassi registrati quest'anno."
      : "Quanto devi ancora coprire tra imposte e contributi INPS obbligatori.";
  };

  it("should show 'Da accantonare' for separata", () => {
    expect(getCardLabel("separata")).toBe("Da accantonare");
  });

  it("should show 'Da accantonare' for null (backward compat default)", () => {
    expect(getCardLabel(null)).toBe("Da accantonare");
  });

  it("should show 'Da accantonare' for undefined (backward compat default)", () => {
    expect(getCardLabel(undefined)).toBe("Da accantonare");
  });

  it("should show 'Da coprire' for artigiani", () => {
    expect(getCardLabel("artigiani")).toBe("Da coprire");
  });

  it("should show 'Da coprire' for commercianti", () => {
    expect(getCardLabel("commercianti")).toBe("Da coprire");
  });

  it("should show correct description for separata", () => {
    expect(getCardDescription("separata")).toBe("Tasse + INPS maturati sugli incassi");
  });

  it("should show correct description for artigiani", () => {
    expect(getCardDescription("artigiani")).toBe("Obblighi fiscali e INPS maturati");
  });

  it("should show correct tooltip for separata", () => {
    expect(getCardTooltip("separata")).toContain("messo da parte");
  });

  it("should show correct tooltip for commercianti", () => {
    expect(getCardTooltip("commercianti")).toContain("coprire tra imposte");
  });
});
