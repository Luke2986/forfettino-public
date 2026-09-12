import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConcentrationAlert } from "./ConcentrationAlert";

describe("ConcentrationAlert (Story 58.3 — redesign amber)", () => {
  it("renders amber banner for molto_concentrato with new copy", () => {
    render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={78.5}
        topClientName="Acme Corp"
      />,
    );
    expect(screen.getByText(/79% del fatturato dipende da/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.queryByText(/Diversificare riduce il rischio/)).toBeNull();
  });

  it("molto_concentrato uses amber styles (not red)", () => {
    const { container } = render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={80}
        topClientName="Test"
      />,
    );
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain("bg-amber-50");
    expect(banner.className).toContain("border-amber-200/60");
    expect(banner.className).not.toContain("bg-red");
  });

  it("renders amber banner for concentrato with client name", () => {
    render(
      <ConcentrationAlert
        concentration="concentrato"
        topClientPct={55.3}
        topClientName="Beta Srl"
      />,
    );
    expect(screen.getByText(/Beta Srl/)).toBeInTheDocument();
    expect(screen.getByText(/55% del fatturato/)).toBeInTheDocument();
  });

  it("concentrato shows client name in font-semibold", () => {
    render(
      <ConcentrationAlert
        concentration="concentrato"
        topClientPct={60}
        topClientName="Gamma Srl"
      />,
    );
    const nameSpan = screen.getByText("Gamma Srl");
    expect(nameSpan.className).toContain("font-semibold");
  });

  it("returns null for moderato (suppressed)", () => {
    const { container } = render(
      <ConcentrationAlert
        concentration="moderato"
        topClientPct={30}
        topClientName="Gamma"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null for diversificato", () => {
    const { container } = render(
      <ConcentrationAlert
        concentration="diversificato"
        topClientPct={15}
        topClientName="Delta"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rounds topClientPct to integer", () => {
    render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={78.7}
        topClientName="Test"
      />,
    );
    expect(screen.getByText(/79%/)).toBeInTheDocument();
    expect(screen.queryByText(/78\.7/)).toBeNull();
  });
});

describe("ConcentrationAlert — mini barra rischio (Story 59.4)", () => {
  it("mostra barra rischio per molto_concentrato con aria-valuenow corretto", () => {
    render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={80}
        topClientName="Acme Corp"
      />,
    );
    const meter = screen.getByRole("meter");
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute("aria-valuenow", "80");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute(
      "aria-label",
      "Concentrazione: 80% del fatturato dal primo cliente",
    );
  });

  it("mostra barra rischio per concentrato con aria-valuenow corretto", () => {
    render(
      <ConcentrationAlert
        concentration="concentrato"
        topClientPct={55}
        topClientName="Beta Srl"
      />,
    );
    const meter = screen.getByRole("meter");
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute("aria-valuenow", "55");
  });

  it("colore barra bg-red-400 per pct >= 75", () => {
    render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={80}
        topClientName="Test"
      />,
    );
    const meter = screen.getByRole("meter");
    const fill = meter.firstChild as HTMLElement;
    expect(fill.className).toContain("bg-red-400");
    expect(fill.className).not.toContain("bg-amber-400");
    expect(fill.className).not.toContain("bg-teal-400");
  });

  it("colore barra bg-amber-400 per pct 50-74", () => {
    render(
      <ConcentrationAlert
        concentration="concentrato"
        topClientPct={60}
        topClientName="Test"
      />,
    );
    const meter = screen.getByRole("meter");
    const fill = meter.firstChild as HTMLElement;
    expect(fill.className).toContain("bg-amber-400");
    expect(fill.className).not.toContain("bg-red-400");
  });

  it("colore barra bg-teal-400 per pct < 50", () => {
    render(
      <ConcentrationAlert
        concentration="concentrato"
        topClientPct={40}
        topClientName="Test"
      />,
    );
    const meter = screen.getByRole("meter");
    const fill = meter.firstChild as HTMLElement;
    expect(fill.className).toContain("bg-teal-400");
    expect(fill.className).not.toContain("bg-amber-400");
  });

  it("barra assente per moderato (componente null)", () => {
    const { container } = render(
      <ConcentrationAlert
        concentration="moderato"
        topClientPct={30}
        topClientName="Test"
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("barra assente per diversificato (componente null)", () => {
    const { container } = render(
      <ConcentrationAlert
        concentration="diversificato"
        topClientPct={15}
        topClientName="Test"
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("boundary: pct=75 esatto → bg-red-400 (>= 75)", () => {
    render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={75}
        topClientName="Test"
      />,
    );
    const meter = screen.getByRole("meter");
    const fill = meter.firstChild as HTMLElement;
    expect(fill.className).toContain("bg-red-400");
  });

  it("boundary: pct=50 esatto → bg-amber-400 (>= 50)", () => {
    render(
      <ConcentrationAlert
        concentration="concentrato"
        topClientPct={50}
        topClientName="Test"
      />,
    );
    const meter = screen.getByRole("meter");
    const fill = meter.firstChild as HTMLElement;
    expect(fill.className).toContain("bg-amber-400");
  });
});

describe("ConcentrationAlert — animazione width (Story 59.4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("width iniziale 0%, poi pct% dopo timeout 50ms", () => {
    render(
      <ConcentrationAlert
        concentration="molto_concentrato"
        topClientPct={80}
        topClientName="Test"
      />,
    );
    const meter = screen.getByRole("meter");
    const fill = meter.firstChild as HTMLElement;

    // Prima del timeout: width 0%
    expect(fill.style.width).toBe("0%");

    // Dopo 50ms: width 80%
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(fill.style.width).toBe("80%");
  });
});
