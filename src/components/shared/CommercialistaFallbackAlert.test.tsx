import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommercialistaFallbackAlert } from "./CommercialistaFallbackAlert";

describe("CommercialistaFallbackAlert", () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    mockOnDismiss.mockClear();
  });

  // --- Rendering per ogni trigger ---

  it("trigger 'expired_rates_30d' mostra messaggio rate scadute > 30gg", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="expired_rates_30d"
        onDismiss={mockOnDismiss}
      />
    );

    // Body message contains the full sentence
    expect(
      screen.getByText(/Hai rate scadute da più di un mese/i)
    ).toBeInTheDocument();
  });

  it("trigger 'settings_variation' mostra messaggio calcoli aggiornati", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="settings_variation"
        onDismiss={mockOnDismiss}
      />
    );

    expect(
      screen.getByText(/calcoli sono stati aggiornati/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/verifica la situazione col tuo commercialista/i)
    ).toBeInTheDocument();
  });

  it("trigger 'gestione_blocked' mostra messaggio cambio gestione bloccato", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="gestione_blocked"
        onDismiss={mockOnDismiss}
      />
    );

    expect(
      screen.getByText(/cambiare gestione INPS/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/implicazioni fiscali/i)
    ).toBeInTheDocument();
  });

  // --- Dismiss ---

  it("bottone dismiss visibile quando isDismissible=true (default)", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="expired_rates_30d"
        onDismiss={mockOnDismiss}
      />
    );

    expect(
      screen.getByText(/Nascondi questo avviso/i)
    ).toBeInTheDocument();
  });

  it("bottone dismiss NON visibile quando isDismissible=false", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="expired_rates_30d"
        isDismissible={false}
        onDismiss={mockOnDismiss}
      />
    );

    expect(
      screen.queryByText(/Nascondi questo avviso/i)
    ).not.toBeInTheDocument();
  });

  it("onDismiss chiamato al click sul bottone dismiss", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="expired_rates_30d"
        onDismiss={mockOnDismiss}
      />
    );

    fireEvent.click(screen.getByText(/Nascondi questo avviso/i));
    expect(mockOnDismiss).toHaveBeenCalledOnce();
  });

  // --- Accessibilità ---

  it("attributi accessibilità presenti (role='region', aria-label, aria-live)", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="expired_rates_30d"
        onDismiss={mockOnDismiss}
      />
    );

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Avviso commercialista");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("dismiss button ha aria-label 'Chiudi avviso'", () => {
    render(
      <CommercialistaFallbackAlert
        trigger="expired_rates_30d"
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByLabelText("Chiudi avviso")).toBeInTheDocument();
  });
});
