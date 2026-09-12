import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionErrorBoundary } from "./SectionErrorBoundary";

// Silence React error boundary console.error during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Normal content</div>;
}

describe("SectionErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <SectionErrorBoundary>
        <div>Child content</div>
      </SectionErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows fallback when child throws", () => {
    render(
      <SectionErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );
    expect(
      screen.getByText("Impossibile caricare questa sezione.")
    ).toBeInTheDocument();
    expect(screen.getByText("Riprova")).toBeInTheDocument();
  });

  it("does not show children when error fallback is active", () => {
    render(
      <SectionErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );
    expect(screen.queryByText("Normal content")).not.toBeInTheDocument();
  });

  it("shows the AlertTriangle icon in fallback", () => {
    const { container } = render(
      <SectionErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("resets error state when Riprova is clicked", () => {
    let shouldThrow = true;
    function ToggleThrow() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Recovered content</div>;
    }

    const { rerender } = render(
      <SectionErrorBoundary>
        <ToggleThrow />
      </SectionErrorBoundary>
    );

    expect(
      screen.getByText("Impossibile caricare questa sezione.")
    ).toBeInTheDocument();

    // Stop throwing before retry
    shouldThrow = false;

    fireEvent.click(screen.getByText("Riprova"));

    // After retry, children should re-render
    rerender(
      <SectionErrorBoundary>
        <ToggleThrow />
      </SectionErrorBoundary>
    );

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("has compact fallback styling (not full-screen)", () => {
    const { container } = render(
      <SectionErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );
    const fallback = container.firstElementChild as HTMLElement;
    expect(fallback.className).toContain("bg-muted/30");
    expect(fallback.className).toContain("rounded-lg");
    expect(fallback.className).toContain("p-4");
    expect(fallback.className).toContain("text-center");
    // Should NOT be full-screen
    expect(fallback.className).not.toContain("min-h-screen");
  });
});
