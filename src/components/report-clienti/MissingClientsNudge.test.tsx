import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MissingClientsNudge } from "./MissingClientsNudge";

function renderWithRouter(pct: number) {
  return render(
    <MemoryRouter>
      <MissingClientsNudge nullClientPercentage={pct} />
    </MemoryRouter>,
  );
}

describe("MissingClientsNudge", () => {
  it("renders nudge when > 30%", () => {
    renderWithRouter(45);
    expect(screen.getByText(/Associa un cliente/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vai agli incassi/ })).toHaveAttribute(
      "href",
      "/incassi",
    );
  });

  it("renders nothing when <= 30%", () => {
    const { container } = renderWithRouter(30);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when 0%", () => {
    const { container } = renderWithRouter(0);
    expect(container.firstChild).toBeNull();
  });
});
