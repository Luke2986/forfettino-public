/**
 * Test per Auth.tsx
 * Story 8.2 — Autenticazione Email+2FA e Google OAuth
 *
 * Copertura:
 * - AC 1: Password dimenticata link + form + email sent view
 * - AC 5: Email confirmation post-signup + resend button
 * - AC 5b: "Email not confirmed" error → shows confirmation screen
 * - OTP: Login email+password → OTP step → verifica → dashboard
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

// --- Hoisted mocks ---
const { mockNavigate, mockSignIn, mockSignUp, mockSignInWithGoogle,
        mockSignOut, mockSendOtp, mockVerifyOtp,
        mockResetPasswordForEmail, mockResend, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignInWithGoogle: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockSendOtp: vi.fn().mockResolvedValue({ error: null }),
  mockVerifyOtp: vi.fn().mockResolvedValue({ error: null }),
  mockResetPasswordForEmail: vi.fn(),
  mockResend: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: mockSignOut,
    sendOtp: mockSendOtp,
    verifyOtp: mockVerifyOtp,
    user: null,
    loading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      resend: mockResend,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signOut: vi.fn(),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import AuthPage, { PRIVACY_SIGNUP_FLAG } from "./Auth";

function renderAuth() {
  return render(
    React.createElement(
      HelmetProvider,
      null,
      React.createElement(MemoryRouter, null, React.createElement(AuthPage)),
    )
  );
}

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Forgot Password (AC #1)", () => {
    it("shows forgot password link in login mode", () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      expect(screen.getByText("Password dimenticata?")).toBeInTheDocument();
    });

    it("shows forgot password form when link clicked", () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Password dimenticata?"));
      expect(screen.getByText("Inserisci la tua email e ti invieremo un link per reimpostare la password.")).toBeInTheDocument();
      expect(screen.getByText("Invia link di reset")).toBeInTheDocument();
    });

    it("sends reset email and shows confirmation", async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Password dimenticata?"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
      fireEvent.click(screen.getByText("Invia link di reset"));

      await waitFor(() => {
        expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@example.com", expect.objectContaining({
          redirectTo: expect.stringContaining("/reset-password"),
        }));
      });

      expect(screen.getByText("Controlla la tua email")).toBeInTheDocument();
    });

    it("shows error on invalid email", async () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Password dimenticata?"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invalid" } });
      fireEvent.click(screen.getByText("Invia link di reset"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
    });

    it("returns to login from forgot password", () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Password dimenticata?"));
      fireEvent.click(screen.getByText("Torna al login"));
      expect(screen.getByText("Continua con Google")).toBeInTheDocument();
    });
  });

  describe("Email Confirmation Post-Signup (AC #5)", () => {
    it("shows email confirmation screen after successful signup", async () => {
      mockSignUp.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongP1!" } });
      // Accept privacy checkbox (Story 35.3)
      fireEvent.click(screen.getByRole("checkbox"));

      // The submit button is the w-full one (not the toggle link)
      const buttons = screen.getAllByText("Registrati");
      const submitBtn = buttons.find((el) => el.tagName === "BUTTON" && el.className.includes("w-full")) || buttons[0];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Controlla la tua email")).toBeInTheDocument();
      });
      expect(screen.getByText(/new@test.com/)).toBeInTheDocument();
      expect(screen.getByText("Reinvia email di conferma")).toBeInTheDocument();
    });

    it("shows confirmation screen on 'Email not confirmed' error", async () => {
      mockSignIn.mockResolvedValue({
        error: { message: "Email not confirmed" },
      });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "unconfirmed@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
      fireEvent.click(screen.getByText("Accedi"));

      await waitFor(() => {
        expect(screen.getByText("Controlla la tua email")).toBeInTheDocument();
      });
      expect(screen.getByText("Reinvia email di conferma")).toBeInTheDocument();
    });

    it("resend confirmation email button works", async () => {
      mockSignUp.mockResolvedValue({ error: null });
      mockResend.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongP1!" } });
      // Accept privacy checkbox (Story 35.3)
      fireEvent.click(screen.getByRole("checkbox"));

      const buttons = screen.getAllByText("Registrati");
      const submitBtn = buttons.find((el) => el.tagName === "BUTTON" && el.className.includes("w-full")) || buttons[0];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Reinvia email di conferma")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Reinvia email di conferma"));

      await waitFor(() => {
        expect(mockResend).toHaveBeenCalledWith({ type: "signup", email: "new@test.com" });
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Email inviata!" }));
      });
    });

    it("rejects weak password on signup", async () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "weak" } });
      // Accept privacy checkbox to enable button (Story 35.3)
      fireEvent.click(screen.getByRole("checkbox"));

      const buttons = screen.getAllByText("Registrati");
      const submitBtn = buttons.find((el) => el.tagName === "BUTTON" && el.className.includes("w-full")) || buttons[0];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it("allows login with old weak password and navigates to dashboard", async () => {
      mockSignIn.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "old@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "oldpwd" } });
      fireEvent.click(screen.getByText("Accedi"));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("old@test.com", "oldpwd");
      });
      // After successful login, navigates directly (no OTP step)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
      });
    });

    it("shows password strength indicator in signup mode", () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));

      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Abc" } });
      expect(screen.getByText("Debole")).toBeInTheDocument();
    });

    it("does not show password strength indicator in login mode", () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));

      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Abc" } });
      expect(screen.queryByText("Debole")).not.toBeInTheDocument();
    });

    it("returns to login from confirmation screen", async () => {
      mockSignIn.mockResolvedValue({
        error: { message: "Email not confirmed" },
      });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
      fireEvent.click(screen.getByText("Accedi"));

      await waitFor(() => {
        expect(screen.getByText("Torna al login")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Torna al login"));
      expect(screen.getByText("Continua con Google")).toBeInTheDocument();
    });
  });

  describe("Privacy Consent Checkbox (Story 35.3)", () => {
    /** Helper: navigates to signup email form */
    function goToSignupForm() {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati")); // toggle to signup mode
    }

    it("shows privacy checkbox in signup mode", () => {
      goToSignupForm();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      expect(screen.getByText(/Ho letto e accetto/)).toBeInTheDocument();
    });

    it("does not show privacy checkbox in login mode", () => {
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("disables signup button when checkbox not checked", () => {
      goToSignupForm();
      const submitBtn = screen.getByRole("button", { name: "Registrati" });
      expect(submitBtn).toBeDisabled();
    });

    it("enables signup button when checkbox checked", () => {
      goToSignupForm();
      fireEvent.click(screen.getByRole("checkbox"));
      const submitBtn = screen.getByRole("button", { name: "Registrati" });
      expect(submitBtn).not.toBeDisabled();
    });

    it("disables Google button in signup mode when checkbox not checked", () => {
      goToSignupForm();
      expect(screen.getByText("Continua con Google").closest("button")).toBeDisabled();
    });

    it("enables Google button when checkbox checked in signup mode", () => {
      goToSignupForm();
      fireEvent.click(screen.getByRole("checkbox"));
      expect(screen.getByText("Continua con Google").closest("button")).not.toBeDisabled();
    });

    it("contains links to privacy policy and terms of service", () => {
      goToSignupForm();
      const privacyLink = screen.getByText("Privacy Policy");
      const termsLink = screen.getByText("Termini di Servizio");
      expect(privacyLink.closest("a")).toHaveAttribute("href", "/privacy-policy");
      expect(termsLink.closest("a")).toHaveAttribute("href", "/terms");
      expect(privacyLink.closest("a")).toHaveAttribute("target", "_blank");
      expect(termsLink.closest("a")).toHaveAttribute("target", "_blank");
    });
  });

  describe("Consent Persistence at Signup (Story 35.3)", () => {
    beforeEach(() => {
      localStorage.removeItem(PRIVACY_SIGNUP_FLAG);
    });

    it("sets localStorage flag on successful email signup", async () => {
      mockSignUp.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongP1!" } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Registrati" }));

      await waitFor(() => {
        expect(localStorage.getItem(PRIVACY_SIGNUP_FLAG)).toBe("true");
      });
    });

    it("sets localStorage flag before Google OAuth in signup mode", async () => {
      mockSignInWithGoogle.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Continua con Google").closest("button")!);

      await waitFor(() => {
        expect(localStorage.getItem(PRIVACY_SIGNUP_FLAG)).toBe("true");
      });
    });

    it("removes localStorage flag on Google OAuth error", async () => {
      mockSignInWithGoogle.mockResolvedValue({ error: { message: "OAuth error" } });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));
      fireEvent.click(screen.getByText("Registrati"));
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Continua con Google").closest("button")!);

      await waitFor(() => {
        expect(localStorage.getItem(PRIVACY_SIGNUP_FLAG)).toBeNull();
      });
    });
  });

  describe("Direct Login (no OTP)", () => {
    it("navigates to dashboard after successful password login", async () => {
      mockSignIn.mockResolvedValue({ error: null });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Pass123!" } });
      fireEvent.click(screen.getByText("Accedi"));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("user@test.com", "Pass123!");
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
      });
      // No OTP step, no signOut
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockSendOtp).not.toHaveBeenCalled();
    });

    it("does NOT navigate when login fails", async () => {
      mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
      renderAuth();
      fireEvent.click(screen.getByText("Continua con Email"));

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@test.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
      fireEvent.click(screen.getByText("Accedi"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
