import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminAwardPointsDialog } from "./AdminAwardPointsDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Hoisted mocks ──
const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

const MOCK_CONFIGS = [
  {
    actionType: "feedback_submitted",
    points: 50,
    label: "Feedback",
    frequencyLabel: "1 volta",
    colorBg: "bg-blue-500",
    colorText: "text-blue-700",
    displayOrder: 1,
  },
  {
    actionType: "referral_signup",
    points: 100,
    label: "Referral",
    frequencyLabel: "max 10/mese",
    colorBg: "bg-green-500",
    colorText: "text-green-700",
    displayOrder: 2,
  },
];

vi.mock("@/hooks/useAdminAwardContribution", () => ({
  useAdminAwardContribution: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useActiveUserCount", () => ({
  useActiveUserCount: () => ({ data: 42 }),
}));

vi.mock("@/hooks/useValidateUserCode", () => ({
  useValidateUserCode: (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed === "AB26XYZ12") {
      return { data: { found: true, firstName: "Mario" }, isLoading: false };
    }
    if (trimmed.length >= 3) {
      return { data: { found: false, firstName: null }, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
}));

vi.mock("@/hooks/useActionConfig", () => ({
  useActionConfig: () => ({ data: MOCK_CONFIGS }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
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

function renderDialog(open = true) {
  return render(
    <AdminAwardPointsDialog open={open} onOpenChange={mockOnOpenChange} />,
    { wrapper: createWrapper() },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminAwardPointsDialog", () => {
  // --- Rendering ---
  it("renders dialog when open", () => {
    renderDialog();
    expect(screen.getByText("Assegna Punti")).toBeInTheDocument();
    expect(screen.getByText("Singolo utente")).toBeInTheDocument();
    expect(screen.getByText(/Tutti/)).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("Assegna Punti")).not.toBeInTheDocument();
  });

  // --- Target mode ---
  it("shows user code input when single mode selected", () => {
    renderDialog();
    expect(
      screen.getByPlaceholderText("Codice utente (es. AB26XYZ12)"),
    ).toBeInTheDocument();
  });

  it("hides user code input when all mode selected", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/Tutti/));
    expect(
      screen.queryByPlaceholderText("Codice utente (es. AB26XYZ12)"),
    ).not.toBeInTheDocument();
  });

  it("shows active user count in 'Tutti' label", () => {
    renderDialog();
    expect(screen.getByText(/Tutti \(42\)/)).toBeInTheDocument();
  });

  // --- Validation: single user code ---
  it("disables Avanti when user code is not validated", () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Codice utente (es. AB26XYZ12)"),
      { target: { value: "ZZZZZZZZZ" } },
    );
    expect(screen.getByText("Avanti")).toBeDisabled();
  });

  it("shows green check for valid user code", () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Codice utente (es. AB26XYZ12)"),
      { target: { value: "AB26XYZ12" } },
    );
    expect(screen.getByText("Mario")).toBeInTheDocument();
  });

  it("shows 'Codice non trovato' for unknown code", () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Codice utente (es. AB26XYZ12)"),
      { target: { value: "UNKNOWN99" } },
    );
    expect(screen.getByText("Codice non trovato")).toBeInTheDocument();
  });

  // --- Points mode: config ---
  it("shows config select by default", () => {
    renderDialog();
    expect(screen.getByText("Seleziona azione...")).toBeInTheDocument();
  });

  // --- Points mode: manual ---
  it("shows manual points input when manual mode selected", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Manuale"));
    expect(screen.getByPlaceholderText("Punti (1–9999)")).toBeInTheDocument();
  });

  it("shows reason as obbligatorio in manual mode", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Manuale"));
    expect(
      screen.getByPlaceholderText("Motivo (obbligatorio)"),
    ).toBeInTheDocument();
  });

  it("shows character counter for reason in manual mode", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Manuale"));
    expect(screen.getByText("0/200 caratteri")).toBeInTheDocument();
  });

  // --- F1: reason required in manual mode ---
  it("disables Avanti when manual mode has points but no reason", () => {
    renderDialog();
    // Switch to all users (skip user code validation)
    fireEvent.click(screen.getByLabelText(/Tutti/));
    // Switch to manual
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "50" },
    });
    // Reason is empty → Avanti should be disabled
    expect(screen.getByText("Avanti")).toBeDisabled();
  });

  it("enables Avanti when manual mode has points and reason", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/Tutti/));
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motivo (obbligatorio)"), {
      target: { value: "Bonus speciale" },
    });
    expect(screen.getByText("Avanti")).not.toBeDisabled();
  });

  // --- F2: max validation ---
  it("disables Avanti when points exceed 9999", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/Tutti/));
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "10000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motivo (obbligatorio)"), {
      target: { value: "Troppi punti" },
    });
    expect(screen.getByText("Avanti")).toBeDisabled();
  });

  // --- Reason not required in config mode ---
  it("does not require reason in config mode", () => {
    renderDialog();
    // All users + config mode
    fireEvent.click(screen.getByLabelText(/Tutti/));
    // We need to select an action from config, but Select is hard to test
    // Just verify the reason field is NOT shown in config mode
    expect(
      screen.queryByPlaceholderText("Motivo (obbligatorio)"),
    ).not.toBeInTheDocument();
  });

  // --- Confirmation flow ---
  it("shows confirmation step when Avanti is clicked", () => {
    renderDialog();
    // Valid user
    fireEvent.change(
      screen.getByPlaceholderText("Codice utente (es. AB26XYZ12)"),
      { target: { value: "AB26XYZ12" } },
    );
    // Manual mode with reason
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motivo (obbligatorio)"), {
      target: { value: "Premio test" },
    });

    fireEvent.click(screen.getByText("Avanti"));

    expect(screen.getByText("Conferma assegnazione")).toBeInTheDocument();
    expect(screen.getByText(/Mario/)).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("Premio test")).toBeInTheDocument();
  });

  it("calls mutate with correct payload on confirm for single manual", () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Codice utente (es. AB26XYZ12)"),
      { target: { value: "AB26XYZ12" } },
    );
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motivo (obbligatorio)"), {
      target: { value: "Premio test" },
    });

    fireEvent.click(screen.getByText("Avanti"));
    fireEvent.click(screen.getByText("Conferma"));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockMutate.mock.calls[0];
    expect(payload).toEqual({
      userCode: "AB26XYZ12",
      actionType: "admin_manual",
      points: 25,
      reason: "Premio test",
      allUsers: false,
    });
  });

  it("calls mutate with allUsers=true for bulk assignment", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/Tutti/));
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motivo (obbligatorio)"), {
      target: { value: "Bonus tutti" },
    });

    fireEvent.click(screen.getByText("Avanti"));

    // Confirmation shows bulk warning
    expect(
      screen.getByText(/assegnerà punti a tutti gli utenti attivi/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Conferma"));

    const [payload] = mockMutate.mock.calls[0];
    expect(payload.allUsers).toBe(true);
    expect(payload.userCode).toBeUndefined();
  });

  // --- Back from confirmation ---
  it("goes back to form when Indietro is clicked in confirmation", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/Tutti/));
    fireEvent.click(screen.getByLabelText("Manuale"));
    fireEvent.change(screen.getByPlaceholderText("Punti (1–9999)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motivo (obbligatorio)"), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByText("Avanti"));

    expect(screen.getByText("Conferma assegnazione")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Indietro"));
    expect(screen.getByText("Assegna Punti")).toBeInTheDocument();
  });

  // --- Cancel ---
  it("calls onOpenChange(false) when Annulla is clicked", () => {
    renderDialog();
    fireEvent.click(screen.getByText("Annulla"));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
