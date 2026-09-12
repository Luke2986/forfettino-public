import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnpaidSchedulesSummary } from "./UnpaidSchedulesSummary";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

function makeSchedule(overrides: Partial<TaxScheduleRow> = {}): TaxScheduleRow {
  return {
    id: "sched-1",
    user_id: "user-1",
    bucket: "june",
    due_date: "2025-06-30",
    payment_year: 2026,
    reference_year: 2025,
    status: "open",
    total_expected: 1500,
    total_paid: 0,
    tax_balance: 500,
    tax_advance: 300,
    inps_balance: 400,
    inps_advance: 300,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("UnpaidSchedulesSummary", () => {
  it("renderizza con lista di schedule scadute non pagate", () => {
    const schedules = [
      makeSchedule({ id: "s1", bucket: "inps_q1", due_date: "2025-05-16", total_expected: 1073 }),
      makeSchedule({ id: "s2", bucket: "june", due_date: "2025-06-30", total_expected: 4850 }),
    ];

    render(<UnpaidSchedulesSummary schedules={schedules} />);

    expect(screen.getByText(/Scadenze Passate Non Pagate/i)).toBeInTheDocument();
    // Should show 2 schedule entries
    expect(screen.getByText(/Rata INPS Q1/i)).toBeInTheDocument();
    expect(screen.getByText(/Rata Giugno/i)).toBeInTheDocument();
  });

  it("restituisce null se array vuoto", () => {
    const { container } = render(<UnpaidSchedulesSummary schedules={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra footer note disclaimer commercialista", () => {
    const schedules = [makeSchedule()];
    render(<UnpaidSchedulesSummary schedules={schedules} />);

    expect(
      screen.getByText(/importi potrebbero differire/i)
    ).toBeInTheDocument();
  });

  it("CTA 'Vai allo Scadenziario' presente", () => {
    const schedules = [makeSchedule()];
    render(<UnpaidSchedulesSummary schedules={schedules} />);

    expect(screen.getByText(/Vai allo Scadenziario/i)).toBeInTheDocument();
  });

  it("formatta la data in formato italiano (dd/mm/yyyy)", () => {
    const schedules = [
      makeSchedule({ due_date: "2025-06-30" }),
    ];
    render(<UnpaidSchedulesSummary schedules={schedules} />);

    expect(screen.getByText(/30\/06\/2025/)).toBeInTheDocument();
  });

  it("formatta l'importo in euro", () => {
    const schedules = [
      makeSchedule({ total_expected: 1500 }),
    ];
    render(<UnpaidSchedulesSummary schedules={schedules} />);

    // jsdom Intl format varies: could be "1.500,00 €" or "1500,00 €"
    expect(screen.getByText(/1\.?500/)).toBeInTheDocument();
  });
});
