/**
 * Test per NotificationPreferencesSection
 * Story 9.4 — Preferenze notifiche con 3 categorie toggle
 *
 * Copertura:
 * - AC 1: 3 toggle indipendenti per scadenze/insights/aggiornamenti
 * - AC 2: salvataggio immediato con toast (via mutation mock)
 * - AC 3: tutte le categorie sono modificabili dall'utente
 * - AC 6: default applicativi (scadenze=ON, insights=ON, aggiornamenti=ON) — opt-out model
 * - Skeleton loading state
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── Mock hook values ──

let mockPreferences: any = { scadenze: true, insights: true, aggiornamenti: true };
let mockIsLoading = false;
const mockUpdatePreference = vi.fn();
let mockIsPending = false;

vi.mock("@/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: () => ({
    data: mockPreferences,
    isLoading: mockIsLoading,
  }),
}));

vi.mock("@/hooks/useUpdateNotificationPreference", () => ({
  useUpdateNotificationPreference: () => ({
    mutate: mockUpdatePreference,
    isPending: mockIsPending,
  }),
}));

import { NotificationPreferencesSection } from "./NotificationPreferencesSection";

describe("NotificationPreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferences = { scadenze: true, insights: true, aggiornamenti: true };
    mockIsLoading = false;
    mockIsPending = false;
  });

  it("mostra 3 toggle: Scadenze, Insights, Aggiornamenti", () => {
    render(React.createElement(NotificationPreferencesSection));
    expect(screen.getByText("Scadenze fiscali")).toBeDefined();
    expect(screen.getByText("Insights")).toBeDefined();
    expect(screen.getByText("Aggiornamenti prodotto")).toBeDefined();
  });

  it("mostra titolo e descrizione card", () => {
    render(React.createElement(NotificationPreferencesSection));
    expect(screen.getByText("Preferenze Notifiche")).toBeDefined();
    expect(screen.getByText("Gestisci le notifiche che ricevi nell'app")).toBeDefined();
  });

  it("switch scadenze è checked e abilitato (modificabile)", () => {
    render(React.createElement(NotificationPreferencesSection));
    const switches = screen.getAllByRole("switch");
    const scadenzeSwitch = switches[0];
    expect(scadenzeSwitch.getAttribute("aria-checked")).toBe("true");
    expect(scadenzeSwitch).not.toBeDisabled();
  });

  it("switch scadenze chiama mutate al toggle", () => {
    render(React.createElement(NotificationPreferencesSection));
    const switches = screen.getAllByRole("switch");
    const scadenzeSwitch = switches[0];
    fireEvent.click(scadenzeSwitch);
    expect(mockUpdatePreference).toHaveBeenCalledWith({
      category: "scadenze",
      enabled: false,
    });
  });

  it("switch insights riflette la preferenza e chiama mutate al toggle", () => {
    render(React.createElement(NotificationPreferencesSection));
    const switches = screen.getAllByRole("switch");
    const insightsSwitch = switches[1];
    expect(insightsSwitch.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(insightsSwitch);
    expect(mockUpdatePreference).toHaveBeenCalledWith({
      category: "insights",
      enabled: false,
    });
  });

  it("switch aggiornamenti riflette true di default e chiama mutate", () => {
    render(React.createElement(NotificationPreferencesSection));
    const switches = screen.getAllByRole("switch");
    const aggSwitch = switches[2];
    expect(aggSwitch.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(aggSwitch);
    expect(mockUpdatePreference).toHaveBeenCalledWith({
      category: "aggiornamenti",
      enabled: false,
    });
  });

  it("disabilita tutti gli switch durante mutazione (isPending)", () => {
    mockIsPending = true;
    render(React.createElement(NotificationPreferencesSection));
    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).toBeDisabled();
    expect(switches[2]).toBeDisabled();
  });

  it("mostra skeleton loading quando isLoading=true", () => {
    mockIsLoading = true;
    const { container } = render(React.createElement(NotificationPreferencesSection));
    // Non deve mostrare i toggle
    expect(screen.queryByText("Scadenze fiscali")).toBeNull();
    // Deve mostrare skeleton (3 skeleton rows per i toggle)
    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
