import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryCard, type StorySlideRendered } from "./StoryCard";
import { createElement } from "react";

const makeSlides = (count: number): StorySlideRendered[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `slide-${i}`,
    content: createElement("p", null, `Contenuto scheda ${i + 1}`),
  }));

describe("StoryCard", () => {
  it("renderizza la prima scheda e indicatore progresso", () => {
    render(<StoryCard slides={makeSlides(3)} />);
    expect(screen.getByText("Contenuto scheda 1")).toBeDefined();
    expect(screen.getByText("1 / 3")).toBeDefined();
    // 3 pallini di progresso
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("naviga avanti con pulsante Avanti", () => {
    render(<StoryCard slides={makeSlides(3)} />);
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("Contenuto scheda 2")).toBeDefined();
    expect(screen.getByText("2 / 3")).toBeDefined();
  });

  it("naviga indietro con pulsante Indietro", () => {
    render(<StoryCard slides={makeSlides(3)} />);
    fireEvent.click(screen.getByText("Avanti"));
    fireEvent.click(screen.getByText("Indietro"));
    expect(screen.getByText("Contenuto scheda 1")).toBeDefined();
  });

  it("naviga con click su pallino", () => {
    render(<StoryCard slides={makeSlides(3)} />);
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[2]); // terzo pallino
    expect(screen.getByText("Contenuto scheda 3")).toBeDefined();
  });

  it("ultima scheda con onBack mostra Chiudi e non Avanti", () => {
    const onBack = vi.fn();
    render(<StoryCard slides={makeSlides(2)} onBack={onBack} />);
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("Chiudi")).toBeDefined();
    expect(screen.queryByText("Avanti")).toBeNull();
  });

  it("ultima scheda senza onBack non mostra né Chiudi né Avanti", () => {
    render(<StoryCard slides={makeSlides(2)} />);
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.queryByText("Chiudi")).toBeNull();
    expect(screen.queryByText("Avanti")).toBeNull();
  });

  it("prima scheda con onBack mostra Torna indietro", () => {
    const onBack = vi.fn();
    render(<StoryCard slides={makeSlides(2)} onBack={onBack} />);
    fireEvent.click(screen.getByText("Torna indietro"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("Chiudi (ultima scheda) chiama onBack", () => {
    const onBack = vi.fn();
    render(<StoryCard slides={makeSlides(2)} onBack={onBack} />);
    fireEvent.click(screen.getByText("Avanti"));
    fireEvent.click(screen.getByText("Chiudi"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("Indietro disabilitato alla prima scheda senza onBack", () => {
    render(<StoryCard slides={makeSlides(2)} />);
    const indietro = screen.getByText("Indietro").closest("button")!;
    expect(indietro.disabled).toBe(true);
  });
});
