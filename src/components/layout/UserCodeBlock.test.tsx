import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserCodeBlock } from "./UserCodeBlock";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Wrap with TooltipProvider since Tooltip requires it
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: any }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: any }) => <>{children}</>,
  TooltipContent: ({ children }: { children: any }) => <span>{children}</span>,
}));

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("UserCodeBlock", () => {
  it("does not render when userCode is undefined", () => {
    const { container } = render(<UserCodeBlock userCode={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the code when userCode is provided", () => {
    render(<UserCodeBlock userCode="LF26K3M9X" />);
    expect(screen.getByText("LF26K3M9X")).toBeInTheDocument();
  });

  it("renders the label 'Il tuo codice'", () => {
    render(<UserCodeBlock userCode="LF26K3M9X" />);
    expect(screen.getByText("Il tuo codice")).toBeInTheDocument();
  });

  it("has a copy button with correct aria-label", () => {
    render(<UserCodeBlock userCode="LF26K3M9X" />);
    expect(screen.getByRole("button", { name: "Copia codice" })).toBeInTheDocument();
  });

  it("calls navigator.clipboard.writeText on copy click", async () => {
    render(<UserCodeBlock userCode="LF26K3M9X" />);
    const button = screen.getByRole("button", { name: "Copia codice" });
    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("LF26K3M9X");
  });

  it("does not crash when clipboard.writeText rejects", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<UserCodeBlock userCode="LF26K3M9X" />);
    const button = screen.getByRole("button", { name: "Copia codice" });
    fireEvent.click(button);
    // Component should still be in the DOM (no unhandled rejection crash)
    expect(screen.getByText("LF26K3M9X")).toBeInTheDocument();
  });
});
