import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownTimer } from "./CountdownTimer";

describe("CountdownTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows countdown values for a future date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00+00:00"));

    const target = new Date("2026-04-08T12:00:00+00:00"); // 1 day later
    render(<CountdownTimer targetDate={target} />);

    expect(screen.getByText("01")).toBeInTheDocument(); // 1 day
    expect(screen.getByText("Giorni")).toBeInTheDocument();
    expect(screen.getByText("Ore")).toBeInTheDocument();
    expect(screen.getByText("Minuti")).toBeInTheDocument();
    expect(screen.getByText("Secondi")).toBeInTheDocument();
  });

  it("shows fallback when targetDate is null", () => {
    render(<CountdownTimer targetDate={null} />);

    expect(
      screen.getByText("Lancio previsto primavera 2026 — iscriviti per essere avvisato"),
    ).toBeInTheDocument();
  });

  it("shows fallback when targetDate is in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00+00:00"));

    const pastDate = new Date("2026-04-06T12:00:00+00:00");
    render(<CountdownTimer targetDate={pastDate} />);

    expect(
      screen.getByText("Lancio previsto primavera 2026 — iscriviti per essere avvisato"),
    ).toBeInTheDocument();
  });

  it("shows custom fallback label", () => {
    render(<CountdownTimer targetDate={null} fallbackLabel="Coming soon!" />);
    expect(screen.getByText("Coming soon!")).toBeInTheDocument();
  });
});
