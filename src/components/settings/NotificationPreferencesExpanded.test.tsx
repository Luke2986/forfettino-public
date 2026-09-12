/**
 * Tests for NotificationPreferencesExpanded component.
 * Story 25.3 — Preferenze Notifiche Espanse
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { NotificationPreferencesExpanded } from "./NotificationPreferencesExpanded";

// ── Mock useNotificationSettings ──

const mockUpdateSetting = vi.fn();
const mockToast = vi.fn();

let mockSettings: any = {
  master_enabled: true,
  tone: "neutro",
  has_accountant: false,
  scadenze_enabled: true,
  scadenze_email_enabled: true,
  reminder_thresholds: [30, 7, 3, 0],
  feedback_enabled: true,
  insights_enabled: true,
  admin_messages_enabled: true,
  aggiornamenti_enabled: true,
};
let mockIsLoading = false;

vi.mock("@/hooks/useNotificationSettings", () => ({
  useNotificationSettings: () => ({
    settings: mockIsLoading ? null : mockSettings,
    isLoading: mockIsLoading,
    updateSetting: mockUpdateSetting,
    isUpdating: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("NotificationPreferencesExpanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockSettings = {
      master_enabled: true,
      tone: "neutro",
      has_accountant: false,
      scadenze_enabled: true,
      scadenze_email_enabled: true,
      reminder_thresholds: [30, 7, 3, 0],
      feedback_enabled: true,
      insights_enabled: true,
      admin_messages_enabled: true,
      aggiornamenti_enabled: true,
    };
  });

  // ── Rendering 4 sections ──

  it("renders all 4 sections", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("Controllo Globale")).toBeTruthy();
    expect(screen.getByText("Personalizzazione")).toBeTruthy();
    expect(screen.getByText("Tipi di Notifica")).toBeTruthy();
    expect(screen.getByText("Canali")).toBeTruthy();
  });

  it("renders card header with title and description", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("Preferenze Notifiche")).toBeTruthy();
    expect(screen.getByText("Personalizza come e quando Forfettino ti comunica")).toBeTruthy();
  });

  // ── Loading state ──

  it("renders skeleton when loading", () => {
    mockIsLoading = true;
    const { container } = render(React.createElement(NotificationPreferencesExpanded));

    // Should NOT render section headings during loading
    expect(screen.queryByText("Controllo Globale")).toBeNull();
    // Should have skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ── Master switch ──

  it("renders master switch as ON by default", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const masterSwitch = screen.getByRole("switch", { name: "Notifiche attive" });
    expect(masterSwitch.getAttribute("data-state")).toBe("checked");
  });

  it("calls updateSetting and shows toast when master switch toggled OFF", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const masterSwitch = screen.getByRole("switch", { name: "Notifiche attive" });
    fireEvent.click(masterSwitch);

    expect(mockUpdateSetting).toHaveBeenCalledWith("master_enabled", false);
    expect(mockToast).toHaveBeenCalledWith({ title: "Tutte le notifiche disattivate" });
  });

  it("shows 'Notifiche riattivate' toast when master switch toggled ON", () => {
    mockSettings = { ...mockSettings, master_enabled: false };
    render(React.createElement(NotificationPreferencesExpanded));

    const masterSwitch = screen.getByRole("switch", { name: "Notifiche attive" });
    fireEvent.click(masterSwitch);

    expect(mockUpdateSetting).toHaveBeenCalledWith("master_enabled", true);
    expect(mockToast).toHaveBeenCalledWith({ title: "Notifiche riattivate" });
  });

  // ── Master OFF disables sections ──

  it("disables toggle sections when master is OFF", () => {
    mockSettings = { ...mockSettings, master_enabled: false };
    render(React.createElement(NotificationPreferencesExpanded));

    // Personalizzazione section
    const persHeading = screen.getByText("Personalizzazione");
    const persSection = persHeading.parentElement;
    expect(persSection?.className).toContain("opacity-50");
    expect(persSection?.className).toContain("pointer-events-none");

    // Tipi di Notifica section
    const tipiHeading = screen.getByText("Tipi di Notifica");
    const tipiSection = tipiHeading.parentElement;
    expect(tipiSection?.className).toContain("opacity-50");
    expect(tipiSection?.className).toContain("pointer-events-none");

    // Canali section
    const canaliHeading = screen.getByText("Canali");
    const canaliSection = canaliHeading.parentElement;
    expect(canaliSection?.className).toContain("opacity-50");
    expect(canaliSection?.className).toContain("pointer-events-none");
  });

  // ── Tone RadioGroup ──

  it("renders 3 tone options", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("Rassicurante")).toBeTruthy();
    expect(screen.getByText("Neutro")).toBeTruthy();
    expect(screen.getByText("Minimalista")).toBeTruthy();
  });

  it("shows tone descriptions", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("Spiegazioni dettagliate, tono amichevole")).toBeTruthy();
    expect(screen.getByText("Fatti chiari, senza enfasi")).toBeTruthy();
    expect(screen.getByText("Solo numeri e date")).toBeTruthy();
  });

  it("shows seniority note", () => {
    render(React.createElement(NotificationPreferencesExpanded));
    expect(screen.getByText(/Il default è calcolato dalla tua anzianità P.IVA/)).toBeTruthy();
  });

  // ── Accountant switch ──

  it("renders 'Ho un commercialista' switch", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const accountantSwitch = screen.getByRole("switch", { name: "Ho un commercialista" });
    expect(accountantSwitch).toBeTruthy();
    expect(accountantSwitch.getAttribute("data-state")).toBe("unchecked");
  });

  it("calls updateSetting when accountant switch toggled", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const accountantSwitch = screen.getByRole("switch", { name: "Ho un commercialista" });
    fireEvent.click(accountantSwitch);

    expect(mockUpdateSetting).toHaveBeenCalledWith("has_accountant", true);
  });

  // ── 4 notification type switches ──

  it("renders all 4 notification type switches", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByRole("switch", { name: "Scadenze fiscali" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Feedback post-scadenza" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Insights e riepiloghi" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Aggiornamenti prodotto" })).toBeTruthy();
  });

  it("reflects correct default states for notification types", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByRole("switch", { name: "Scadenze fiscali" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("switch", { name: "Feedback post-scadenza" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("switch", { name: "Insights e riepiloghi" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("switch", { name: "Aggiornamenti prodotto" }).getAttribute("data-state")).toBe("checked");
  });

  it("calls updateSetting when notification type switch toggled", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const scadenzeSwitch = screen.getByRole("switch", { name: "Scadenze fiscali" });
    fireEvent.click(scadenzeSwitch);

    expect(mockUpdateSetting).toHaveBeenCalledWith("scadenze_enabled", false);
    expect(mockToast).toHaveBeenCalledWith({ title: "Preferenze aggiornate" });
  });

  // ── Channels section ──

  it("shows in-app channel as active", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("In-app (sidebar)")).toBeTruthy();
    expect(screen.getByText("Attivo")).toBeTruthy();
  });

  // Story 84-7: Email è ora un canale ATTIVO (toggle scadenze_email_enabled).
  // Solo WhatsApp resta "In arrivo".
  it("renders Email scadenze as an active (enabled) channel switch", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("Email scadenze")).toBeTruthy();
    const emailSwitch = screen.getByRole("switch", { name: /email scadenze/i });
    expect(emailSwitch).toHaveProperty("disabled", false);
    // Riflette il valore di settings.scadenze_email_enabled (true di default)
    expect(emailSwitch.getAttribute("data-state")).toBe("checked");
  });

  it("calls updateSetting('scadenze_email_enabled', false) when Email scadenze toggled OFF", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const emailSwitch = screen.getByRole("switch", { name: /email scadenze/i });
    fireEvent.click(emailSwitch);

    expect(mockUpdateSetting).toHaveBeenCalledWith("scadenze_email_enabled", false);
    expect(mockToast).toHaveBeenCalledWith({ title: "Preferenze aggiornate" });
  });

  it("shows only WhatsApp as future channel with 'In arrivo' badge", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("WhatsApp")).toBeTruthy();

    const badges = screen.getAllByText("In arrivo");
    expect(badges.length).toBe(1);
  });

  it("WhatsApp channel switch is disabled", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    const whatsappSwitch = screen.getByRole("switch", { name: "WhatsApp" });
    expect(whatsappSwitch).toHaveProperty("disabled", true);
  });

  // Story 84-7 / M1: il canale Email è inutile se il tipo "Scadenze fiscali" è spento
  // (EF richiede scadenze_enabled ∧ scadenze_email_enabled). Lo switch va disabilitato + hint.
  it("disables Email scadenze and shows a hint when scadenze_enabled is OFF", () => {
    mockSettings.scadenze_enabled = false;
    render(React.createElement(NotificationPreferencesExpanded));

    const emailSwitch = screen.getByRole("switch", { name: /email scadenze/i });
    expect(emailSwitch).toHaveProperty("disabled", true);
    expect(
      screen.getByText(/Attiva «Scadenze fiscali» nei Tipi di Notifica/i),
    ).toBeTruthy();
  });

  // ── Story 84-10: soglie reminder email per-utente (multi-select 30/7/3/0) ──

  it("renders 4 reminder threshold checkboxes, all checked by default", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByText("Quando ricevere i promemoria")).toBeTruthy();
    for (const label of ["30 giorni prima", "7 giorni prima", "3 giorni prima", "Il giorno stesso"]) {
      const cb = screen.getByRole("checkbox", { name: label });
      expect(cb.getAttribute("data-state")).toBe("checked");
    }
  });

  it("reflects partial selection (e.g. [7,0]) from settings", () => {
    mockSettings = { ...mockSettings, reminder_thresholds: [7, 0] };
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByRole("checkbox", { name: "30 giorni prima" }).getAttribute("data-state")).toBe("unchecked");
    expect(screen.getByRole("checkbox", { name: "7 giorni prima" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("checkbox", { name: "3 giorni prima" }).getAttribute("data-state")).toBe("unchecked");
    expect(screen.getByRole("checkbox", { name: "Il giorno stesso" }).getAttribute("data-state")).toBe("checked");
  });

  it("toggling a threshold OFF calls updateSetting with the canonical-ordered remainder", () => {
    render(React.createElement(NotificationPreferencesExpanded));

    // Default [30,7,3,0]; deseleziona 7 → [30,3,0]
    fireEvent.click(screen.getByRole("checkbox", { name: "7 giorni prima" }));

    expect(mockUpdateSetting).toHaveBeenCalledWith("reminder_thresholds", [30, 3, 0]);
    expect(mockToast).toHaveBeenCalledWith({ title: "Preferenze aggiornate" });
  });

  it("toggling a threshold ON re-inserts it preserving canonical order [30,7,3,0]", () => {
    mockSettings = { ...mockSettings, reminder_thresholds: [30, 0] };
    render(React.createElement(NotificationPreferencesExpanded));

    // [30,0] + riattiva 7 → [30,7,0] (NON [30,0,7])
    fireEvent.click(screen.getByRole("checkbox", { name: "7 giorni prima" }));

    expect(mockUpdateSetting).toHaveBeenCalledWith("reminder_thresholds", [30, 7, 0]);
  });

  it("blocks deselecting the LAST remaining threshold (keeps >= 1, shows destructive toast)", () => {
    mockSettings = { ...mockSettings, reminder_thresholds: [7] };
    render(React.createElement(NotificationPreferencesExpanded));

    fireEvent.click(screen.getByRole("checkbox", { name: "7 giorni prima" }));

    expect(mockUpdateSetting).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Almeno una soglia deve restare attiva",
        variant: "destructive",
      }),
    );
  });

  it("disables threshold checkboxes when Email scadenze channel is OFF", () => {
    mockSettings = { ...mockSettings, scadenze_email_enabled: false };
    render(React.createElement(NotificationPreferencesExpanded));

    expect(screen.getByRole("checkbox", { name: "30 giorni prima" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("checkbox", { name: "Il giorno stesso" })).toHaveProperty("disabled", true);
  });
});
