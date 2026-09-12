/**
 * Test per MfaVerify.tsx
 * Story 43.2 — MFA Hardening: server-side lockout, no sessionStorage bypass
 *
 * Copertura:
 * - Renders 2FA code input view
 * - Backup code mode switch and return
 * - Invalid backup code error (with remaining_attempts from server)
 * - Server-side lockout display (AC5 — fixes H2)
 * - Successful backup code does NOT set sessionStorage (AC3 — fixes C1)
 * - Redirects to setup when no factor found
 * - Lockout persists after component re-render (server-driven)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

const { mockNavigate, mockCheckMfaStatus, mockCreateChallengeAndVerify,
        mockClearError, mockFunctionsInvoke, mockToast, mockRpc, mockSignOut, mockSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCheckMfaStatus: vi.fn(),
  mockCreateChallengeAndVerify: vi.fn(),
  mockClearError: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
  mockToast: vi.fn(),
  mockRpc: vi.fn(),
  mockSignOut: vi.fn(),
  mockSession: { current: { user: { id: "u1" } } as unknown },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: "/mfa/verify" }),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ session: mockSession.current, signOut: mockSignOut }),
}));

vi.mock("@/hooks/useMfa", () => ({
  useMfa: () => ({
    checkMfaStatus: mockCheckMfaStatus,
    createChallengeAndVerify: mockCreateChallengeAndVerify,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mockFunctionsInvoke },
    rpc: mockRpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import MfaVerifyPage from "./MfaVerify";

function renderPage() {
  return render(
    React.createElement(MemoryRouter, null, React.createElement(MfaVerifyPage))
  );
}

describe("MfaVerifyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockSession.current = { user: { id: "u1" } };
    mockCheckMfaStatus.mockResolvedValue({ factorId: "factor-abc" });
    // Default: no lockout — handle all RPC names
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_mfa_lockout_status") {
        return Promise.resolve({ data: { locked: false, attempts: 0 }, error: null });
      }
      if (name === "check_lockout_for_totp") {
        return Promise.resolve({ data: { locked: false, attempts: 0 }, error: null });
      }
      if (name === "record_failed_totp_attempt") {
        return Promise.resolve({ data: { locked: false, attempts: 1 }, error: null });
      }
      if (name === "reset_lockout_after_totp") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: { locked: false, attempts: 0 }, error: null });
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    // Flush any pending timers queued by `input-otp` (setInterval for mirrored
    // selection). Without this, timers can fire after jsdom is torn down,
    // producing "ReferenceError: window is not defined" unhandled rejections.
    vi.useFakeTimers();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("renders the 2FA code input view", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Inserisci il codice 2FA")).toBeInTheDocument();
    });
    expect(screen.getByText("Verifica")).toBeInTheDocument();
    expect(screen.getByText("Usa codice di backup")).toBeInTheDocument();
  });

  it("shows backup code input when 'Usa codice di backup' clicked", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Usa codice di backup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usa codice di backup"));

    expect(screen.getByPlaceholderText("Es: A3BF72K9")).toBeInTheDocument();
    expect(screen.getByText("Verifica codice di backup")).toBeInTheDocument();
    expect(screen.getByText("Torna al codice 2FA")).toBeInTheDocument();
  });

  it("returns to OTP mode from backup code mode", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Usa codice di backup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usa codice di backup"));
    expect(screen.getByText("Verifica codice di backup")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Torna al codice 2FA"));
    expect(screen.getByText("Inserisci il codice 2FA")).toBeInTheDocument();
  });

  it("shows error with remaining attempts for invalid backup code (AC5)", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { valid: false, error: "Codice di backup non valido.", remaining_attempts: 2 },
      error: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Usa codice di backup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usa codice di backup"));

    const input = screen.getByPlaceholderText("Es: A3BF72K9");
    fireEvent.change(input, { target: { value: "WRONGCODE" } });
    fireEvent.click(screen.getByText("Verifica codice di backup"));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("verify-backup-code", {
        body: { code: "WRONGCODE" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/2 tentativi rimasti/)).toBeInTheDocument();
    });
  });

  it("shows server-side lockout when server returns locked (AC5 — H2 fix)", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { valid: false, locked: true, locked_until: new Date(Date.now() + 900000).toISOString() },
      error: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Usa codice di backup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usa codice di backup"));

    const input = screen.getByPlaceholderText("Es: A3BF72K9");
    fireEvent.change(input, { target: { value: "WRONGCODE" } });
    fireEvent.click(screen.getByText("Verifica codice di backup"));

    await waitFor(() => {
      expect(screen.getByText(/Troppi tentativi/)).toBeInTheDocument();
    });
  });

  it("lockout persists from server on mount (AC5 — lockout survives refresh)", async () => {
    // Simulate server returning active lockout on initial status fetch
    const lockedUntil = new Date(Date.now() + 600000).toISOString();
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_mfa_lockout_status") {
        return Promise.resolve({
          data: { locked: true, locked_until: lockedUntil, attempts: 5 },
          error: null,
        });
      }
      return Promise.resolve({ data: { locked: false, attempts: 0 }, error: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Troppi tentativi/)).toBeInTheDocument();
    });
  });

  it("does NOT set sessionStorage backup_mfa_verified on success (AC3 — C1 fix)", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { valid: true, backupVerified: true, factorId: "factor-abc" },
      error: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Usa codice di backup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usa codice di backup"));

    const input = screen.getByPlaceholderText("Es: A3BF72K9");
    fireEvent.change(input, { target: { value: "A3BF72K9" } });
    fireEvent.click(screen.getByText("Verifica codice di backup"));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalled();
    });

    // backup_mfa_verified must NOT be in sessionStorage (server-side now)
    expect(sessionStorage.getItem("backup_mfa_verified")).toBeNull();
  });

  it("renders logout button in both modes", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Esci")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usa codice di backup"));
    expect(screen.getByText("Esci")).toBeInTheDocument();
  });

  it("calls record_failed_totp_attempt on TOTP failure (AC2 — TOTP tracking)", async () => {
    mockCreateChallengeAndVerify.mockResolvedValue(false);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Inserisci il codice 2FA")).toBeInTheDocument();
    });

    // Type 6 digits into OTP slots (InputOTP uses onChange with full value)
    const otpInput = document.querySelector("input");
    if (otpInput) {
      fireEvent.change(otpInput, { target: { value: "123456" } });
    }

    fireEvent.click(screen.getByText("Verifica"));

    await waitFor(() => {
      expect(mockCreateChallengeAndVerify).toHaveBeenCalledWith("123456", "factor-abc");
    });

    // Verify TOTP tracking RPCs were called
    await waitFor(() => {
      const rpcCalls = mockRpc.mock.calls.map((c: unknown[]) => c[0]);
      expect(rpcCalls).toContain("check_lockout_for_totp");
      expect(rpcCalls).toContain("record_failed_totp_attempt");
    });
  });

  it("calls reset_lockout_after_totp on TOTP success (AC2)", async () => {
    mockCreateChallengeAndVerify.mockResolvedValue(true);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Inserisci il codice 2FA")).toBeInTheDocument();
    });

    const otpInput = document.querySelector("input");
    if (otpInput) {
      fireEvent.change(otpInput, { target: { value: "123456" } });
    }

    fireEvent.click(screen.getByText("Verifica"));

    await waitFor(() => {
      expect(mockCreateChallengeAndVerify).toHaveBeenCalled();
    });

    await waitFor(() => {
      const rpcCalls = mockRpc.mock.calls.map((c: unknown[]) => c[0]);
      expect(rpcCalls).toContain("reset_lockout_after_totp");
    });
  });

  it("redirects to setup when no factor found", async () => {
    mockCheckMfaStatus.mockResolvedValue({ factorId: null });
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/mfa/setup", { replace: true });
    });
  });
});
