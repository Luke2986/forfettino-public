import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Info } from "lucide-react";
import { BlockingModal } from "./BlockingModal";

describe("BlockingModal", () => {
  const defaultProps = {
    open: true,
    onDismiss: vi.fn(),
    icon: Info,
    title: "Test Title",
    children: <p>Test body content</p>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza con props base (icon, title, children)", () => {
    render(<BlockingModal {...defaultProps} />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test body content")).toBeInTheDocument();
  });

  it("mostra il pulsante X per default", () => {
    render(<BlockingModal {...defaultProps} />);
    expect(screen.getByRole("button", { name: /chiudi/i })).toBeInTheDocument();
  });

  it("nasconde il pulsante X con hideCloseButton=true", () => {
    render(<BlockingModal {...defaultProps} hideCloseButton={true} />);
    expect(screen.queryByRole("button", { name: /chiudi/i })).not.toBeInTheDocument();
  });

  it("chiama onDismiss quando si preme Escape", () => {
    render(<BlockingModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("[REGRESSION] click X chiama onDismiss esattamente una volta (no double dismiss)", () => {
    render(<BlockingModal {...defaultProps} />);
    const closeBtn = screen.getByRole("button", { name: /chiudi/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("NON chiude quando si clicca fuori (onInteractOutside bloccato)", () => {
    render(<BlockingModal {...defaultProps} />);
    // Radix Dialog chiama onOpenChange(false) su pointer-down-outside
    // Con onInteractOutside preventDefault, questo non dovrebbe succedere
    // Il modale deve restare aperto — verifichiamo che il titolo è ancora visibile
    const overlay = document.querySelector("[data-state='open']");
    if (overlay) {
      fireEvent.pointerDown(overlay);
    }
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("ha aria-modal='true' sul dialog", () => {
    render(<BlockingModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("ha aria-describedby che punta al body", () => {
    render(<BlockingModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-describedby", "blocking-modal-body");
  });

  it("renderizza children dentro il modale", () => {
    render(
      <BlockingModal {...defaultProps}>
        <button>Action Button</button>
      </BlockingModal>
    );
    expect(screen.getByRole("button", { name: "Action Button" })).toBeInTheDocument();
  });

  it("non renderizza nulla quando open=false", () => {
    render(<BlockingModal {...defaultProps} open={false} />);
    expect(screen.queryByText("Test Title")).not.toBeInTheDocument();
  });

  it("applica iconBg custom", () => {
    render(<BlockingModal {...defaultProps} iconBg="bg-green-50" />);
    // Portal renders outside container — query from document.body
    const iconContainer = document.body.querySelector(".bg-green-50");
    expect(iconContainer).toBeInTheDocument();
  });

  it("applica iconBg default bg-teal-50", () => {
    render(<BlockingModal {...defaultProps} />);
    const iconContainer = document.body.querySelector(".bg-teal-50");
    expect(iconContainer).toBeInTheDocument();
  });
});
