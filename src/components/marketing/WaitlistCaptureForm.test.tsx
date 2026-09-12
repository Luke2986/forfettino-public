import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock dependencies
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: vi.fn(),
  PRO_WAITLIST_CONSENT_TEXT: "Testo consenso test",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/hooks/useWaitlistReferral", () => ({
  useWaitlistReferral: () => ({
    referralToken: "abc123",
    invitesCount: 0,
    boostLevel: 0,
    nextBoostAt: 3,
    nextBoostLabel: "Priority +1 slot",
    referralUrl: "https://forfettino.it/pro-presto?wl=abc123",
    isLoading: false,
  }),
}));

vi.mock("@/lib/posthog", () => ({
  posthog: { capture: vi.fn() },
  isPosthogReady: true,
}));

import { useAuth } from "@/hooks/useAuth";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { supabase } from "@/integrations/supabase/client";
import { WaitlistCaptureForm } from "./WaitlistCaptureForm";

const mockUseAuth = vi.mocked(useAuth);
const mockUseProWaitlist = vi.mocked(useProWaitlist);
const mockRpc = vi.mocked(supabase.rpc);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function renderForm(props?: { referredByToken?: string }) {
  return render(<WaitlistCaptureForm {...props} />, { wrapper: createWrapper() });
}

describe("WaitlistCaptureForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: merge RPC returns not merged
    mockRpc.mockResolvedValue({ data: { merged: false }, error: null } as any);
  });

  describe("path autenticato", () => {
    it("mostra CTA diretta se utente autenticato e non in waitlist", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1", email: "a@b.com" },
        loading: false,
        signOut: vi.fn(),
      } as any);
      mockUseProWaitlist.mockReturnValue({
        isJoined: false,
        join: { mutate: vi.fn(), isPending: false } as any,
        data: null,
        isLoading: false,
        wasRevoked: false,
        revoke: {} as any,
        rejoin: {} as any,
      });

      renderForm();
      expect(screen.getByText("Iscriviti alla waitlist")).toBeInTheDocument();
    });

    it("mostra messaggio se già in waitlist", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1", email: "a@b.com" },
        loading: false,
        signOut: vi.fn(),
      } as any);
      mockUseProWaitlist.mockReturnValue({
        isJoined: true,
        join: { mutate: vi.fn(), isPending: false } as any,
        data: { id: "x", user_id: "u1", consent_given_at: "2024-01-01", consent_text: "t", created_at: "2024-01-01", email: "a@b.com", revoked_at: null } as any,
        isLoading: false,
        wasRevoked: false,
        revoke: {} as any,
        rejoin: {} as any,
      });

      renderForm();
      expect(screen.getByText(/Sei in lista/)).toBeInTheDocument();
    });
  });

  describe("path anonimo", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: vi.fn(),
      } as any);
      mockUseProWaitlist.mockReturnValue({
        isJoined: false,
        join: { mutate: vi.fn(), isPending: false } as any,
        data: null,
        isLoading: false,
        wasRevoked: false,
        revoke: {} as any,
        rejoin: {} as any,
      });
    });

    it("mostra form email + consenso", () => {
      renderForm();
      expect(screen.getByPlaceholderText("La tua email")).toBeInTheDocument();
      expect(screen.getByText("Testo consenso test")).toBeInTheDocument();
    });

    it("valida email client-side", async () => {
      renderForm();
      const input = screen.getByPlaceholderText("La tua email");
      fireEvent.change(input, { target: { value: "not-email" } });

      // Check consent first so button is enabled
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      // Submit form directly (fireEvent.submit is more reliable than clicking disabled buttons)
      const form = input.closest("form")!;
      fireEvent.submit(form);

      expect(screen.getByText("Email non valida")).toBeInTheDocument();
    });

    it("chiama RPC join_waitlist_lead al submit con successo", async () => {
      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null } as any);

      renderForm();

      fireEvent.change(screen.getByPlaceholderText("La tua email"), {
        target: { value: "test@example.com" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Iscriviti alla waitlist"));

      await waitFor(() => {
        expect(screen.getByText(/Sei in lista!/)).toBeInTheDocument();
      });
    });

    it("gestisce risposta already_registered", async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: false, reason: "already_registered" },
        error: null,
      } as any);

      renderForm();

      fireEvent.change(screen.getByPlaceholderText("La tua email"), {
        target: { value: "test@example.com" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Iscriviti alla waitlist"));

      await waitFor(() => {
        expect(screen.getByText(/Questa email è già registrata/)).toBeInTheDocument();
      });
    });

    it("gestisce risposta rate_limited", async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: false, reason: "rate_limited" },
        error: null,
      } as any);

      renderForm();

      fireEvent.change(screen.getByPlaceholderText("La tua email"), {
        target: { value: "test@example.com" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Iscriviti alla waitlist"));

      await waitFor(() => {
        expect(screen.getByText(/Troppe richieste/)).toBeInTheDocument();
      });
    });

    it("passa p_referred_by_token alla RPC per path anonimo", async () => {
      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null } as any);

      renderForm({ referredByToken: "tok789" });

      fireEvent.change(screen.getByPlaceholderText("La tua email"), {
        target: { value: "new@example.com" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Iscriviti alla waitlist"));

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith(
          "join_waitlist_lead",
          expect.objectContaining({
            p_referred_by_token: "tok789",
          }),
        );
      });
    });

    it("mostra messaggio 'crea un account' per anon post-success", async () => {
      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null } as any);

      renderForm();

      fireEvent.change(screen.getByPlaceholderText("La tua email"), {
        target: { value: "new2@example.com" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByText("Iscriviti alla waitlist"));

      await waitFor(() => {
        expect(
          screen.getByText(/Crea un account per ottenere il tuo link referral/)
        ).toBeInTheDocument();
      });
    });
  });

  describe("referral: path autenticato", () => {
    it("passa referredByToken alla mutation join", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1", email: "a@b.com" },
        loading: false,
        signOut: vi.fn(),
      } as any);
      mockUseProWaitlist.mockReturnValue({
        isJoined: false,
        join: { mutate: mockUseProWaitlist().join.mutate, isPending: false } as any,
        data: null,
        isLoading: false,
        wasRevoked: false,
        revoke: {} as any,
        rejoin: {} as any,
      });

      renderForm({ referredByToken: "tokABC" });
      fireEvent.click(screen.getByText("Iscriviti alla waitlist"));

      expect(mockUseProWaitlist().join.mutate).toHaveBeenCalledWith(
        "tokABC",
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );
    });

    it("mostra WaitlistReferralPanel per utente già in waitlist", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1", email: "a@b.com" },
        loading: false,
        signOut: vi.fn(),
      } as any);
      mockUseProWaitlist.mockReturnValue({
        isJoined: true,
        join: { mutate: vi.fn(), isPending: false } as any,
        data: { id: "x", user_id: "u1", consent_given_at: "", consent_text: "", created_at: "", email: "test@test.com", revoked_at: null, unsubscribed_at: null, referral_token: "abc", referred_by_token: null, queue_position_boost: 0, invites_count: 0 },
        isLoading: false,
        wasRevoked: false,
        revoke: {} as any,
        rejoin: {} as any,
      });

      renderForm();
      expect(screen.getByText(/Sei in lista/)).toBeInTheDocument();
      // WaitlistReferralPanel is rendered (mocked)
      expect(screen.getByText("Invita amici, salta in coda")).toBeInTheDocument();
    });
  });
});
