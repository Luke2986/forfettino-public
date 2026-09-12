import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));

import { useIsMobile } from "@/hooks/use-mobile";
import { BannerStack } from "./BannerStack";

const mockUseIsMobile = useIsMobile as ReturnType<typeof vi.fn>;

describe("BannerStack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Desktop: renderizza tutti i children ──
  it("renders all children on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);

    render(
      <BannerStack>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
        <div data-testid="banner-4">Banner 4</div>
      </BannerStack>
    );

    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.getByTestId("banner-2")).toBeInTheDocument();
    expect(screen.getByTestId("banner-3")).toBeInTheDocument();
    expect(screen.getByTestId("banner-4")).toBeInTheDocument();
    expect(screen.queryByText(/altri avvisi/)).not.toBeInTheDocument();
  });

  // ── 2. Mobile con <= limit: renderizza tutti, nessun toggle ──
  it("renders all children on mobile when count <= limit", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={2}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
      </BannerStack>
    );

    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.getByTestId("banner-2")).toBeInTheDocument();
    expect(screen.queryByText(/altri avvisi/)).not.toBeInTheDocument();
  });

  // ── 3. Mobile > limit: mostra primi 2 + toggle ──
  it("shows first 2 banners and toggle on mobile with overflow", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={2}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
        <div data-testid="banner-4">Banner 4</div>
      </BannerStack>
    );

    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.getByTestId("banner-2")).toBeInTheDocument();
    expect(screen.queryByTestId("banner-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("banner-4")).not.toBeInTheDocument();
    expect(screen.getByText("2 altri avvisi")).toBeInTheDocument();
  });

  // ── 4. Expand: click toggle mostra tutti i banner ──
  it("expands to show all banners when toggle is clicked", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={2}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
        <div data-testid="banner-4">Banner 4</div>
      </BannerStack>
    );

    fireEvent.click(screen.getByText("2 altri avvisi"));

    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.getByTestId("banner-2")).toBeInTheDocument();
    expect(screen.getByTestId("banner-3")).toBeInTheDocument();
    expect(screen.getByTestId("banner-4")).toBeInTheDocument();
    expect(screen.getByText("Nascondi avvisi")).toBeInTheDocument();
  });

  // ── 5. Collapse: click nascondi ri-collassa ──
  it("collapses back to limit when hide is clicked", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={2}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
        <div data-testid="banner-4">Banner 4</div>
      </BannerStack>
    );

    // Expand
    fireEvent.click(screen.getByText("2 altri avvisi"));
    // Collapse
    fireEvent.click(screen.getByText("Nascondi avvisi"));

    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.getByTestId("banner-2")).toBeInTheDocument();
    expect(screen.queryByTestId("banner-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("banner-4")).not.toBeInTheDocument();
    expect(screen.getByText("2 altri avvisi")).toBeInTheDocument();
  });

  // ── 6. Filtra null children ──
  it("filters out null/false children and does not show toggle", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={2}>
        <div data-testid="banner-1">Banner 1</div>
        {/* eslint-disable-next-line no-constant-binary-expression */}
        {false && <div data-testid="banner-2">Banner 2</div>}
        {null}
        <div data-testid="banner-3">Banner 3</div>
        {undefined}
      </BannerStack>
    );

    // Only 2 valid children (banner-1 and banner-3), <= limit → no toggle
    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.getByTestId("banner-3")).toBeInTheDocument();
    expect(screen.queryByText(/altri avvisi/)).not.toBeInTheDocument();
  });

  // ── 7. ARIA attributes ──
  it("has correct aria-expanded attributes", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={1}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
      </BannerStack>
    );

    // Collapsed: aria-expanded="false"
    const expandBtn = screen.getByRole("button", { name: /Mostra 2 altri avvisi/ });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");

    // Expand
    fireEvent.click(expandBtn);

    // Expanded: aria-expanded="true"
    const collapseBtn = screen.getByRole("button", { name: /Nascondi avvisi/ });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
  });

  // ── 8. Custom mobileLimit ──
  it("respects custom mobileLimit={1}", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={1}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
      </BannerStack>
    );

    expect(screen.getByTestId("banner-1")).toBeInTheDocument();
    expect(screen.queryByTestId("banner-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("banner-3")).not.toBeInTheDocument();
    expect(screen.getByText("2 altri avvisi")).toBeInTheDocument();
  });

  // ── 9. Singular form for 1 hidden banner ──
  it("shows singular form for 1 hidden banner", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={2}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
      </BannerStack>
    );

    expect(screen.getByText("1 altro avviso")).toBeInTheDocument();
  });

  // ── 10. ARIA region on mobile overflow ──
  it("wraps mobile overflow in role=region with aria-live", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={1}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
      </BannerStack>
    );

    const region = screen.getByRole("region", { name: "Avvisi" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  // ── 11. aria-controls on toggle buttons ──
  it("has aria-controls on expand/collapse buttons", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <BannerStack mobileLimit={1}>
        <div data-testid="banner-1">Banner 1</div>
        <div data-testid="banner-2">Banner 2</div>
        <div data-testid="banner-3">Banner 3</div>
      </BannerStack>
    );

    // Expand button
    const expandBtn = screen.getByRole("button", { name: /Mostra 2 altri avvisi/ });
    expect(expandBtn).toHaveAttribute("aria-controls", "banner-hidden-content");

    // Expand
    fireEvent.click(expandBtn);

    // Collapse button
    const collapseBtn = screen.getByRole("button", { name: /Nascondi avvisi/ });
    expect(collapseBtn).toHaveAttribute("aria-controls", "banner-hidden-content");
  });
});
