import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminActionConfig } from "./AdminActionConfig";

// Mock useActionConfig hook
vi.mock("@/hooks/useActionConfig", () => ({
  useActionConfig: () => ({
    data: [
      {
        actionType: "call_completed",
        points: 50,
        label: "Call mensile",
        frequencyLabel: "max 1 ogni 30 giorni",
        colorBg: "bg-rose-500",
        colorText: "text-rose-700",
        displayOrder: 1,
      },
      {
        actionType: "feedback_submitted",
        points: 15,
        label: "Feedback inviato",
        frequencyLabel: "max 1 ogni 7 giorni",
        colorBg: "bg-amber-500",
        colorText: "text-amber-700",
        displayOrder: 2,
      },
      {
        actionType: "referral_signup",
        points: 30,
        label: "Invita un amico",
        frequencyLabel: "ogni amico, max 10/mese",
        colorBg: "bg-violet-500",
        colorText: "text-violet-700",
        displayOrder: 3,
      },
      {
        actionType: "first_import_xml",
        points: 15,
        label: "Primo import XML",
        frequencyLabel: "una tantum",
        colorBg: "bg-blue-500",
        colorText: "text-blue-700",
        displayOrder: 4,
      },
    ],
    isLoading: false,
  }),
  useAdminUpdateActionConfig: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("AdminActionConfig", () => {
  it("renders card title", () => {
    render(<AdminActionConfig />);
    expect(screen.getByText("Configurazione Punti")).toBeInTheDocument();
  });

  it("renders all 4 action labels", () => {
    render(<AdminActionConfig />);
    expect(screen.getByText("Call mensile")).toBeInTheDocument();
    expect(screen.getByText("Feedback inviato")).toBeInTheDocument();
    expect(screen.getByText("Invita un amico")).toBeInTheDocument();
    expect(screen.getByText("Primo import XML")).toBeInTheDocument();
  });

  it("renders point values with + prefix", () => {
    render(<AdminActionConfig />);
    expect(screen.getByText("+50 pt")).toBeInTheDocument();
    expect(screen.getByText("+30 pt")).toBeInTheDocument();
    const fifteenPts = screen.getAllByText("+15 pt");
    expect(fifteenPts).toHaveLength(2);
  });

  it("renders frequency labels", () => {
    render(<AdminActionConfig />);
    expect(screen.getByText("max 1 ogni 30 giorni")).toBeInTheDocument();
    expect(screen.getByText("max 1 ogni 7 giorni")).toBeInTheDocument();
    expect(screen.getByText("ogni amico, max 10/mese")).toBeInTheDocument();
    expect(screen.getByText("una tantum")).toBeInTheDocument();
  });

  it("renders edit buttons for each row", () => {
    render(<AdminActionConfig />);
    const editButtons = screen.getAllByTitle("Modifica punti");
    expect(editButtons).toHaveLength(4);
  });

  it("renders table headers", () => {
    render(<AdminActionConfig />);
    expect(screen.getByText("Azione")).toBeInTheDocument();
    expect(screen.getByText("Punti")).toBeInTheDocument();
    expect(screen.getByText("Frequenza")).toBeInTheDocument();
    expect(screen.getByText("Modifica")).toBeInTheDocument();
  });
});
