/**
 * Test per OtpGate.tsx
 * Story 67.1 — OTP Smart Gate Client-Side
 *
 * Copertura:
 * - Sessione recente (OTP verificato di recente) → passa children
 * - Sessione vecchia (> 14gg) → mostra gate OTP
 * - Mai verificato (null) → mostra gate OTP
 * - OAuth login (no was_password_login) → skip, passa children
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const { mockUser, mockProfile, mockSendOtp, mockVerifyOtp, mockSupabaseUpdate, mockInvalidateQueries, mockIsDeviceTrusted, mockSaveDeviceTrust, mockDeviceTrustEnabled, mockOtpThresholdDays } = vi.hoisted(() => ({
  mockUser: { current: { id: "u1", email: "test@example.com" } as any },
  mockProfile: { current: { last_otp_verified_at: null } as any },
  mockSendOtp: vi.fn().mockResolvedValue({ error: null }),
  mockVerifyOtp: vi.fn().mockResolvedValue({ error: null }),
  mockSupabaseUpdate: vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) }),
  mockInvalidateQueries: vi.fn(),
  mockIsDeviceTrusted: vi.fn().mockReturnValue(false),
  mockSaveDeviceTrust: vi.fn(),
  mockDeviceTrustEnabled: { current: true },
  mockOtpThresholdDays: { current: 14 },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser.current,
    sendOtp: mockSendOtp,
    verifyOtp: mockVerifyOtp,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: mockProfile.current,
    isLoading: false,
  }),
}));

vi.mock("@/lib/otp-smart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/otp-smart")>();
  return {
    ...actual,
    isDeviceTrusted: (...args: any[]) => mockIsDeviceTrusted(...args),
    saveDeviceTrust: (...args: any[]) => mockSaveDeviceTrust(...args),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "app_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { device_trust_enabled: true, otp_threshold_days: 14 }, error: null }),
            }),
          }),
        };
      }
      return {
        update: (...args: any[]) => mockSupabaseUpdate(...args),
      };
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { device_trust_enabled: mockDeviceTrustEnabled.current, otp_threshold_days: mockOtpThresholdDays.current },
    isLoading: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

import { OtpGate } from "./OtpGate";

function renderGate() {
  return render(
    React.createElement(OtpGate, null, React.createElement("div", null, "Protected Content")),
  );
}

describe("OtpGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    // Default: password login
    sessionStorage.setItem("was_password_login", "true");
    mockUser.current = { id: "u1", email: "test@example.com" };
    mockProfile.current = { last_otp_verified_at: null };
    mockIsDeviceTrusted.mockReturnValue(false);
    mockDeviceTrustEnabled.current = true;
    mockOtpThresholdDays.current = 14;
    vi.setSystemTime(new Date("2026-04-01T12:00:00"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("passa children quando OTP verificato di recente (< 14 giorni)", () => {
    mockProfile.current = { last_otp_verified_at: "2026-03-25T12:00:00+00:00" };
    renderGate();
    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("mostra gate OTP quando mai verificato (null)", () => {
    mockProfile.current = { last_otp_verified_at: null };
    renderGate();
    expect(screen.getByText("Verifica la tua identita'")).toBeTruthy();
    expect(screen.getByText("Invia codice OTP")).toBeTruthy();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("mostra gate OTP quando verifica > 14 giorni fa", () => {
    mockProfile.current = { last_otp_verified_at: "2026-03-10T12:00:00+00:00" };
    renderGate();
    expect(screen.getByText("Verifica la tua identita'")).toBeTruthy();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("skip OTP per OAuth login (no was_password_login)", () => {
    sessionStorage.removeItem("was_password_login");
    mockProfile.current = { last_otp_verified_at: null };
    renderGate();
    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("passa children quando profilo non disponibile (safety)", () => {
    mockProfile.current = null;
    renderGate();
    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("passa children quando utente non ha email", () => {
    mockUser.current = { id: "u1", email: undefined };
    mockProfile.current = { last_otp_verified_at: null };
    renderGate();
    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("flusso completo: send OTP → verify → mostra children e aggiorna profilo", async () => {
    mockProfile.current = { last_otp_verified_at: null };
    mockSendOtp.mockResolvedValueOnce({ error: null });
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    mockSupabaseUpdate.mockReturnValueOnce({
      eq: () => Promise.resolve({ error: null }),
    });

    renderGate();

    // Gate visibile, children nascosti
    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.getByText("Invia codice OTP")).toBeTruthy();

    // Click "Invia codice OTP"
    fireEvent.click(screen.getByText("Invia codice OTP"));

    await waitFor(() => {
      expect(mockSendOtp).toHaveBeenCalledWith("test@example.com");
    });

    // Dopo invio, appare il campo OTP e il bottone Verifica
    await waitFor(() => {
      expect(screen.getByText("Verifica")).toBeTruthy();
    });

    // Simula inserimento OTP (InputOTP usa onChange con stringa)
    const otpInput = screen.getByRole("textbox");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    // Click "Verifica"
    fireEvent.click(screen.getByText("Verifica"));

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith("test@example.com", "123456");
    });

    // Dopo verifica, children visibili
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeTruthy();
    });

    // Profilo aggiornato
    expect(mockSupabaseUpdate).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["profile"] });
  });

  it("mostra errore quando verifica OTP fallisce", async () => {
    mockProfile.current = { last_otp_verified_at: null };
    mockSendOtp.mockResolvedValueOnce({ error: null });
    mockVerifyOtp.mockResolvedValueOnce({ error: new Error("invalid") });

    renderGate();

    // Invia OTP
    fireEvent.click(screen.getByText("Invia codice OTP"));
    await waitFor(() => expect(mockSendOtp).toHaveBeenCalled());

    // Inserisci codice sbagliato e verifica
    await waitFor(() => expect(screen.getByText("Verifica")).toBeTruthy());
    const otpInput = screen.getByRole("textbox");
    fireEvent.change(otpInput, { target: { value: "000000" } });
    fireEvent.click(screen.getByText("Verifica"));

    await waitFor(() => {
      expect(screen.getByText("Codice non valido o scaduto. Riprova.")).toBeTruthy();
    });

    // Children ancora nascosti
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  // ── Device Trust Tests (Story 67.2) ──────────────────────

  it("skip OTP gate quando device trust e' valido", () => {
    mockProfile.current = { last_otp_verified_at: null }; // OTP scaduto
    mockIsDeviceTrusted.mockReturnValue(true);
    renderGate();
    expect(screen.getByText("Protected Content")).toBeTruthy();
    expect(mockIsDeviceTrusted).toHaveBeenCalledWith("u1");
  });

  it("mostra gate quando device_trust_enabled e' false anche con token valido (AC #6)", () => {
    mockProfile.current = { last_otp_verified_at: null };
    mockIsDeviceTrusted.mockReturnValue(true); // token valido
    mockDeviceTrustEnabled.current = false; // admin ha disabilitato
    renderGate();
    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.getByText("Verifica la tua identita'")).toBeTruthy();
  });

  it("mostra gate quando device trust e' scaduto", () => {
    mockProfile.current = { last_otp_verified_at: null };
    mockIsDeviceTrusted.mockReturnValue(false);
    renderGate();
    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.getByText("Verifica la tua identita'")).toBeTruthy();
  });

  // ── Soglia OTP da DB (Story 67.3) ──────────────────────

  it("usa soglia custom da DB: 7 giorni — verifica 5gg fa → passa", () => {
    mockOtpThresholdDays.current = 7;
    // 5 giorni fa, entro soglia 7gg
    mockProfile.current = { last_otp_verified_at: "2026-03-27T12:00:00+00:00" };
    renderGate();
    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("usa soglia custom da DB: 7 giorni — verifica 10gg fa → mostra gate", () => {
    mockOtpThresholdDays.current = 7;
    // 10 giorni fa, oltre soglia 7gg
    mockProfile.current = { last_otp_verified_at: "2026-03-22T12:00:00+00:00" };
    renderGate();
    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.getByText("Verifica la tua identita'")).toBeTruthy();
  });

  it("salva device trust dopo verifica OTP riuscita", async () => {
    mockProfile.current = { last_otp_verified_at: null };
    mockSendOtp.mockResolvedValueOnce({ error: null });
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    mockSupabaseUpdate.mockReturnValueOnce({
      eq: () => Promise.resolve({ error: null }),
    });

    renderGate();

    // Invia OTP
    fireEvent.click(screen.getByText("Invia codice OTP"));
    await waitFor(() => expect(mockSendOtp).toHaveBeenCalled());

    // Inserisci codice e verifica
    await waitFor(() => expect(screen.getByText("Verifica")).toBeTruthy());
    const otpInput = screen.getByRole("textbox");
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByText("Verifica"));

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeTruthy();
    });

    // saveDeviceTrust chiamato con user.id
    expect(mockSaveDeviceTrust).toHaveBeenCalledWith("u1");
  });
});
