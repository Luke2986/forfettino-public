/**
 * Test per AdminSendEmail
 * Story 44.2 — Admin UI: Composizione e Invio Email
 *
 * Copertura:
 * - Render form con tutti i campi (oggetto, corpo, contatore, bottoni)
 * - Toggle invio singolo mostra/nasconde campo email
 * - Bottone Invia disabilitato se campi vuoti
 * - Click Invia apre AlertDialog di conferma
 * - Conferma invio chiama Edge Function (single mode)
 * - Validazione: subject e html required
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock supabase
const mockSelect = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: () => ({
            eq: () => Promise.resolve({ count: 42, error: null }),
          }),
        };
      },
    }),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { AdminSendEmail } from "../AdminSendEmail";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("AdminSendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        success: true,
        results: [{ email: "test@example.com", status: "sent", id: "resend-id" }],
        summary: { sent: 1, skipped: 0, errors: 0 },
      },
      error: null,
    });
  });

  it("renders form with subject, body, recipient count, and buttons", async () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    expect(screen.getByText("Invia Email (Resend)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Oggetto/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Corpo HTML/)).toBeInTheDocument();
    expect(screen.getByTestId("preview-btn")).toBeInTheDocument();
    expect(screen.getByTestId("send-btn")).toBeInTheDocument();
    expect(screen.getByTestId("single-mode-toggle")).toBeInTheDocument();

    // Recipient count loads
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("toggle single mode shows/hides email input", () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    // Initially no email input
    expect(screen.queryByTestId("single-email-input")).not.toBeInTheDocument();

    // Toggle on
    fireEvent.click(screen.getByTestId("single-mode-toggle"));
    expect(screen.getByTestId("single-email-input")).toBeInTheDocument();

    // Toggle off
    fireEvent.click(screen.getByTestId("single-mode-toggle"));
    expect(screen.queryByTestId("single-email-input")).not.toBeInTheDocument();
  });

  it("send button is disabled when fields are empty", () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeDisabled();
  });

  it("send button becomes enabled when subject and body are filled", () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("email-subject"), {
      target: { value: "Test Subject" },
    });
    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Hello</p>" },
    });

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).not.toBeDisabled();
  });

  it("send button disabled in single mode when email is empty", () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    // Fill subject and body
    fireEvent.change(screen.getByTestId("email-subject"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Hi</p>" },
    });

    // Enable single mode
    fireEvent.click(screen.getByTestId("single-mode-toggle"));

    // Button should be disabled (no email)
    expect(screen.getByTestId("send-btn")).toBeDisabled();

    // Fill email
    fireEvent.change(screen.getByTestId("single-email-input"), {
      target: { value: "user@test.it" },
    });

    // Button should be enabled
    expect(screen.getByTestId("send-btn")).not.toBeDisabled();
  });

  it("clicking send opens confirmation dialog", () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("email-subject"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Content</p>" },
    });

    fireEvent.click(screen.getByTestId("send-btn"));

    expect(screen.getByText("Conferma invio email")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-send")).toBeInTheDocument();
  });

  it("confirm send in single mode calls send-email edge function", async () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    // Enable single mode and fill form
    fireEvent.click(screen.getByTestId("single-mode-toggle"));
    fireEvent.change(screen.getByTestId("single-email-input"), {
      target: { value: "user@test.it" },
    });
    fireEvent.change(screen.getByTestId("email-subject"), {
      target: { value: "Test Subject" },
    });
    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Body</p>" },
    });

    // Click send → opens dialog
    fireEvent.click(screen.getByTestId("send-btn"));

    // Confirm
    fireEvent.click(screen.getByTestId("confirm-send"));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("send-email", {
        body: {
          to: "user@test.it",
          subject: "Test Subject",
          html: "<p>Body</p>",
        },
      });
    });
  });

  it("broadcast mode: calls RPC then sends batched emails", async () => {
    // RPC returns 3 emails (fits in 1 batch of 10)
    mockRpc.mockResolvedValue({
      data: [
        { email: "a@test.it" },
        { email: "b@test.it" },
        { email: "c@test.it" },
      ],
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        success: true,
        results: [
          { email: "a@test.it", status: "sent", id: "id1" },
          { email: "b@test.it", status: "sent", id: "id2" },
          { email: "c@test.it", status: "sent", id: "id3" },
        ],
        summary: { sent: 3, skipped: 0, errors: 0 },
      },
      error: null,
    });

    render(<AdminSendEmail />, { wrapper: createWrapper() });

    // Fill form (broadcast mode — single mode is OFF by default)
    fireEvent.change(screen.getByTestId("email-subject"), {
      target: { value: "Broadcast Subject" },
    });
    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Broadcast body</p>" },
    });

    // Send → confirm
    fireEvent.click(screen.getByTestId("send-btn"));
    fireEvent.click(screen.getByTestId("confirm-send"));

    await waitFor(() => {
      // Should have called RPC to get emails
      expect(mockRpc).toHaveBeenCalledWith("get_consented_email_list");
    });

    await waitFor(() => {
      // Should have called EF with the 3 emails
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("send-email", {
        body: {
          to: ["a@test.it", "b@test.it", "c@test.it"],
          subject: "Broadcast Subject",
          html: "<p>Broadcast body</p>",
        },
      });
    });
  });

  it("broadcast mode: shows error toast when 0 consented recipients", async () => {
    const { toast } = await import("sonner");

    mockRpc.mockResolvedValue({ data: [], error: null });

    render(<AdminSendEmail />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("email-subject"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Body</p>" },
    });

    fireEvent.click(screen.getByTestId("send-btn"));
    fireEvent.click(screen.getByTestId("confirm-send"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Nessun destinatario con consenso email trovato",
      );
    });

    // Should NOT have called the Edge Function
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("preview button is disabled when body is empty", () => {
    render(<AdminSendEmail />, { wrapper: createWrapper() });

    expect(screen.getByTestId("preview-btn")).toBeDisabled();

    fireEvent.change(screen.getByTestId("email-body"), {
      target: { value: "<p>Content</p>" },
    });

    expect(screen.getByTestId("preview-btn")).not.toBeDisabled();
  });
});
