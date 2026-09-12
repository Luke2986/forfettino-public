/**
 * Test per GoogleCalendarConnect.tsx
 * Story 48.3 — Google OAuth Flow e Token Storage
 *
 * Copertura:
 * - Stato disconnesso: bottone "Collega Google Calendar" visibile
 * - Stato connesso: email provider visibile, nessun bottone "Collega"
 * - Stato denial: messaggio "Collegamento annullato" visibile con bottone Riprova
 * - Stato loading: skeleton visibile
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleCalendarConnect } from "../GoogleCalendarConnect";

// Mock useCalendarConnection with configurable state
const mockConnectGoogle = vi.fn();
const mockUseCalendarConnection = vi.fn();

vi.mock("@/hooks/useCalendarConnection", () => ({
  useCalendarConnection: () => mockUseCalendarConnection(),
}));

// Mock formatDateIT
vi.mock("@/lib/schedule-helpers", () => ({
  formatDateIT: (d: string) => d.split("T")[0],
}));

function renderWithProviders(denied = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GoogleCalendarConnect denied={denied} />
    </QueryClientProvider>
  );
}

describe("GoogleCalendarConnect", () => {
  describe("Stato disconnesso", () => {
    it("mostra bottone 'Collega Google Calendar' e value prop", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: null,
        isConnected: false,
        connectionStatus: null,
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      expect(
        screen.getByText("Google Calendar")
      ).toBeInTheDocument();
      expect(
        screen.getByText("In arrivo")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Presto potrai visualizzare/)
      ).toBeInTheDocument();
      const button = screen.getByText("Collega Google Calendar").closest("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Stato connesso", () => {
    it("mostra email provider e 'Google Calendar collegato'", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "active",
          created_at: "2026-03-25T10:00:00Z",
          last_synced_at: null,
        },
        isConnected: true,
        connectionStatus: "active",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      expect(
        screen.getByText("Google Calendar collegato")
      ).toBeInTheDocument();
      expect(screen.getByText(/user@gmail\.com/)).toBeInTheDocument();
      // No "Collega" button in connected state
      expect(
        screen.queryByText("Collega Google Calendar")
      ).not.toBeInTheDocument();
    });
  });

  describe("Stato denial (prop denied)", () => {
    it("mostra messaggio annullamento e bottone Riprova", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: null,
        isConnected: false,
        connectionStatus: null,
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders(true);

      expect(
        screen.getByText(/Collegamento annullato/)
      ).toBeInTheDocument();
      expect(screen.getByText("Riprova")).toBeInTheDocument();
    });
  });

  describe("Stato denial (hook error)", () => {
    it("mostra messaggio annullamento quando hook ha errore", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: null,
        isConnected: false,
        connectionStatus: null,
        isLoading: false,
        error: new Error("Callback failed"),
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      expect(
        screen.getByText(/Collegamento annullato/)
      ).toBeInTheDocument();
      expect(screen.getByText("Riprova")).toBeInTheDocument();
    });
  });

  describe("Stato error (dal DB)", () => {
    it("mostra banner amber con 'non e' piu' attiva' e bottone Ricollega", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "error",
        },
        isConnected: false,
        connectionStatus: "error",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      expect(
        screen.getByText(/non e' piu' attiva/)
      ).toBeInTheDocument();
      expect(screen.getByText(/user@gmail\.com/)).toBeInTheDocument();
      expect(screen.getByText("Ricollega")).toBeInTheDocument();
      expect(
        screen.queryByText("Collega Google Calendar")
      ).not.toBeInTheDocument();
    });
  });

  describe("Stato revoked (dal DB)", () => {
    it("mostra stesso banner di error con Ricollega", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "revoked",
        },
        isConnected: false,
        connectionStatus: "revoked",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      expect(
        screen.getByText(/non e' piu' attiva/)
      ).toBeInTheDocument();
      expect(screen.getByText("Ricollega")).toBeInTheDocument();
    });
  });

  describe("Riconnessione", () => {
    it("da stato error, click Ricollega chiama connectGoogle", async () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "error",
        },
        isConnected: false,
        connectionStatus: "error",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      const ricollegaBtn = screen.getByText("Ricollega");
      ricollegaBtn.click();
      expect(mockConnectGoogle).toHaveBeenCalled();
    });
  });

  describe("Disconnessione", () => {
    it("mostra bottone Disconnetti nello stato connesso", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "active",
          last_synced_at: null,
        },
        isConnected: true,
        connectionStatus: "active",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      expect(screen.getByText("Disconnetti")).toBeInTheDocument();
    });

    it("click Disconnetti apre AlertDialog di conferma", async () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "active",
          last_synced_at: null,
        },
        isConnected: true,
        connectionStatus: "active",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      const disconnectBtn = screen.getByText("Disconnetti");
      fireEvent.click(disconnectBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Disconnetti Google Calendar?")
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Gli eventi Google verranno rimossi/)
      ).toBeInTheDocument();
      expect(screen.getByText("Annulla")).toBeInTheDocument();
    });

    it("conferma AlertDialog chiama disconnectGoogle", async () => {
      const mockDisconnect = vi.fn();
      mockUseCalendarConnection.mockReturnValue({
        connection: {
          id: "conn-1",
          provider_email: "user@gmail.com",
          status: "active",
          last_synced_at: null,
        },
        isConnected: true,
        connectionStatus: "active",
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: mockDisconnect,
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      renderWithProviders();

      // Open AlertDialog
      fireEvent.click(screen.getByText("Disconnetti"));

      await waitFor(() => {
        expect(screen.getByText("Disconnetti Google Calendar?")).toBeInTheDocument();
      });

      // Click confirm action inside AlertDialog (the second "Disconnetti" button)
      const confirmButtons = screen.getAllByText("Disconnetti");
      const confirmBtn = confirmButtons[confirmButtons.length - 1]; // Last one is the AlertDialogAction
      fireEvent.click(confirmBtn);

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("Stato loading", () => {
    it("mostra skeleton durante caricamento iniziale", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: null,
        isConnected: false,
        connectionStatus: null,
        isLoading: true,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: false,
      });

      const { container } = renderWithProviders();

      // Skeleton elements should be rendered
      const skeletons = container.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("mostra skeleton durante callback processing", () => {
      mockUseCalendarConnection.mockReturnValue({
        connection: null,
        isConnected: false,
        connectionStatus: null,
        isLoading: false,
        error: null,
        connectGoogle: mockConnectGoogle,
        disconnectGoogle: vi.fn(),
        isDisconnecting: false,
        isCallbackLoading: true,
      });

      const { container } = renderWithProviders();

      const skeletons = container.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
