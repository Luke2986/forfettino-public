/**
 * Test per ReceiptLimitBanner.tsx
 * Story 6.4 — Enforcement Limiti Free Tier
 *
 * Copertura:
 * - AC 6: Banner appare quando receiptsUsed >= 80% del limite
 * - Variante warning (80-99%) vs destructive (100%)
 * - Pro user → hidden
 * - CTA "Vedi piano" naviga a /impostazioni?tab=abbonamento
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockIsPro = false;
let mockIsStudio = false;
let mockReceiptsUsed = 0;
let mockReceiptsLimit = 10;
let mockCanAddReceipt = true;
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isPro: mockIsPro,
    isStudio: mockIsStudio,
    receiptsUsed: mockReceiptsUsed,
    receiptsLimit: mockReceiptsLimit,
    canAddReceipt: mockCanAddReceipt,
  }),
}));

import { ReceiptLimitBanner } from "./ReceiptLimitBanner";

function renderBanner() {
  return render(
    React.createElement(MemoryRouter, null, React.createElement(ReceiptLimitBanner))
  );
}

describe("ReceiptLimitBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPro = false;
    mockIsStudio = false;
    mockReceiptsUsed = 0;
    mockReceiptsLimit = 10;
    mockCanAddReceipt = true;
  });

  it("does not render for Pro users", () => {
    mockIsPro = true;
    mockReceiptsUsed = 10;
    renderBanner();
    expect(screen.queryByText(/incassi/)).toBeNull();
  });

  it("does not render for Studio users", () => {
    mockIsStudio = true;
    mockReceiptsUsed = 10;
    renderBanner();
    expect(screen.queryByText(/incassi/)).toBeNull();
  });

  it("does not render when usage is below 80%", () => {
    mockReceiptsUsed = 7; // 70%
    renderBanner();
    expect(screen.queryByText(/incassi/)).toBeNull();
  });

  it("shows warning banner with default variant when usage is at 80%", () => {
    mockReceiptsUsed = 8; // 80%
    renderBanner();
    expect(screen.getByText(/Hai usato/)).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    // Default variant — bg-background, no border-destructive
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-background");
    expect(alert.className).not.toContain("border-destructive");
  });

  it("shows warning banner at 90%", () => {
    mockReceiptsUsed = 9;
    renderBanner();
    expect(screen.getByText(/Hai usato/)).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
  });

  it("shows destructive variant banner when at limit (canAddReceipt=false)", () => {
    mockReceiptsUsed = 10;
    mockCanAddReceipt = false;
    renderBanner();
    expect(screen.getByText(/Hai raggiunto il limite/)).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    // Destructive variant — border-destructive class present
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-destructive");
  });

  it("CTA 'Vedi piano' navigates to /impostazioni?tab=abbonamento", () => {
    mockReceiptsUsed = 8;
    renderBanner();
    const ctaBtn = screen.getByText("Vedi piano");
    expect(ctaBtn).toBeDefined();
    fireEvent.click(ctaBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/impostazioni?tab=abbonamento");
  });

  it("does not render when receiptsLimit is Infinity", () => {
    mockReceiptsLimit = Infinity;
    mockReceiptsUsed = 50;
    renderBanner();
    expect(screen.queryByText(/incassi/)).toBeNull();
  });
});
