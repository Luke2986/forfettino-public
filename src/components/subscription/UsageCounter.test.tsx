/**
 * Test per UsageCounter.tsx
 * Story 6.4 — Enforcement Limiti Free Tier
 *
 * Copertura:
 * - AC 5: UsageCounter mostra N/10 per Free con color-coding
 * - Pro → hidden
 * - Compact variant
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

let mockIsPro = false;
let mockIsStudio = false;
let mockReceiptsUsed = 0;
let mockReceiptsLimit = 10;
let mockImportsUsed = 0;
let mockImportsLimit = 10;
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isPro: mockIsPro,
    isStudio: mockIsStudio,
    receiptsUsed: mockReceiptsUsed,
    receiptsLimit: mockReceiptsLimit,
    importsUsed: mockImportsUsed,
    importsLimit: mockImportsLimit,
  }),
}));

import { UsageCounter } from "./UsageCounter";

describe("UsageCounter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockIsStudio = false;
    mockReceiptsUsed = 3;
    mockReceiptsLimit = 10;
    mockImportsUsed = 0;
    mockImportsLimit = 10;
  });

  it("does not render for Pro users", () => {
    mockIsPro = true;
    const { container } = render(React.createElement(UsageCounter));
    expect(container.innerHTML).toBe("");
  });

  it("does not render for Studio users", () => {
    mockIsStudio = true;
    const { container } = render(React.createElement(UsageCounter));
    expect(container.innerHTML).toBe("");
  });

  it("shows receipt usage N / 10 for Free users", () => {
    mockReceiptsUsed = 3;
    render(React.createElement(UsageCounter));
    expect(screen.getByText("Incassi totali")).toBeDefined();
    expect(screen.getByText("3 / 10")).toBeDefined();
  });

  it("shows import usage N / 10 for Free users", () => {
    mockImportsUsed = 2;
    render(React.createElement(UsageCounter));
    expect(screen.getByText("Import XML")).toBeDefined();
    expect(screen.getByText("2 / 10")).toBeDefined();
  });

  it("shows green progress bar when usage < 60%", () => {
    mockReceiptsUsed = 5; // 50%
    const { container } = render(React.createElement(UsageCounter));
    const bars = container.querySelectorAll("[class*='bg-success']");
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it("shows amber progress bar when usage >= 60% and < 90%", () => {
    mockReceiptsUsed = 7; // 70%
    const { container } = render(React.createElement(UsageCounter));
    const bars = container.querySelectorAll("[class*='bg-warning']");
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it("shows red progress bar when usage >= 90%", () => {
    mockReceiptsUsed = 9; // 90%
    const { container } = render(React.createElement(UsageCounter));
    const bars = container.querySelectorAll("[class*='bg-destructive']");
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it("renders compact variant without Card wrapper", () => {
    const { container } = render(React.createElement(UsageCounter, { compact: true }));
    // Compact: no Card element (no data-slot="card" or similar)
    // Should still show the content
    expect(screen.getByText("Incassi totali")).toBeDefined();
    // No card wrapper — the immediate child should be a div, not a card
    const firstChild = container.firstElementChild;
    expect(firstChild?.tagName).toBe("DIV");
  });
});
