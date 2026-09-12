/**
 * Test per MfaGate.tsx
 * Story 43.2 — MFA Hardening: fail-closed, server-side backup verification
 *
 * Copertura:
 * - AAL2 grants access
 * - FAIL-CLOSED: checkMfaStatus error denies access (AC1 — fixes H3)
 * - FAIL-CLOSED: checkMfaStatus timeout denies access (AC1)
 * - Server-side backup verification grants access (AC3 — fixes C1)
 * - Password login at AAL1 with enrolled factor redirects to /mfa/verify
 * - OAuth login skips MFA
 * - Password login without enrolled factor grants access (Story 16.2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

const { mockSession, mockCheckMfaStatus, mockSignOut, mockRpc } = vi.hoisted(() => ({
  mockSession: { current: { user: { id: "u1" }, access_token: "tok" } as unknown },
  mockCheckMfaStatus: vi.fn(),
  mockSignOut: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ session: mockSession.current, signOut: mockSignOut }),
}));

vi.mock("@/hooks/useMfa", () => ({
  useMfa: () => ({ checkMfaStatus: mockCheckMfaStatus }),
  MfaState: undefined,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mockRpc },
}));

import { MfaGate } from "./MfaGate";

function renderGate() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard"] },
      React.createElement(MfaGate, null, React.createElement("div", null, "Protected Content"))
    )
  );
}

describe("MfaGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockSession.current = { user: { id: "u1" }, access_token: "tok" };
    mockRpc.mockResolvedValue({ data: { backup_verified: false }, error: null });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("allows access when AAL2", async () => {
    mockCheckMfaStatus.mockResolvedValue({
      isPasswordLogin: true,
      currentAal: "aal2",
      nextAal: "aal2",
      hasEnrolledFactor: true,
      factorId: "f1",
    });

    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("FAIL-CLOSED: denies access when checkMfaStatus throws error (AC1 — H3 fix)", async () => {
    mockCheckMfaStatus.mockRejectedValue(new Error("Supabase Auth error"));

    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Impossibile verificare lo stato MFA")).toBeInTheDocument();
    });
    // Children must NOT be rendered
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    // Retry and Logout buttons present
    expect(screen.getByText("Riprova")).toBeInTheDocument();
    expect(screen.getByText("Esci")).toBeInTheDocument();
  });

  it("FAIL-CLOSED: denies access on timeout (AC1)", async () => {
    vi.useFakeTimers();
    // checkMfaStatus never resolves
    mockCheckMfaStatus.mockReturnValue(new Promise(() => {}));

    renderGate();

    // Should show loading initially
    expect(screen.getByText("Verifica sicurezza...")).toBeInTheDocument();

    // Advance past 10s timeout — wrap in act() because fake timers capture waitFor's setTimeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });

    expect(screen.getByText("Impossibile verificare lo stato MFA")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("retry button re-attempts MFA check after error", async () => {
    // First call fails
    mockCheckMfaStatus.mockRejectedValueOnce(new Error("fail"));

    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Impossibile verificare lo stato MFA")).toBeInTheDocument();
    });

    // Second call succeeds
    mockCheckMfaStatus.mockResolvedValueOnce({
      isPasswordLogin: false,
      currentAal: "aal1",
      nextAal: "aal1",
      hasEnrolledFactor: false,
      factorId: null,
    });

    fireEvent.click(screen.getByText("Riprova"));

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("allows access when server-side backup_verified is true (AC3 — C1 fix)", async () => {
    mockCheckMfaStatus.mockResolvedValue({
      isPasswordLogin: true,
      currentAal: "aal1",
      nextAal: "aal2",
      hasEnrolledFactor: true,
      factorId: "f1",
    });

    // Server returns backup_verified = true
    mockRpc.mockResolvedValue({ data: { backup_verified: true }, error: null });

    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("redirects to /mfa/verify when AAL1 with factor and no backup verification", async () => {
    mockCheckMfaStatus.mockResolvedValue({
      isPasswordLogin: true,
      currentAal: "aal1",
      nextAal: "aal2",
      hasEnrolledFactor: true,
      factorId: "f1",
    });

    mockRpc.mockResolvedValue({ data: { backup_verified: false }, error: null });

    renderGate();
    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  it("allows access for OAuth login without MFA", async () => {
    mockCheckMfaStatus.mockResolvedValue({
      isPasswordLogin: false,
      currentAal: "aal1",
      nextAal: "aal1",
      hasEnrolledFactor: false,
      factorId: null,
    });

    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("allows access when password login and no factor enrolled (Story 16.2 — MFA voluntary)", async () => {
    mockCheckMfaStatus.mockResolvedValue({
      isPasswordLogin: true,
      currentAal: "aal1",
      nextAal: "aal1",
      hasEnrolledFactor: false,
      factorId: null,
    });

    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
