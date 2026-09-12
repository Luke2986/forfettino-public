import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidaCompletaCta } from "./GuidaCompletaCta";
import { track } from "@/lib/analytics";

vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, track: vi.fn(), trackAnonymous: vi.fn() };
});

describe("GuidaCompletaCta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Free user vede testo 'disponibile per utenti Pro' e badge Pro", () => {
    render(<GuidaCompletaCta canExport={false} source="test" />);
    expect(screen.getByText(/disponibile per utenti Pro/)).toBeDefined();
    expect(screen.getByText("Pro")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("Pro user vede link download con href e attributo download", () => {
    render(<GuidaCompletaCta canExport={true} source="test" />);
    const link = screen.getByRole("link", { name: /Guida Completa/ });
    expect(link.getAttribute("href")).toBe("/guide/guida-protezione-freelancer.pdf");
    expect(link.getAttribute("download")).toBe("guida-protezione-freelancer.pdf");
  });

  it("click download chiama track con source corretto", () => {
    render(<GuidaCompletaCta canExport={true} source="my-source" />);
    fireEvent.click(screen.getByRole("link", { name: /Guida Completa/ }));
    expect(track).toHaveBeenCalledWith("guide_pdf_downloaded", expect.objectContaining({
      source: "my-source",
    }));
  });

  it("renderizza il testo introduttivo 'Vuoi ancora più dettagli?'", () => {
    render(<GuidaCompletaCta canExport={false} source="test" />);
    expect(screen.getByText(/Vuoi ancora più dettagli/)).toBeDefined();
  });
});
