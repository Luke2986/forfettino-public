/**
 * Test per NotificationPreferencesExpanded
 *
 * Il toggle "Contattami via email" (feedback_email_consent) è stato rimosso.
 * Il consenso email marketing è ora gestito SOLO da PrivacyDataSection
 * (toggle "Email di marketing" → marketing_email_consent).
 *
 * Copertura:
 * - Componente renderizzato senza il vecchio toggle feedback email
 * - Controllo globale, personalizzazione e tipi notifica ancora presenti
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/hooks/useNotificationSettings", () => ({
  useNotificationSettings: () => ({
    settings: {
      master_enabled: true,
      tone: "neutro",
      has_accountant: false,
      scadenze_enabled: true,
      scadenze_email_enabled: true,
      reminder_thresholds: [30, 7, 3, 0],
      feedback_enabled: true,
      insights_enabled: true,
      aggiornamenti_enabled: true,
    },
    isLoading: false,
    updateSetting: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

import { NotificationPreferencesExpanded } from "../NotificationPreferencesExpanded";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("NotificationPreferencesExpanded", () => {
  it("does NOT render the old feedback email consent toggle", () => {
    render(<NotificationPreferencesExpanded />, { wrapper: createWrapper() });

    expect(screen.queryByLabelText("Contattami via email")).not.toBeInTheDocument();
    expect(screen.queryByText("Email per sondaggi")).not.toBeInTheDocument();
  });

  it("renders notification type toggles", () => {
    render(<NotificationPreferencesExpanded />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Notifiche attive")).toBeInTheDocument();
    expect(screen.getByLabelText("Scadenze fiscali")).toBeInTheDocument();
    expect(screen.getByLabelText("Aggiornamenti prodotto")).toBeInTheDocument();
  });

  it("renders tone personalization", () => {
    render(<NotificationPreferencesExpanded />, { wrapper: createWrapper() });

    expect(screen.getByText("Rassicurante")).toBeInTheDocument();
    expect(screen.getByText("Neutro")).toBeInTheDocument();
    expect(screen.getByText("Minimalista")).toBeInTheDocument();
  });
});
