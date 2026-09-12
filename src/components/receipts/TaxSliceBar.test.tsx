/**
 * Test per TaxSliceBar.tsx
 * Story 10.1 — Tax Slice Istantanea
 *
 * Copertura:
 * - Task 4.2: Rendering con valori standard
 * - Task 4.3: Percentuali corrette nei segmenti (larghezze CSS)
 * - Task 4.4: Fallback per valori null
 * - Task 4.5: Accessibilita: aria-label con percentuali
 * - Task 4.6: Tooltip educativo visibile al hover/focus
 * - Task 4.7: Nota INPS fisso per gestione Art/Comm
 * - Task 4.8: Layout compact mode
 * - Task 4.9: Valori zero (gross=0 o net=0)
 * - Task 4.10: Coerenza: net + tax + inps = gross (invariante)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TaxSliceBar, TaxSliceBarProps } from "./TaxSliceBar";

function renderBar(props: Partial<TaxSliceBarProps> = {}) {
  const defaultProps: TaxSliceBarProps = {
    grossAmount: 1000,
    taxAmount: 50,
    inpsAmount: 200,
    netSpendable: 750,
    gestione: "separata",
    compact: false,
  };
  return render(React.createElement(TaxSliceBar, { ...defaultProps, ...props }));
}

describe("TaxSliceBar", () => {
  // ===== Task 4.2: Rendering con valori standard =====

  describe("Task 4.2: Rendering con valori standard", () => {
    it("renders 3 bar segments", () => {
      const { container } = renderBar();

      const bar = container.querySelector("[role='img']");
      expect(bar).not.toBeNull();

      // 3 child divs = 3 segments
      const segments = bar!.children;
      expect(segments.length).toBe(3);
    });

    it("renders net and debt labels below bar", () => {
      renderBar();

      // Net label: formatCurrency(750) — jsdom Intl may produce different format
      // Debt label: formatCurrency(50 + 200 = 250)
      const successLabels = document.querySelectorAll(".text-success");
      expect(successLabels.length).toBe(1);

      const zincLabels = document.querySelectorAll("span.text-slate-500");
      expect(zincLabels.length).toBe(1);
    });

    it("shows correct currency values in labels", () => {
      const { container } = renderBar({
        grossAmount: 1000,
        taxAmount: 50,
        inpsAmount: 200,
        netSpendable: 750,
      });

      // Net label should contain 750
      const successLabel = container.querySelector(".text-success");
      expect(successLabel?.textContent).toMatch(/750/);

      // Debt label should contain 250 (50 + 200)
      const zincLabel = container.querySelector("span.text-slate-500");
      expect(zincLabel?.textContent).toMatch(/250/);
    });
  });

  // ===== Task 4.3: Percentuali corrette nei segmenti =====

  describe("Task 4.3: Percentuali corrette nei segmenti", () => {
    it("segments have correct width percentages", () => {
      const { container } = renderBar({
        grossAmount: 1000,
        taxAmount: 50,
        inpsAmount: 200,
        netSpendable: 750,
      });

      const bar = container.querySelector("[role='img']");
      const segments = Array.from(bar!.children) as HTMLElement[];

      // Net: 750/1000 = 75%
      expect(segments[0].style.width).toBe("75%");
      // Tax: 50/1000 = 5%
      expect(segments[1].style.width).toBe("5%");
      // INPS: 200/1000 = 20%
      expect(segments[2].style.width).toBe("20%");
    });

    it("segments use correct colors", () => {
      const { container } = renderBar();

      const bar = container.querySelector("[role='img']");
      const segments = Array.from(bar!.children) as HTMLElement[];

      expect(segments[0].className).toContain("bg-success");
      expect(segments[1].className).toContain("bg-slate-600");
      expect(segments[2].className).toContain("bg-slate-300");
    });

    it("adjusts net percent when total does not round to 100", () => {
      // Use values where net + tax + inps ≠ gross (centesimi rounding)
      // gross=333, tax=17, inps=43, net=272 → 17+43+272=332 ≠ 333
      // raw percentages: 81.68%, 5.11%, 12.91% → total=99.70% ≠ 100
      // adjustment adds residual (0.30%) to net segment
      const { container } = renderBar({
        grossAmount: 333,
        taxAmount: 17,
        inpsAmount: 43,
        netSpendable: 272,
      });

      const bar = container.querySelector("[role='img']");
      const segments = Array.from(bar!.children) as HTMLElement[];

      // All segments should have widths
      expect(parseFloat(segments[0].style.width)).toBeGreaterThan(0);
      expect(parseFloat(segments[1].style.width)).toBeGreaterThan(0);
      expect(parseFloat(segments[2].style.width)).toBeGreaterThan(0);

      // Total should be 100%
      const total =
        parseFloat(segments[0].style.width) +
        parseFloat(segments[1].style.width) +
        parseFloat(segments[2].style.width);
      expect(total).toBeCloseTo(100, 1);
    });
  });

  // ===== Task 4.4: Fallback per valori null =====

  describe("Task 4.4: Fallback per valori null", () => {
    it("returns null when taxAmount is null", () => {
      const { container } = renderBar({ taxAmount: null });
      expect(container.querySelector("[role='img']")).toBeNull();
    });

    it("returns null when inpsAmount is null", () => {
      const { container } = renderBar({ inpsAmount: null });
      expect(container.querySelector("[role='img']")).toBeNull();
    });

    it("returns null when netSpendable is null", () => {
      const { container } = renderBar({ netSpendable: null });
      expect(container.querySelector("[role='img']")).toBeNull();
    });

    it("returns null when all fiscal fields are null", () => {
      const { container } = renderBar({
        taxAmount: null,
        inpsAmount: null,
        netSpendable: null,
      });
      expect(container.querySelector("[role='img']")).toBeNull();
    });
  });

  // ===== Task 4.5: Accessibilita: aria-label =====

  describe("Task 4.5: Accessibilita aria-label", () => {
    it("bar has role=img and aria-label with percentages", () => {
      const { container } = renderBar({
        grossAmount: 1000,
        taxAmount: 50,
        inpsAmount: 200,
        netSpendable: 750,
      });

      const bar = container.querySelector("[role='img']");
      expect(bar).not.toBeNull();

      const label = bar!.getAttribute("aria-label")!;
      expect(label).toContain("Ripartizione");
      expect(label).toContain("75%");
      expect(label).toContain("spendibile");
      expect(label).toContain("5%");
      expect(label).toContain("imposta");
      expect(label).toContain("20%");
      expect(label).toContain("INPS");
    });
  });

  // ===== Task 4.6: Tooltip educativo =====

  describe("Task 4.6: Tooltip educativo", () => {
    it("tooltip trigger wraps the bar (data-state attribute present)", () => {
      const { container } = renderBar();

      // Radix Tooltip adds data-state to the trigger element
      const trigger = container.querySelector("[data-state]");
      expect(trigger).not.toBeNull();

      // The bar should be inside the trigger
      const bar = trigger!.querySelector("[role='img']");
      expect(bar).not.toBeNull();
    });

    it("bar is wrapped in TooltipProvider structure", () => {
      const { container } = renderBar({ gestione: "separata" });

      // Verify the Radix tooltip structure exists
      const trigger = container.querySelector("[data-state]");
      expect(trigger).not.toBeNull();

      // The bar renders inside the trigger
      expect(container.querySelector("[role='img']")).not.toBeNull();

      // Note: TooltipContent text ("Verde = ...", "Grigio = ...") is NOT testable
      // in jsdom because Radix lazy-renders it only on hover via portal.
      // Tooltip content verification requires E2E tests (Playwright/Cypress).
    });
  });

  // ===== Task 4.7: Nota INPS fisso per gestione Art/Comm =====
  // Note: Radix TooltipContent renders via portal and is NOT accessible in jsdom
  // when tooltip is closed. We test the conditional logic via data attributes
  // that mirror the internal isArtComm flag.

  describe("Task 4.7: Nota INPS fisso per Art/Comm", () => {
    it("data-has-inps-note=true for gestione=artigiani", () => {
      const { container } = renderBar({ gestione: "artigiani" });

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.dataset.hasInpsNote).toBe("true");
      expect(wrapper.dataset.gestione).toBe("artigiani");
    });

    it("data-has-inps-note=true for gestione=commercianti", () => {
      const { container } = renderBar({ gestione: "commercianti" });

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.dataset.hasInpsNote).toBe("true");
      expect(wrapper.dataset.gestione).toBe("commercianti");
    });

    it("data-has-inps-note=false for gestione=separata", () => {
      const { container } = renderBar({ gestione: "separata" });

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.dataset.hasInpsNote).toBe("false");
      expect(wrapper.dataset.gestione).toBe("separata");
    });

    it("data-has-inps-note=false when gestione is undefined", () => {
      const { container } = renderBar({ gestione: undefined });

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.dataset.hasInpsNote).toBe("false");
      expect(wrapper.dataset.gestione).toBe("none");
    });
  });

  // ===== Task 4.8: Layout compact mode =====

  describe("Task 4.8: Layout compact mode", () => {
    it("compact mode does not render currency labels below bar", () => {
      const { container } = renderBar({ compact: true });

      // Bar should render
      expect(container.querySelector("[role='img']")).not.toBeNull();

      // Currency labels (non-compact) are rendered with tabular-nums — should NOT be present in compact mode
      // (compact mode renders only percentage labels, no currency)
      const currencyLabel = container.querySelector("span.text-slate-500.tabular-nums");
      expect(currencyLabel).toBeNull();
    });

    it("non-compact mode renders labels below bar", () => {
      const { container } = renderBar({ compact: false });

      expect(container.querySelector(".text-success")).not.toBeNull();
    });

    it("compact mode renders percentage labels below bar", () => {
      const { container } = renderBar({
        compact: true,
        grossAmount: 1000,
        taxAmount: 50,
        inpsAmount: 200,
        netSpendable: 750,
      });

      const compactLabels = container.querySelector("[data-testid='compact-labels']");
      expect(compactLabels).not.toBeNull();
      expect(compactLabels!.textContent).toContain("75%");
      expect(compactLabels!.textContent).toContain("5%");
      expect(compactLabels!.textContent).toContain("20%");
    });

    it("compact mode does not render currency labels", () => {
      const { container } = renderBar({ compact: true });

      // Currency labels (non-compact) are rendered with tabular-nums — absent in compact mode
      expect(container.querySelector("span.text-slate-500.tabular-nums")).toBeNull();
    });
  });

  // ===== Task 4.9: Valori zero =====

  describe("Task 4.9: Valori zero", () => {
    it("returns null when grossAmount is 0", () => {
      const { container } = renderBar({
        grossAmount: 0,
        taxAmount: 0,
        inpsAmount: 0,
        netSpendable: 0,
      });
      expect(container.querySelector("[role='img']")).toBeNull();
    });

    it("handles net=0 (all goes to tax+inps)", () => {
      const { container } = renderBar({
        grossAmount: 1000,
        taxAmount: 600,
        inpsAmount: 400,
        netSpendable: 0,
      });

      // Should still render (gross > 0)
      const bar = container.querySelector("[role='img']");
      expect(bar).not.toBeNull();

      const segments = Array.from(bar!.children) as HTMLElement[];
      // Net segment: 0%
      expect(segments[0].style.width).toBe("0%");
      // Tax: 60%
      expect(segments[1].style.width).toBe("60%");
      // INPS: 40%
      expect(segments[2].style.width).toBe("40%");
    });
  });

  // ===== M1 Review Fix: Clamp percentages to [0,100] =====

  describe("Review Fix M1: Clamp percentages for corrupted data", () => {
    it("clamps negative netSpendable to 0% width", () => {
      // Corrupted data: net is negative (tax+inps > gross)
      const { container } = renderBar({
        grossAmount: 100,
        taxAmount: 60,
        inpsAmount: 50,
        netSpendable: -10,
      });

      const bar = container.querySelector("[role='img']");
      expect(bar).not.toBeNull();

      const segments = Array.from(bar!.children) as HTMLElement[];
      // Net segment clamped to 0%
      expect(parseFloat(segments[0].style.width)).toBe(0);
      // Tax and INPS still render
      expect(parseFloat(segments[1].style.width)).toBeGreaterThan(0);
      expect(parseFloat(segments[2].style.width)).toBeGreaterThan(0);
    });
  });

  // ===== Task 4.10: Coerenza invariante =====

  describe("Task 4.10: Coerenza net + tax + inps = gross", () => {
    it("segment widths always sum to ~100%", () => {
      const testCases: TaxSliceBarProps[] = [
        { grossAmount: 1000, taxAmount: 50, inpsAmount: 200, netSpendable: 750 },
        { grossAmount: 5000, taxAmount: 167.5, inpsAmount: 873.23, netSpendable: 3959.27 },
        { grossAmount: 100, taxAmount: 3, inpsAmount: 17, netSpendable: 80 },
        { grossAmount: 999.99, taxAmount: 50.01, inpsAmount: 260.53, netSpendable: 689.45 },
      ];

      for (const props of testCases) {
        const { container, unmount } = render(
          React.createElement(TaxSliceBar, props)
        );

        const bar = container.querySelector("[role='img']");
        expect(bar).not.toBeNull();

        const segments = Array.from(bar!.children) as HTMLElement[];
        const total =
          parseFloat(segments[0].style.width) +
          parseFloat(segments[1].style.width) +
          parseFloat(segments[2].style.width);

        expect(total).toBeCloseTo(100, 0);
        unmount();
      }
    });
  });
});
