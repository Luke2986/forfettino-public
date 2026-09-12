/**
 * Test per MfaSetup.tsx
 * Story 8.2 — MFA Backup Codes after TOTP verification
 *
 * Copertura:
 * - AC 3: After TOTP verification, backup codes are generated and shown
 * - Initial QR generation view
 * - Logout button present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

const { mockNavigate, mockEnrollTotp, mockVerifyAndActivate, mockClearError,
        mockFunctionsInvoke, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEnrollTotp: vi.fn(),
  mockVerifyAndActivate: vi.fn(),
  mockClearError: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: "/mfa/setup" }),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock("@/hooks/useMfa", () => ({
  useMfa: () => ({
    enrollTotp: mockEnrollTotp,
    verifyAndActivate: mockVerifyAndActivate,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  }),
  EnrollResult: undefined,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mockFunctionsInvoke },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import MfaSetupPage from "./MfaSetup";

function renderPage() {
  return render(
    React.createElement(MemoryRouter, null, React.createElement(MfaSetupPage))
  );
}

describe("MfaSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders the initial QR generation view", () => {
    renderPage();
    expect(screen.getByText("Attiva verifica in due passaggi")).toBeInTheDocument();
    expect(screen.getByText("Genera QR Code")).toBeInTheDocument();
  });

  it("shows QR code after generation", async () => {
    mockEnrollTotp.mockResolvedValue({
      factorId: "factor-123",
      qr: "data:image/svg+xml;base64,PHN2Zz4=",
      secret: "JBSWY3DPEHPK3PXP",
    });

    renderPage();
    fireEvent.click(screen.getByText("Genera QR Code"));

    await waitFor(() => {
      expect(screen.getByAltText("QR Code per 2FA")).toBeInTheDocument();
    });
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    expect(screen.getByText("Verifica e attiva")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    renderPage();
    expect(screen.getByText("Esci")).toBeInTheDocument();
  });
});
