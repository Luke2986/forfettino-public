import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpcomingDeadlines, bucketToLabel, daysColorClass, daysLabel } from "./UpcomingDeadlines";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import type { DeadlineInfo } from "@/hooks/useFiscalCalculations";

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Helper per creare deadline di test (valori in euro, non centesimi)
function makeDeadline(overrides: Partial<DeadlineInfo> & { id: string }): DeadlineInfo {
  return {
    bucket: "june",
    paymentYear: 2026,
    dueDate: "2026-06-30",
    totalExpected: 3000,
    totalPaid: 0,
    remaining: 3000,
    isEstimate: false,
    ...overrides,
  };
}

describe("UpcomingDeadlines", () => {
  it("renderizza 1 scadenza con label, importo, data e giorni", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));

    const remaining = 1500;
    const deadlines = [makeDeadline({ id: "d1", dueDate: "2026-06-30", remaining })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    // Label bucket
    expect(screen.getByText("Rata Giugno")).toBeInTheDocument();
    // Importo formattato con formatCurrency (adattivo alla locale)
    expect(screen.getByText(new RegExp(formatCurrency(remaining).replace(/[€\s]/g, "").replace(/[.,]/g, "[.,]")))).toBeInTheDocument();
    // Data formattata dd/MM/yyyy
    expect(screen.getByText(/30\/06\/2026/)).toBeInTheDocument();
    // Giorni rimanenti
    expect(screen.getByText(/29 giorni/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("renderizza 3 scadenze in ordine cronologico, tutte visibili", () => {
    const deadlines = [
      makeDeadline({ id: "d1", bucket: "june", dueDate: "2026-06-30" }),
      makeDeadline({ id: "d2", bucket: "november", dueDate: "2026-11-30" }),
      makeDeadline({ id: "d3", bucket: "saldo_tax", dueDate: "2027-06-30" }),
    ];

    render(<UpcomingDeadlines deadlines={deadlines} />);

    expect(screen.getByText("Rata Giugno")).toBeInTheDocument();
    expect(screen.getByText("Rata Novembre")).toBeInTheDocument();
    expect(screen.getByText("Saldo Imposta")).toBeInTheDocument();
    // Tutte e 3 visibili
    const items = screen.getAllByTestId("deadline-item");
    expect(items).toHaveLength(3);
  });

  it("con 0 scadenze non renderizza nulla", () => {
    const { container } = render(<UpcomingDeadlines deadlines={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("raggruppa scadenze dello stesso mese con header e totale", () => {
    const deadlines = [
      makeDeadline({ id: "d1", bucket: "june", dueDate: "2026-06-30", remaining: 2000 }),
      makeDeadline({ id: "d2", bucket: "saldo_inps", dueDate: "2026-06-15", remaining: 1000 }),
    ];

    render(<UpcomingDeadlines deadlines={deadlines} />);

    // Header raggruppamento mese
    expect(screen.getByText(/Giugno 2026/)).toBeInTheDocument();
    // Totale del gruppo (2000 + 1000 = 3000) — verifico che l'output di formatCurrency sia presente
    const totalFormatted = formatCurrency(3000);
    expect(screen.getByText(new RegExp(totalFormatted.replace(/[€\s]/g, "").replace(/[.,]/g, "[.,]")))).toBeInTheDocument();
  });

  it("nessun header raggruppamento se 1 sola scadenza nel mese", () => {
    const deadlines = [
      makeDeadline({ id: "d1", bucket: "june", dueDate: "2026-06-30", remaining: 2000 }),
      makeDeadline({ id: "d2", bucket: "november", dueDate: "2026-11-30", remaining: 1000 }),
    ];

    render(<UpcomingDeadlines deadlines={deadlines} />);

    // Nessun header raggruppamento perché ogni mese ha 1 sola scadenza
    const groupHeaders = screen.queryAllByTestId("month-group-header");
    expect(groupHeaders).toHaveLength(0);
  });

  it("giorni ≤7 → classe text-destructive", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T00:00:00"));

    const deadlines = [makeDeadline({ id: "d1", dueDate: "2026-06-30", remaining: 1000 })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    const daysEl = screen.getByTestId("deadline-days-d1");
    expect(daysEl.className).toContain("text-destructive");

    vi.useRealTimers();
  });

  it("giorni ≤30 → classe text-warning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00"));

    const deadlines = [makeDeadline({ id: "d1", dueDate: "2026-06-30", remaining: 1000 })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    const daysEl = screen.getByTestId("deadline-days-d1");
    expect(daysEl.className).toContain("text-warning");

    vi.useRealTimers();
  });

  it("giorni >30 → classe text-muted-foreground", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T00:00:00"));

    const deadlines = [makeDeadline({ id: "d1", dueDate: "2026-06-30", remaining: 1000 })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    const daysEl = screen.getByTestId("deadline-days-d1");
    expect(daysEl.className).toContain("text-muted-foreground");

    vi.useRealTimers();
  });

  it("importo formattato con formatCurrency (no numero raw)", () => {
    const remaining = 1234.56;
    const deadlines = [makeDeadline({ id: "d1", remaining })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    // Verifica che l'output di formatCurrency(1234.56) sia nel DOM
    const formatted = formatCurrency(remaining);
    expect(screen.getByText(new RegExp(formatted.replace(/[€\s]/g, "").replace(/[.,]/g, "[.,]")))).toBeInTheDocument();
  });

  it("mostra link 'Vai allo scadenziario'", () => {
    const deadlines = [makeDeadline({ id: "d1" })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    expect(screen.getByText(/Vai allo scadenziario/)).toBeInTheDocument();
  });

  it("click su 'Vai allo scadenziario' naviga a /scadenziario", () => {
    mockNavigate.mockClear();
    const deadlines = [makeDeadline({ id: "d1" })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    const link = screen.getByText(/Vai allo scadenziario/);
    fireEvent.click(link);
    expect(mockNavigate).toHaveBeenCalledWith("/scadenziario");
  });

  it("backward compat — con 1 sola scadenza, output leggibile", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));

    const remaining = 5000;
    const deadlines = [makeDeadline({ id: "d1", bucket: "june", dueDate: "2026-06-30", remaining })];
    render(<UpcomingDeadlines deadlines={deadlines} />);

    expect(screen.getByText("Rata Giugno")).toBeInTheDocument();
    const formatted = formatCurrency(remaining);
    expect(screen.getByText(new RegExp(formatted.replace(/[€\s]/g, "").replace(/[.,]/g, "[.,]")))).toBeInTheDocument();
    expect(screen.getByText(/30\/06\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/29 giorni/)).toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe("bucketToLabel", () => {
  it.each([
    ["june", "Rata Giugno"],
    ["november", "Rata Novembre"],
    ["inps_q1", "Rata INPS Q1 (Feb)"],
    ["inps_q2", "Rata INPS Q2 (Mag)"],
    ["inps_q3", "Rata INPS Q3 (Ago)"],
    ["inps_q4", "Rata INPS Q4 (Nov)"],
    ["saldo_tax", "Saldo Imposta"],
    ["saldo_inps", "Saldo INPS"],
    ["acconto_tax_1", "I° Acconto Imposta"],
    ["acconto_tax_2", "II° Acconto Imposta"],
    ["acconto_inps_1", "I° Acconto INPS"],
    ["acconto_inps_2", "II° Acconto INPS"],
    ["unknown_bucket", "Scadenza Fiscale"],
  ])("mappa '%s' → '%s'", (bucket, expected) => {
    expect(bucketToLabel(bucket)).toBe(expected);
  });
});

describe("daysLabel", () => {
  it("giorni negativi → 'scaduta da N giorni'", () => {
    expect(daysLabel(-3)).toBe("scaduta da 3 giorni");
    expect(daysLabel(-1)).toBe("scaduta da 1 giorni");
  });

  it("0 giorni → 'oggi'", () => {
    expect(daysLabel(0)).toBe("oggi");
  });

  it("1 giorno → 'domani'", () => {
    expect(daysLabel(1)).toBe("domani");
  });

  it("giorni positivi → 'tra N giorni'", () => {
    expect(daysLabel(5)).toBe("tra 5 giorni");
    expect(daysLabel(30)).toBe("tra 30 giorni");
    expect(daysLabel(365)).toBe("tra 365 giorni");
  });
});

describe("daysColorClass", () => {
  it("≤7 giorni → text-destructive", () => {
    expect(daysColorClass(0)).toContain("text-destructive");
    expect(daysColorClass(7)).toContain("text-destructive");
  });

  it("≤30 giorni → text-warning", () => {
    expect(daysColorClass(8)).toContain("text-warning");
    expect(daysColorClass(30)).toContain("text-warning");
  });

  it(">30 giorni → text-muted-foreground", () => {
    expect(daysColorClass(31)).toContain("text-muted-foreground");
    expect(daysColorClass(365)).toContain("text-muted-foreground");
  });
});
