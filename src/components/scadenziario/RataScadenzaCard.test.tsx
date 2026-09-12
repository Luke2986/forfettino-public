import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RataScadenzaCard } from "./RataScadenzaCard";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

function makeSchedule(overrides: Partial<TaxScheduleRow> = {}): TaxScheduleRow {
  return {
    id: "test-id",
    user_id: "user-1",
    payment_year: 2026,
    reference_year: 2025,
    bucket: "june",
    due_date: "2026-06-16",
    tax_balance: 0,
    tax_advance: 0,
    inps_balance: 0,
    inps_advance: 0,
    total_expected: 1000,
    total_paid: 0,
    status: "open",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as TaxScheduleRow;
}

describe("RataScadenzaCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── AC 2: Mostra tipo rata, importo, data, badge stato ──

  it("renders bucket label, type, date and amount", () => {
    const schedule = makeSchedule({
      bucket: "june",
      total_expected: 1500,
      due_date: "2026-06-16",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    expect(screen.getByText("Rata Giugno")).toBeTruthy();
    expect(screen.getByText(/Mista \(INPS \+ Tasse\)/)).toBeTruthy();
    expect(screen.getByText(/16\/06\/2026/)).toBeTruthy();
    // Amount - jsdom may render "1.500,00 €" or "1500,00 €" depending on locale
    expect(screen.getByText(/1\.?500/)).toBeTruthy();
  });

  // ── AC 3: Badge stati dinamici ──

  it("shows Pagata badge (green) when status is paid", () => {
    const schedule = makeSchedule({ status: "paid" });
    render(<RataScadenzaCard schedule={schedule} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.textContent).toContain("Pagata");
    expect(badge.className).toContain("bg-success-muted");
  });

  it("shows Scaduta badge (red) when past due and not paid", () => {
    const schedule = makeSchedule({
      status: "open",
      due_date: "2026-05-01",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.textContent).toContain("Scaduta");
    expect(badge.className).toContain("bg-destructive-muted");
  });

  it("shows Tra N giorni badge (amber) when due within 30 days", () => {
    const schedule = makeSchedule({
      status: "open",
      due_date: "2026-06-16",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.textContent).toContain("Tra 15 giorni");
    expect(badge.className).toContain("bg-warning-muted");
  });

  it("shows Oggi badge when due today", () => {
    const schedule = makeSchedule({
      status: "open",
      due_date: "2026-06-01",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.textContent).toContain("Oggi");
  });

  it("shows Da pagare badge (muted) when due in more than 30 days", () => {
    const schedule = makeSchedule({
      status: "open",
      due_date: "2026-08-16",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.textContent).toContain("Da pagare");
    expect(badge.className).toContain("bg-secondary");
  });

  // ── AC 4: colore + testo + icona ──

  it("renders icon alongside badge text for each status", () => {
    // Test paid status has SVG icon
    const schedule = makeSchedule({ status: "paid" });
    const { container } = render(<RataScadenzaCard schedule={schedule} />);

    const badge = screen.getByTestId("status-badge");
    const svg = badge.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(badge.textContent).toContain("Pagata");
  });

  // ── AC 6: role="article" + aria-label ──

  it("has role=article and descriptive aria-label", () => {
    const schedule = makeSchedule({
      bucket: "inps_q1",
      total_expected: 1008,
      due_date: "2026-02-16",
      status: "paid",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const card = screen.getByRole("article");
    expect(card).toBeTruthy();
    const ariaLabel = card.getAttribute("aria-label") || "";
    expect(ariaLabel).toContain("Fissa trimestrale");
    // jsdom may format as "1.008,00 €" or "1008,00 €"
    expect(ariaLabel).toMatch(/1\.?008/);
    expect(ariaLabel).toContain("16/02/2026");
    expect(ariaLabel).toContain("Pagata");
  });

  // ── AC 7: Breakdown importo ──

  it("shows breakdown for INPS_FISSO with minimale + maternita", () => {
    const schedule = makeSchedule({
      bucket: "inps_q1",
      inps_balance: 1000,
      inps_advance: 8,
      total_expected: 1008,
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const breakdown = screen.getByTestId("breakdown-section");
    expect(breakdown).toBeTruthy();
    expect(screen.getByText("Minimale")).toBeTruthy();
    expect(screen.getByText(/Maternità/)).toBeTruthy();
  });

  it("shows breakdown for MISTA (june) with all components", () => {
    const schedule = makeSchedule({
      bucket: "june",
      tax_balance: 500,
      tax_advance: 300,
      inps_balance: 200,
      inps_advance: 100,
      reference_year: 2025,
      total_expected: 1100,
    });
    render(<RataScadenzaCard schedule={schedule} />);

    const breakdown = screen.getByTestId("breakdown-section");
    expect(breakdown).toBeTruthy();
    expect(screen.getByText("Saldo Imposta 2025")).toBeTruthy();
    expect(screen.getByText("Acconto Imposta 2026")).toBeTruthy();
    expect(screen.getByText("Saldo INPS 2025")).toBeTruthy();
    expect(screen.getByText("Acconto INPS 2026")).toBeTruthy();
  });

  it("does not show breakdown when only one component exists", () => {
    const schedule = makeSchedule({
      bucket: "saldo_tax",
      tax_balance: 800,
      total_expected: 800,
    });
    render(<RataScadenzaCard schedule={schedule} />);

    expect(screen.queryByTestId("breakdown-section")).toBeNull();
  });

  // ── Pagamento parziale ──

  it("shows partial payment info when total_paid > 0 and not fully paid", () => {
    const schedule = makeSchedule({
      status: "open",
      total_expected: 1000,
      total_paid: 400,
      due_date: "2026-08-16",
    });
    render(<RataScadenzaCard schedule={schedule} />);

    expect(screen.getByText(/Pagato:/)).toBeTruthy();
  });

  it("does not show partial payment info when fully paid", () => {
    const schedule = makeSchedule({
      status: "paid",
      total_expected: 1000,
      total_paid: 1000,
    });
    render(<RataScadenzaCard schedule={schedule} />);

    expect(screen.queryByText(/Pagato:/)).toBeNull();
  });

  // ── Tipi diversi di bucket ──

  it("renders INPS_VARIABILE type correctly", () => {
    const schedule = makeSchedule({
      bucket: "saldo_inps",
      inps_balance: 600,
      total_expected: 600,
    });
    render(<RataScadenzaCard schedule={schedule} />);

    expect(screen.getByText("Saldo INPS")).toBeTruthy();
    expect(screen.getByText(/Variabile/)).toBeTruthy();
  });

  it("renders TAX type correctly", () => {
    const schedule = makeSchedule({
      bucket: "acconto_tax_1",
      tax_advance: 500,
      total_expected: 500,
    });
    render(<RataScadenzaCard schedule={schedule} />);

    expect(screen.getByText("I° Acconto Imposta")).toBeTruthy();
    expect(screen.getByText(/Tasse/)).toBeTruthy();
  });
});
