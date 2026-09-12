/**
 * Test per ReceiptLimitDialog.tsx
 * Story 6.4 — Enforcement Limiti Free Tier
 * Updated: Story 13.15 — Free-only strategy (removed Pro feature list)
 *
 * Copertura:
 * - AC 7: Dialog bloccante al raggiungimento limite
 * - Titolo "Limite incassi raggiunto"
 * - Messaggio community futura (no Pro features)
 * - CTA "Vedi il tuo piano" naviga a /impostazioni?tab=abbonamento
 * - Bottone "Chiudi" chiude il dialog
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

let mockReceiptsLimit = 10;
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    receiptsLimit: mockReceiptsLimit,
  }),
}));

import { ReceiptLimitDialog } from "./ReceiptLimitDialog";

function renderDialog(open: boolean, onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ReceiptLimitDialog, { open, onOpenChange })
      )
    ),
  };
}

describe("ReceiptLimitDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReceiptsLimit = 10;
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("Limite incassi raggiunto")).toBeNull();
  });

  it("shows title and limit message when open", () => {
    renderDialog(true);
    expect(screen.getByText("Limite incassi raggiunto")).toBeDefined();
    expect(screen.getByText(/10 incassi manuali/)).toBeDefined();
  });

  it("shows community future message (no Pro feature list)", () => {
    renderDialog(true);
    expect(screen.getByText(/community dei Forfettini/)).toBeDefined();
    // No Pro references
    expect(screen.queryByText("Funzioni Pro:")).toBeNull();
    expect(screen.queryByText("Incassi illimitati")).toBeNull();
    expect(screen.queryByText("Passa a Pro")).toBeNull();
  });

  it("CTA 'Vedi il tuo piano' navigates to /impostazioni?tab=abbonamento and closes dialog", () => {
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    const ctaBtn = screen.getByText("Vedi il tuo piano");
    fireEvent.click(ctaBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith("/impostazioni?tab=abbonamento");
  });

  it("Chiudi button closes dialog without navigating", () => {
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    fireEvent.click(screen.getByTestId("receipt-limit-close-btn"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not render when receiptsLimit is Infinity", () => {
    mockReceiptsLimit = Infinity;
    renderDialog(true);
    expect(screen.queryByText("Limite incassi raggiunto")).toBeNull();
    expect(screen.queryByText(/Infinity/)).toBeNull();
  });
});
