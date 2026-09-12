import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NewAnnouncementDialog } from "./NewAnnouncementDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Hoisted mocks (must be hoisted alongside vi.mock factories) ──
const { mockMutate, mockMaybeSingle } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockMaybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

// ── Mock useSendAnnouncement ──
vi.mock("@/hooks/useSendAnnouncement", () => ({
  useSendAnnouncement: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// ── Mock supabase for user code validation ──
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockOnOpenChange = vi.fn();

function renderDialog(
  open = true,
  extra?: { defaultValues?: any; resendTitle?: string },
) {
  return render(
    <NewAnnouncementDialog
      open={open}
      onOpenChange={mockOnOpenChange}
      defaultValues={extra?.defaultValues}
      resendTitle={extra?.resendTitle}
    />,
    { wrapper: createWrapper() },
  );
}

/** Fill title+body and click Invia → opens AlertDialog → click Conferma invio */
function fillAndConfirm(
  titleVal = "Titolo test",
  bodyVal = "Corpo test",
  extras?: { url?: string; label?: string },
) {
  fireEvent.change(screen.getByTestId("announcement-title"), {
    target: { value: titleVal },
  });
  fireEvent.change(screen.getByTestId("announcement-body"), {
    target: { value: bodyVal },
  });

  if (extras?.url) {
    fireEvent.change(screen.getByTestId("announcement-url"), {
      target: { value: extras.url },
    });
  }
  if (extras?.label) {
    fireEvent.change(screen.getByTestId("announcement-label"), {
      target: { value: extras.label },
    });
  }

  // Click "Invia" → opens confirmation AlertDialog
  fireEvent.click(screen.getByTestId("announcement-send"));

  // Click "Conferma invio" in AlertDialog
  fireEvent.click(screen.getByTestId("announcement-confirm-send"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("NewAnnouncementDialog", () => {
  // --- Rendering ---
  it("renders dialog when open", () => {
    renderDialog(true);

    expect(screen.getByText("Nuovo Annuncio")).toBeInTheDocument();
    expect(screen.getByLabelText("Titolo")).toBeInTheDocument();
    expect(screen.getByLabelText("Corpo")).toBeInTheDocument();
    expect(screen.getByText("Invia")).toBeInTheDocument();
    expect(screen.getByText("Annulla")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderDialog(false);

    expect(screen.queryByText("Nuovo Annuncio")).not.toBeInTheDocument();
  });

  // --- Validation ---
  it("disables send button when form is empty", () => {
    renderDialog();

    const sendBtn = screen.getByTestId("announcement-send");
    expect(sendBtn).toBeDisabled();
  });

  it("enables send button when title and body are filled", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Test Title" },
    });
    fireEvent.change(screen.getByTestId("announcement-body"), {
      target: { value: "Test Body" },
    });

    const sendBtn = screen.getByTestId("announcement-send");
    expect(sendBtn).not.toBeDisabled();
  });

  it("keeps send button disabled with only spaces", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByTestId("announcement-body"), {
      target: { value: "   " },
    });

    const sendBtn = screen.getByTestId("announcement-send");
    expect(sendBtn).toBeDisabled();
  });

  // --- URL validation ---
  it("disables send button when URL is invalid", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Titolo" },
    });
    fireEvent.change(screen.getByTestId("announcement-body"), {
      target: { value: "Corpo" },
    });
    fireEvent.change(screen.getByTestId("announcement-url"), {
      target: { value: "javascript:alert(1)" },
    });

    expect(screen.getByTestId("announcement-send")).toBeDisabled();
    expect(screen.getByTestId("url-error")).toBeInTheDocument();
  });

  it("accepts relative URL starting with /", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Titolo" },
    });
    fireEvent.change(screen.getByTestId("announcement-body"), {
      target: { value: "Corpo" },
    });
    fireEvent.change(screen.getByTestId("announcement-url"), {
      target: { value: "/feedback" },
    });

    expect(screen.getByTestId("announcement-send")).not.toBeDisabled();
    expect(screen.queryByTestId("url-error")).not.toBeInTheDocument();
  });

  it("accepts https URL", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Titolo" },
    });
    fireEvent.change(screen.getByTestId("announcement-body"), {
      target: { value: "Corpo" },
    });
    fireEvent.change(screen.getByTestId("announcement-url"), {
      target: { value: "https://example.com" },
    });

    expect(screen.getByTestId("announcement-send")).not.toBeDisabled();
  });

  // --- Character counters ---
  it("shows character counters", () => {
    renderDialog();

    expect(screen.getByText("0/100")).toBeInTheDocument();
    expect(screen.getByText("0/1500")).toBeInTheDocument();
  });

  it("updates character counter on input", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Hello" },
    });

    expect(screen.getByText("5/100")).toBeInTheDocument();
  });

  // --- Preview ---
  it("shows preview when title or body has content", () => {
    renderDialog();

    // No preview initially
    expect(screen.queryByText("Anteprima notifica")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Test" },
    });

    expect(screen.getByText("Anteprima notifica")).toBeInTheDocument();
  });

  it("preview region has aria-label", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Test" },
    });

    const preview = screen.getByRole("region", { name: "Anteprima notifica" });
    expect(preview).toBeInTheDocument();
  });

  it("shows action label in preview when URL is provided", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByTestId("announcement-url"), {
      target: { value: "https://example.com" },
    });

    // Default label is "Scopri di più"
    expect(screen.getByText(/Scopri di più/)).toBeInTheDocument();
  });

  it("shows custom action label in preview", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByTestId("announcement-url"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByTestId("announcement-label"), {
      target: { value: "Vai" },
    });

    expect(screen.getByText(/Vai/)).toBeInTheDocument();
  });

  // --- Confirmation flow ---
  it("opens confirmation dialog when clicking Invia", () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Titolo" },
    });
    fireEvent.change(screen.getByTestId("announcement-body"), {
      target: { value: "Corpo" },
    });

    fireEvent.click(screen.getByTestId("announcement-send"));

    // AlertDialog should appear
    expect(screen.getByText("Confermi l'invio?")).toBeInTheDocument();
    expect(screen.getByTestId("announcement-confirm-send")).toBeInTheDocument();

    // mutate should NOT have been called yet
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // --- Submit (with confirmation) ---
  it("calls mutate with correct payload after confirmation", () => {
    renderDialog();

    fillAndConfirm("Titolo test", "Corpo test");

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockMutate.mock.calls[0];
    expect(payload).toEqual({
      title: "Titolo test",
      body: "Corpo test",
      target_audience: "all",
      delivery_type: "sidebar",
    });
  });

  it("includes action_url and action_label when provided", () => {
    renderDialog();

    fillAndConfirm("Titolo", "Corpo", {
      url: "https://example.com",
      label: "Click qui",
    });

    const [payload] = mockMutate.mock.calls[0];
    expect(payload.action_url).toBe("https://example.com");
    expect(payload.action_label).toBe("Click qui");
  });

  it("uses default action_label when URL is set but label is empty", () => {
    renderDialog();

    fillAndConfirm("Titolo", "Corpo", { url: "https://example.com" });

    const [payload] = mockMutate.mock.calls[0];
    expect(payload.action_url).toBe("https://example.com");
    expect(payload.action_label).toBe("Scopri di più");
  });

  // --- onSuccess callback resets form ---
  it("resets form and closes dialog on successful send", () => {
    renderDialog();

    fillAndConfirm("Titolo", "Corpo");

    // Get the onSuccess callback from the mutate call
    const [, options] = mockMutate.mock.calls[0];
    expect(options).toBeDefined();
    expect(typeof options.onSuccess).toBe("function");

    // Simulate success
    options.onSuccess();

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Cancel ---
  it("calls onOpenChange(false) when clicking Annulla", () => {
    renderDialog();

    fireEvent.click(screen.getByText("Annulla"));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Does not submit when invalid ---
  it("does not call mutate when form is invalid", () => {
    renderDialog();

    // Only title, no body
    fireEvent.change(screen.getByTestId("announcement-title"), {
      target: { value: "Solo titolo" },
    });

    fireEvent.click(screen.getByTestId("announcement-send"));
    // Should not even open confirmation dialog
    expect(screen.queryByText("Confermi l'invio?")).not.toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // Story 25.6: Individual message mode
  // ═══════════════════════════════════════════════════════════════

  describe("individual mode — UI visibility", () => {
    it("shows target type RadioGroup with broadcast and individual options", () => {
      renderDialog();

      expect(screen.getByText("Tipo destinatario")).toBeInTheDocument();
      expect(screen.getByText(/Broadcast/)).toBeInTheDocument();
      expect(screen.getByText("Singolo utente")).toBeInTheDocument();
    });

    it("shows user code field when individual is selected", () => {
      renderDialog();

      // Initially hidden
      expect(screen.queryByTestId("announcement-user-code")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Singolo utente"));

      expect(screen.getByTestId("announcement-user-code")).toBeInTheDocument();
    });

    it("hides target audience select when individual", () => {
      renderDialog();

      expect(screen.getByTestId("announcement-audience")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Singolo utente"));

      expect(screen.queryByTestId("announcement-audience")).not.toBeInTheDocument();
    });

    it("shows delivery type RadioGroup when individual", () => {
      // Delivery type RadioGroup is now always visible (default: sidebar for both modes)
      renderDialog();

      expect(screen.getByText("Tipo consegna")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Singolo utente"));

      expect(screen.getByText("Tipo consegna")).toBeInTheDocument();
      expect(screen.getByText(/Notifica campanella/)).toBeInTheDocument();
      expect(screen.getByText(/Pop-up modale/)).toBeInTheDocument();
    });

    it("changes dialog title to 'Nuovo Messaggio Individuale' when individual", () => {
      renderDialog();

      expect(screen.getByText("Nuovo Annuncio")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Singolo utente"));

      expect(screen.getByText("Nuovo Messaggio Individuale")).toBeInTheDocument();
      expect(screen.queryByText("Nuovo Annuncio")).not.toBeInTheDocument();
    });

    it("restores broadcast UI when switching back", () => {
      renderDialog();

      fireEvent.click(screen.getByLabelText("Singolo utente"));
      expect(screen.queryByTestId("announcement-audience")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/Broadcast/));

      expect(screen.getByTestId("announcement-audience")).toBeInTheDocument();
      expect(screen.queryByTestId("announcement-user-code")).not.toBeInTheDocument();
      // "Tipo consegna" è ora visibile anche in broadcast mode (default: sidebar)
      expect(screen.getByText("Nuovo Annuncio")).toBeInTheDocument();
    });
  });

  describe("individual mode — preview variants", () => {
    it("shows sidebar preview for individual + sidebar delivery", () => {
      renderDialog();

      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-title"), {
        target: { value: "Test sidebar" },
      });

      expect(screen.getByText("Anteprima notifica")).toBeInTheDocument();
      expect(screen.queryByText("Ho capito")).not.toBeInTheDocument();
    });

    it("shows popup modal preview for individual + popup delivery", () => {
      renderDialog();

      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.click(screen.getByLabelText(/Pop-up modale/));
      fireEvent.change(screen.getByTestId("announcement-title"), {
        target: { value: "Test popup" },
      });

      expect(screen.getByText("Anteprima pop-up modale")).toBeInTheDocument();
      expect(screen.getByText("Ho capito")).toBeInTheDocument();
    });
  });

  describe("individual mode — code validation & submit", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows found user when code is valid", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-123", user_code: "LA26TEST1", first_name: "Mario", last_name: "Rossi" },
        error: null,
      });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA26TEST1" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(screen.getByTestId("user-code-found")).toBeInTheDocument();
      expect(screen.getByText(/Mario Rossi/)).toBeInTheDocument();
    });

    it("shows error when code not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "XXXXXXXXX" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(screen.getByTestId("user-code-error")).toBeInTheDocument();
      expect(screen.getByText("Codice non trovato")).toBeInTheDocument();
    });

    it("does not validate when code is shorter than 5 chars", async () => {
      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA2" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockMaybeSingle).not.toHaveBeenCalled();
      expect(screen.queryByTestId("user-code-found")).not.toBeInTheDocument();
      expect(screen.queryByTestId("user-code-error")).not.toBeInTheDocument();
    });

    it("disables send when individual but user not validated", () => {
      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-title"), { target: { value: "Test" } });
      fireEvent.change(screen.getByTestId("announcement-body"), { target: { value: "Corpo" } });

      // No user code entered → resolvedUser is null → isValid false
      expect(screen.getByTestId("announcement-send")).toBeDisabled();
    });

    it("enables send when individual with validated user + title + body", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-123", user_code: "LA26TEST1", first_name: "Mario", last_name: "Rossi" },
        error: null,
      });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-title"), { target: { value: "Titolo" } });
      fireEvent.change(screen.getByTestId("announcement-body"), { target: { value: "Corpo" } });
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA26TEST1" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(screen.getByTestId("announcement-send")).not.toBeDisabled();
    });

    it("sends individual payload with target_type, target_user_id, delivery_type", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-123", user_code: "LA26TEST1", first_name: "Mario", last_name: "Rossi" },
        error: null,
      });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-title"), { target: { value: "Msg individuale" } });
      fireEvent.change(screen.getByTestId("announcement-body"), { target: { value: "Corpo messaggio" } });
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA26TEST1" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // Submit via confirmation
      fireEvent.click(screen.getByTestId("announcement-send"));
      fireEvent.click(screen.getByTestId("announcement-confirm-send"));

      expect(mockMutate).toHaveBeenCalledTimes(1);
      const [payload] = mockMutate.mock.calls[0];
      expect(payload).toEqual({
        title: "Msg individuale",
        body: "Corpo messaggio",
        target_audience: "all",
        target_type: "individual",
        target_user_id: "user-123",
        delivery_type: "sidebar",
      });
    });

    it("sends popup delivery_type when popup selected", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-123", user_code: "LA26TEST1", first_name: "Mario", last_name: "Rossi" },
        error: null,
      });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.click(screen.getByLabelText(/Pop-up modale/));
      fireEvent.change(screen.getByTestId("announcement-title"), { target: { value: "Popup test" } });
      fireEvent.change(screen.getByTestId("announcement-body"), { target: { value: "Corpo popup" } });
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA26TEST1" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      fireEvent.click(screen.getByTestId("announcement-send"));
      fireEvent.click(screen.getByTestId("announcement-confirm-send"));

      const [payload] = mockMutate.mock.calls[0];
      expect(payload.delivery_type).toBe("popup");
    });

    it("shows individual confirmation text with user code and name", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-123", user_code: "LA26TEST1", first_name: "Mario", last_name: "Rossi" },
        error: null,
      });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-title"), { target: { value: "Test" } });
      fireEvent.change(screen.getByTestId("announcement-body"), { target: { value: "Corpo" } });
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA26TEST1" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // Open confirmation dialog
      fireEvent.click(screen.getByTestId("announcement-send"));

      // Check individual confirmation text
      expect(
        screen.getByText(/Stai per inviare un messaggio a LA26TEST1 \(Mario Rossi\)/),
      ).toBeInTheDocument();
    });

    it("resets individual state when switching to broadcast", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-123", user_code: "LA26TEST1", first_name: "Mario", last_name: "Rossi" },
        error: null,
      });

      renderDialog();
      fireEvent.click(screen.getByLabelText("Singolo utente"));
      fireEvent.change(screen.getByTestId("announcement-user-code"), {
        target: { value: "LA26TEST1" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(screen.getByTestId("user-code-found")).toBeInTheDocument();

      // Switch back to broadcast
      fireEvent.click(screen.getByLabelText(/Broadcast/));

      // Individual state should be reset
      expect(screen.queryByTestId("user-code-found")).not.toBeInTheDocument();
      expect(screen.queryByTestId("announcement-user-code")).not.toBeInTheDocument();
      expect(screen.getByText("Nuovo Annuncio")).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Resend mode — pre-fill, banner, confirmation
  // ═══════════════════════════════════════════════════════════════

  describe("resend mode", () => {
    const resendDefaults = {
      title: "Annuncio originale",
      body: "Corpo originale del messaggio",
      actionUrl: "https://example.com/promo",
      actionLabel: "Vai alla promo",
      targetAudience: "pro" as const,
    };

    it("shows resend banner when resendTitle is provided", () => {
      renderDialog(true, { resendTitle: "Annuncio originale" });

      expect(screen.getByTestId("resend-banner")).toBeInTheDocument();
      expect(screen.getByText(/Re-invio di:/)).toBeInTheDocument();
      expect(screen.getByText("Annuncio originale")).toBeInTheDocument();
    });

    it("does not show resend banner when resendTitle is absent", () => {
      renderDialog(true);

      expect(screen.queryByTestId("resend-banner")).not.toBeInTheDocument();
    });

    it("pre-fills fields with defaultValues on open", () => {
      renderDialog(true, {
        defaultValues: resendDefaults,
        resendTitle: "Annuncio originale",
      });

      expect(screen.getByTestId("announcement-title")).toHaveValue("Annuncio originale");
      expect(screen.getByTestId("announcement-body")).toHaveValue("Corpo originale del messaggio");
      expect(screen.getByTestId("announcement-url")).toHaveValue("https://example.com/promo");
      expect(screen.getByTestId("announcement-label")).toHaveValue("Vai alla promo");
    });

    it("pre-filled fields are editable", () => {
      renderDialog(true, {
        defaultValues: resendDefaults,
        resendTitle: "Annuncio originale",
      });

      fireEvent.change(screen.getByTestId("announcement-title"), {
        target: { value: "Titolo modificato" },
      });

      expect(screen.getByTestId("announcement-title")).toHaveValue("Titolo modificato");
    });

    it("shows differentiated confirmation text for resend", () => {
      renderDialog(true, {
        defaultValues: resendDefaults,
        resendTitle: "Annuncio originale",
      });

      // Click Invia to open confirmation
      fireEvent.click(screen.getByTestId("announcement-send"));

      expect(
        screen.getByText(/Stai per re-inviare questo annuncio/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/nuovo invio indipendente con statistiche separate/),
      ).toBeInTheDocument();
    });

    it("resets form after successful resend", () => {
      renderDialog(true, {
        defaultValues: resendDefaults,
        resendTitle: "Annuncio originale",
      });

      // Submit
      fireEvent.click(screen.getByTestId("announcement-send"));
      fireEvent.click(screen.getByTestId("announcement-confirm-send"));

      // Simulate onSuccess
      const [, options] = mockMutate.mock.calls[0];
      options.onSuccess();

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
