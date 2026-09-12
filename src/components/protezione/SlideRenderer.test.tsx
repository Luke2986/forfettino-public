import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { enrichWithGlossario, SlideContent } from "./SlideRenderer";
import type { SlideContentData } from "@/data/protezione-content";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// ── enrichWithGlossario ──

describe("enrichWithGlossario", () => {
  it("restituisce stringa invariata se nessun termine matcha", () => {
    const result = enrichWithGlossario("Nessun termine qui.");
    expect(result).toBe("Nessun termine qui.");
  });

  it("restituisce stringa invariata per testo vuoto", () => {
    const result = enrichWithGlossario("");
    expect(result).toBe("");
  });

  it("wrappa un singolo termine glossario", () => {
    const { container } = render(<>{enrichWithGlossario("La tua diaria è importante.")}</>);
    const tooltip = container.querySelector("[class*='border-dashed']");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe("diaria");
  });

  it("wrappa solo la prima occorrenza di ogni termine", () => {
    const { container } = render(
      <>{enrichWithGlossario("La diaria costa come il premio. La diaria è utile e il premio è annuale.")}</>,
    );
    const tooltips = container.querySelectorAll("[class*='border-dashed']");
    // "diaria" once + "premio" once = 2
    expect(tooltips.length).toBe(2);
  });

  it("gestisce termini multi-parola come 'rc professionale'", () => {
    const { container } = render(
      <>{enrichWithGlossario("La tua RC professionale ti protegge.")}</>,
    );
    const tooltip = container.querySelector("[class*='border-dashed']");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent?.toLowerCase()).toBe("rc professionale");
  });

  it("matcha 'rc professionale' in contesto di frase reale", () => {
    const { container } = render(
      <>{enrichWithGlossario("Hai bisogno di una RC professionale per lavorare.")}</>,
    );
    const tooltip = container.querySelector("[class*='border-dashed']");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent?.toLowerCase()).toBe("rc professionale");
  });

  it("match case-insensitive", () => {
    const { container } = render(
      <>{enrichWithGlossario("Il PREMIO è alto e la DIARIA bassa.")}</>,
    );
    const tooltips = container.querySelectorAll("[class*='border-dashed']");
    expect(tooltips.length).toBe(2);
  });

  it("gestisce caratteri speciali nel testo senza rompere il regex", () => {
    const result = enrichWithGlossario("Costo: €100 (lordo). Nessun sinistro.");
    const { container } = render(<>{result}</>);
    const tooltip = container.querySelector("[class*='border-dashed']");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe("sinistro");
  });
});

// ── SlideContent ──

describe("SlideContent", () => {
  const baseSlide: SlideContentData = {
    id: "test-slide",
    title: "Test Title",
    paragraphs: ["Un paragrafo con diaria dentro."],
  };

  it("renderizza titolo e paragrafi", () => {
    render(<SlideContent slide={baseSlide} />);
    expect(screen.getByText("Test Title")).toBeDefined();
  });

  it("renderizza emoji quando presente", () => {
    render(<SlideContent slide={{ ...baseSlide, emoji: "🎯" }} />);
    expect(screen.getByText("🎯")).toBeDefined();
  });

  it("renderizza sottotitolo quando presente", () => {
    render(<SlideContent slide={{ ...baseSlide, subtitle: "Sub here" }} />);
    expect(screen.getByText("Sub here")).toBeDefined();
  });

  it("non renderizza sottotitolo quando assente", () => {
    render(<SlideContent slide={baseSlide} />);
    // Only one element in header space-y-1: the title
    expect(screen.queryByText("Sub here")).toBeNull();
  });

  it("enrichisce i paragrafi con glossario tooltip", () => {
    const { container } = render(<SlideContent slide={baseSlide} />);
    const tooltip = container.querySelector("[class*='border-dashed']");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe("diaria");
  });

  it("renderizza highlight box quando presente", () => {
    render(
      <SlideContent
        slide={{
          ...baseSlide,
          highlight: { label: "Info", value: "Il sinistro è coperto." },
        }}
      />,
    );
    expect(screen.getByText("Info")).toBeDefined();
  });

  it("enrichisce il valore dell'highlight con glossario", () => {
    const { container } = render(
      <SlideContent
        slide={{
          ...baseSlide,
          highlight: { label: "Info", value: "Il sinistro è coperto." },
        }}
      />,
    );
    // "sinistro" should be wrapped
    const tooltips = container.querySelectorAll("[class*='border-dashed']");
    const sinistroTooltip = Array.from(tooltips).find(
      (t) => t.textContent === "sinistro",
    );
    expect(sinistroTooltip).not.toBeUndefined();
  });

  it("renderizza tabella con enrichment nelle celle", () => {
    const { container } = render(
      <SlideContent
        slide={{
          ...baseSlide,
          table: {
            headers: ["Tipo", "Dettaglio"],
            rows: [["Sinistro grave", "Serve il massimale"]],
          },
        }}
      />,
    );
    expect(screen.getByText("Tipo")).toBeDefined();
    expect(screen.getByText("Dettaglio")).toBeDefined();
    // "sinistro" and "massimale" should be enriched in cells
    const tooltips = container.querySelectorAll("[class*='border-dashed']");
    const terms = Array.from(tooltips).map((t) => t.textContent?.toLowerCase());
    expect(terms).toContain("sinistro");
    expect(terms).toContain("massimale");
  });

  it("renderizza nota quando presente", () => {
    render(
      <SlideContent slide={{ ...baseSlide, note: "Nota importante." }} />,
    );
    expect(screen.getByText("Nota importante.")).toBeDefined();
  });

  it("renderizza CTA quando slide.cta = true", () => {
    render(<SlideContent slide={{ ...baseSlide, cta: true }} />);
    expect(screen.getByText(/Parlane con il tuo commercialista/)).toBeDefined();
  });

  it("non renderizza CTA quando slide.cta è assente", () => {
    render(<SlideContent slide={baseSlide} />);
    expect(screen.queryByText(/Parlane con il tuo commercialista/)).toBeNull();
  });
});
