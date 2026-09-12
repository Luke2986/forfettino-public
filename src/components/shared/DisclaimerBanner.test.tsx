import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisclaimerBanner } from "./DisclaimerBanner";

describe("DisclaimerBanner", () => {
  it("renders the disclaimer text", () => {
    render(<DisclaimerBanner />);
    expect(
      screen.getByText(
        "Stime indicative per la tua pianificazione. Non sostituiscono la consulenza del commercialista."
      )
    ).toBeInTheDocument();
  });

  it("renders the Info icon", () => {
    const { container } = render(<DisclaimerBanner />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies default styling classes", () => {
    const { container } = render(<DisclaimerBanner />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("text-xs");
    expect(wrapper.className).toContain("text-v2-text-tertiary");
  });

  it("accepts and applies custom className", () => {
    const { container } = render(<DisclaimerBanner className="mt-4 mb-2" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("mt-4");
    expect(wrapper.className).toContain("mb-2");
  });

  it("uses a flex layout with gap for icon and text", () => {
    const { container } = render(<DisclaimerBanner />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("gap-2");
  });
});
