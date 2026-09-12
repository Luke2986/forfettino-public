/**
 * Test per ResetPassword.tsx
 * Story 8.2 — Password Reset page
 *
 * Copertura:
 * - AC 1: Reset password form renders, validates, submits, shows success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

const { mockNavigate, mockUpdateUser, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { updateUser: mockUpdateUser },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import ResetPasswordPage from "./ResetPassword";

function renderPage() {
  return render(
    React.createElement(
      HelmetProvider,
      null,
      React.createElement(MemoryRouter, null, React.createElement(ResetPasswordPage)),
    )
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reset password form", () => {
    renderPage();
    expect(screen.getByText("Nuova password", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nuova password")).toBeInTheDocument();
    expect(screen.getByLabelText("Conferma password")).toBeInTheDocument();
    expect(screen.getByText("Imposta nuova password")).toBeInTheDocument();
  });

  it("shows error for short password", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "ab" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "ab" } });
    fireEvent.click(screen.getByText("Imposta nuova password"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: "destructive",
      }));
    });
  });

  it("shows error when passwords don't match", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "StrongP1!" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "StrongP2!" } });
    fireEvent.click(screen.getByText("Imposta nuova password"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        description: "Le password non coincidono.",
        variant: "destructive",
      }));
    });
  });

  it("submits valid password and shows success", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "StrongP1!" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "StrongP1!" } });
    fireEvent.click(screen.getByText("Imposta nuova password"));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "StrongP1!" });
    });

    expect(screen.getByText("Password aggiornata!")).toBeInTheDocument();
    expect(screen.getByText("Vai al login")).toBeInTheDocument();
  });

  it("navigates to login from success screen", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "StrongP1!" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "StrongP1!" } });
    fireEvent.click(screen.getByText("Imposta nuova password"));

    await waitFor(() => {
      expect(screen.getByText("Vai al login")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Vai al login"));
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("shows password strength indicator", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "Abc" } });
    expect(screen.getByText("Debole")).toBeInTheDocument();
  });

  it("rejects weak password on reset", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "weak" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "weak" } });
    fireEvent.click(screen.getByText("Imposta nuova password"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows error on API failure", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "Token expired" } });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "StrongP1!" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "StrongP1!" } });
    fireEvent.click(screen.getByText("Imposta nuova password"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        description: "Token expired",
        variant: "destructive",
      }));
    });
  });
});
