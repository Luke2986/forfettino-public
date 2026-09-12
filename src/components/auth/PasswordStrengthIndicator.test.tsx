import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

describe("PasswordStrengthIndicator", () => {
  it("renders nothing when show is false", () => {
    const { container } = render(
      <PasswordStrengthIndicator password="Abc123!x" show={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when password is empty and show is true", () => {
    const { container } = render(
      <PasswordStrengthIndicator password="" show={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders indicator when show is true and password has content", () => {
    render(<PasswordStrengthIndicator password="a" show={true} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows weak state for poor password", () => {
    render(<PasswordStrengthIndicator password="abc" show={true} />);
    expect(screen.getByText("Debole")).toBeInTheDocument();
  });

  it("shows medium state for decent password", () => {
    render(<PasswordStrengthIndicator password="Abcdefgh" show={true} />);
    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("shows strong state for strong password", () => {
    render(<PasswordStrengthIndicator password="Abcdefg1!" show={true} />);
    expect(screen.getByText("Forte")).toBeInTheDocument();
  });

  it("shows checklist with all 5 requirements", () => {
    render(<PasswordStrengthIndicator password="a" show={true} />);
    expect(screen.getByText("Almeno 8 caratteri")).toBeInTheDocument();
    expect(screen.getByText("Almeno una lettera maiuscola")).toBeInTheDocument();
    expect(screen.getByText("Almeno una lettera minuscola")).toBeInTheDocument();
    expect(screen.getByText("Almeno un numero")).toBeInTheDocument();
    expect(screen.getByText("Almeno un simbolo speciale")).toBeInTheDocument();
  });

  it("has aria-live polite for accessibility", () => {
    render(<PasswordStrengthIndicator password="a" show={true} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
