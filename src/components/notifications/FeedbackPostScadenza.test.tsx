import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackPostScadenza } from "./FeedbackPostScadenza";

// ── Mocks ──

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("@/hooks/useDeadlineFeedback", () => ({
  useDeadlineFeedback: () => ({
    mutate: mockMutate,
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const defaultProps = {
  scadenzaName: "Rata INPS Q1",
  scheduleEventId: "sched-1",
  notificationId: "notif-1",
  onComplete: vi.fn(),
};

describe("FeedbackPostScadenza", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make mutate call onSuccess callback immediately
    mockMutate.mockImplementation((_params: any, options?: any) => {
      if (options?.onSuccess) options.onSuccess();
    });
  });

  describe("Step: question", () => {
    it("renders scadenza name and two buttons", () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);

      expect(screen.getByText(/Rata INPS Q1/)).toBeInTheDocument();
      expect(screen.getByText("Sì, tutto ok!")).toBeInTheDocument();
      expect(screen.getByText("No, ho avuto difficoltà")).toBeInTheDocument();
    });

    it("click 'Sì' calls mutation with response=yes and shows yes_response", async () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);

      fireEvent.click(screen.getByText("Sì, tutto ok!"));

      expect(mockMutate).toHaveBeenCalledWith(
        {
          scheduleEventId: "sched-1",
          notificationId: "notif-1",
          response: "yes",
        },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );

      // After onSuccess, should show yes_response step
      await waitFor(() => {
        expect(screen.getByText("Ottimo lavoro!")).toBeInTheDocument();
      });
    });

    it("click 'No' transitions to no_form step without saving", () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);

      fireEvent.click(screen.getByText("No, ho avuto difficoltà"));

      expect(mockMutate).not.toHaveBeenCalled();
      expect(
        screen.getByText(/Succede anche ai migliori/)
      ).toBeInTheDocument();
    });
  });

  describe("Step: yes_response", () => {
    it("shows celebratory message and Chiudi button", async () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);

      fireEvent.click(screen.getByText("Sì, tutto ok!"));

      await waitFor(() => {
        expect(screen.getByText("Ottimo lavoro!")).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Hai gestito tutto alla grande/)
      ).toBeInTheDocument();
      expect(screen.getByText("Chiudi")).toBeInTheDocument();
    });

    it("click Chiudi calls onComplete", async () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);

      fireEvent.click(screen.getByText("Sì, tutto ok!"));

      await waitFor(() => {
        expect(screen.getByText("Chiudi")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Chiudi"));
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step: no_form", () => {
    function goToNoForm() {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);
      fireEvent.click(screen.getByText("No, ho avuto difficoltà"));
    }

    it("shows RadioGroup with 4 options", () => {
      goToNoForm();

      expect(screen.getByText("Non avevo i soldi")).toBeInTheDocument();
      expect(screen.getByText("Mi sono dimenticato/a")).toBeInTheDocument();
      expect(
        screen.getByText("Non capivo quanto dovevo pagare")
      ).toBeInTheDocument();
      expect(screen.getByText("Altro")).toBeInTheDocument();
    });

    it("submit button is disabled without selection", () => {
      goToNoForm();

      const submitBtn = screen.getByText("Invia e chiudi");
      expect(submitBtn).toBeDisabled();
    });

    it("submit button is enabled after selecting a reason", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Non avevo i soldi"));

      const submitBtn = screen.getByText("Invia e chiudi");
      expect(submitBtn).not.toBeDisabled();
    });

    it("selecting 'Altro' shows Textarea", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Altro"));

      expect(
        screen.getByPlaceholderText("Descrivi la tua difficoltà...")
      ).toBeInTheDocument();
    });

    it("Textarea not visible when non-Altro reason selected", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Non avevo i soldi"));

      expect(
        screen.queryByPlaceholderText("Descrivi la tua difficoltà...")
      ).not.toBeInTheDocument();
    });

    it("submits with reason and calls onComplete", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Mi sono dimenticato/a"));
      fireEvent.click(screen.getByText("Invia e chiudi"));

      expect(mockMutate).toHaveBeenCalledWith(
        {
          scheduleEventId: "sched-1",
          notificationId: "notif-1",
          response: "no",
          reason: "forgot",
          freeText: null,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );

      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    it("submits 'other' with freeText", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Altro"));

      const textarea = screen.getByPlaceholderText(
        "Descrivi la tua difficoltà..."
      );
      fireEvent.change(textarea, { target: { value: "Motivo personalizzato" } });
      fireEvent.click(screen.getByText("Invia e chiudi"));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          response: "no",
          reason: "other",
          freeText: "Motivo personalizzato",
        }),
        expect.any(Object)
      );
    });

    it("Textarea has max 200 character limit", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Altro"));

      const textarea = screen.getByPlaceholderText(
        "Descrivi la tua difficoltà..."
      );
      expect(textarea).toHaveAttribute("maxLength", "200");
    });

    it("shows character counter for Altro textarea", () => {
      goToNoForm();

      fireEvent.click(screen.getByLabelText("Altro"));

      const textarea = screen.getByPlaceholderText(
        "Descrivi la tua difficoltà..."
      );
      fireEvent.change(textarea, { target: { value: "test" } });

      expect(screen.getByText("4/200")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has aria-live=polite for step transitions", () => {
      const { container } = renderWithProviders(
        <FeedbackPostScadenza {...defaultProps} />
      );

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it("RadioGroup has aria-label", () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);
      fireEvent.click(screen.getByText("No, ho avuto difficoltà"));

      const radioGroup = screen.getByRole("radiogroup");
      expect(radioGroup).toHaveAttribute(
        "aria-label",
        "Motivo della difficoltà"
      );
    });

    it("Textarea has aria-label", () => {
      renderWithProviders(<FeedbackPostScadenza {...defaultProps} />);
      fireEvent.click(screen.getByText("No, ho avuto difficoltà"));
      fireEvent.click(screen.getByLabelText("Altro"));

      const textarea = screen.getByPlaceholderText(
        "Descrivi la tua difficoltà..."
      );
      expect(textarea).toHaveAttribute(
        "aria-label",
        "Descrivi la tua difficoltà"
      );
    });
  });
});
