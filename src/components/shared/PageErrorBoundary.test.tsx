import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageErrorBoundary } from "./PageErrorBoundary";

// Silence React error boundary console.error during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test page error");
  }
  return <div>Page content</div>;
}

describe("PageErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <PageErrorBoundary>
        <div>Page content here</div>
      </PageErrorBoundary>
    );
    expect(screen.getByText("Page content here")).toBeInTheDocument();
  });

  it("shows fallback card when child throws", () => {
    render(
      <PageErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PageErrorBoundary>
    );
    expect(
      screen.getByText("Qualcosa è andato storto")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Si è verificato un errore nel caricamento di questa pagina. Puoi riprovare o tornare alla dashboard."
      )
    ).toBeInTheDocument();
  });

  it("has Riprova and Torna alla Dashboard buttons", () => {
    render(
      <PageErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PageErrorBoundary>
    );
    expect(screen.getByText("Riprova")).toBeInTheDocument();
    expect(screen.getByText("Torna alla Home")).toBeInTheDocument();
  });

  it("resets error state when Riprova is clicked", () => {
    let shouldThrow = true;
    function ToggleThrow() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Recovered page</div>;
    }

    const { rerender } = render(
      <PageErrorBoundary>
        <ToggleThrow />
      </PageErrorBoundary>
    );

    expect(
      screen.getByText("Qualcosa è andato storto")
    ).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText("Riprova"));

    rerender(
      <PageErrorBoundary>
        <ToggleThrow />
      </PageErrorBoundary>
    );

    expect(screen.getByText("Recovered page")).toBeInTheDocument();
  });

  it("is NOT full-screen (no min-h-screen)", () => {
    const { container } = render(
      <PageErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PageErrorBoundary>
    );
    // The outermost div should NOT have min-h-screen
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.innerHTML).not.toContain("min-h-screen");
  });

  it("shows error details in development mode", () => {
    render(
      <PageErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PageErrorBoundary>
    );
    // In test/dev, error message should be visible
    expect(screen.getByText("Test page error")).toBeInTheDocument();
  });

  it("shows AlertTriangle icon in fallback", () => {
    const { container } = render(
      <PageErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PageErrorBoundary>
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
