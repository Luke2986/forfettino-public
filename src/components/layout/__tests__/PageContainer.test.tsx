import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageContainer } from "../PageContainer";

describe("PageContainer", () => {
  it("renders children with default classes and content-tier max-w-4xl", () => {
    render(<PageContainer data-testid="pc">Hello</PageContainer>);
    const el = screen.getByTestId("pc");
    expect(el.textContent).toBe("Hello");
    expect(el.className).toContain("p-4");
    expect(el.className).toContain("sm:p-5");
    expect(el.className).toContain("space-y-6");
    expect(el.className).toContain("max-w-4xl");
    expect(el.className).toContain("mx-auto");
    expect(el.className).not.toContain("max-w-3xl");
  });

  it("applies narrow variant with max-w-3xl instead of max-w-4xl", () => {
    render(
      <PageContainer narrow data-testid="pc">
        Content
      </PageContainer>
    );
    const el = screen.getByTestId("pc");
    expect(el.className).toContain("max-w-3xl");
    expect(el.className).toContain("mx-auto");
    expect(el.className).not.toContain("max-w-4xl");
  });

  it("merges custom className and removes conflicting Tailwind class", () => {
    render(
      <PageContainer className="space-y-4" data-testid="pc">
        Content
      </PageContainer>
    );
    const el = screen.getByTestId("pc");
    expect(el.className).toContain("space-y-4");
    expect(el.className).not.toContain("space-y-6");
  });

  it("spreads additional HTML attributes and binds handlers", () => {
    const handler = vi.fn();
    render(
      <PageContainer data-testid="pc" onTouchStart={handler}>
        Content
      </PageContainer>
    );
    const el = screen.getByTestId("pc");
    fireEvent.touchStart(el);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("applies narrow + custom className together", () => {
    render(
      <PageContainer narrow className="space-y-8" data-testid="pc">
        Content
      </PageContainer>
    );
    const el = screen.getByTestId("pc");
    expect(el.className).toContain("max-w-3xl");
    expect(el.className).toContain("mx-auto");
    expect(el.className).toContain("space-y-8");
    expect(el.className).not.toContain("space-y-6");
  });
});
