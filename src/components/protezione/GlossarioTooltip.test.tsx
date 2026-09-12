import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlossarioTooltip } from "./GlossarioTooltip";
import { useIsMobile } from "@/hooks/use-mobile";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

describe("GlossarioTooltip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it("renderizza children con stile glossario se il termine esiste (desktop)", () => {
    render(<GlossarioTooltip term="diaria">diaria</GlossarioTooltip>);
    const span = screen.getByText("diaria");
    expect(span.className).toContain("border-dashed");
    expect(span.className).toContain("cursor-help");
  });

  it("renderizza children senza tooltip se il termine non esiste", () => {
    render(
      <GlossarioTooltip term="termine-inesistente">testo</GlossarioTooltip>,
    );
    const el = screen.getByText("testo");
    // Nessun border-dashed — fallback senza tooltip
    expect(el.className).not.toContain("border-dashed");
  });

  it("è case-insensitive nel lookup del termine", () => {
    render(<GlossarioTooltip term="Diaria">testo</GlossarioTooltip>);
    const span = screen.getByText("testo");
    expect(span.className).toContain("border-dashed");
  });

  it("renderizza Popover su mobile (tap)", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(<GlossarioTooltip term="diaria">diaria</GlossarioTooltip>);
    const trigger = screen.getByText("diaria");
    expect(trigger.className).toContain("border-dashed");
    // Il trigger su mobile è un PopoverTrigger
    fireEvent.click(trigger);
    // Dopo click, il contenuto Popover dovrebbe apparire
    expect(screen.getByText(/soldi che ti bonificano/i)).toBeDefined();
  });
});
