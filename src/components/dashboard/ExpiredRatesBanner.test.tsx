import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpiredRatesBanner } from "./ExpiredRatesBanner";

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

describe("ExpiredRatesBanner", () => {
  it("renderizza con N rate scadute, titolo mostra N corretto (plurale)", () => {
    render(
      <ExpiredRatesBanner expiredCount={3} isDismissed={false} onDismiss={vi.fn()} />
    );

    expect(screen.getByText(/3 rate con scadenza passata/)).toBeInTheDocument();
  });

  it("usa singolare 'rata' quando expiredCount === 1", () => {
    render(
      <ExpiredRatesBanner expiredCount={1} isDismissed={false} onDismiss={vi.fn()} />
    );

    expect(screen.getByText(/1 rata con scadenza passata/)).toBeInTheDocument();
  });

  it("CTA naviga a /scadenziario", () => {
    mockNavigate.mockClear();
    render(
      <ExpiredRatesBanner expiredCount={2} isDismissed={false} onDismiss={vi.fn()} />
    );

    const cta = screen.getByText(/Vai allo Scadenziario/);
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith("/scadenziario");
  });

  it("dismiss callback invocato al click", () => {
    const onDismiss = vi.fn();
    render(
      <ExpiredRatesBanner expiredCount={2} isDismissed={false} onDismiss={onDismiss} />
    );

    const dismissBtn = screen.getByText(/Nascondi questo avviso/);
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("non renderizza se expiredCount === 0", () => {
    const { container } = render(
      <ExpiredRatesBanner expiredCount={0} isDismissed={false} onDismiss={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("non renderizza se isDismissed === true", () => {
    const { container } = render(
      <ExpiredRatesBanner expiredCount={3} isDismissed={true} onDismiss={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("attributi accessibilità presenti (role, aria-live, aria-label)", () => {
    render(
      <ExpiredRatesBanner expiredCount={2} isDismissed={false} onDismiss={vi.fn()} />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "polite");

    const dismissBtn = screen.getByLabelText("Chiudi avviso");
    expect(dismissBtn).toBeInTheDocument();
  });
});
