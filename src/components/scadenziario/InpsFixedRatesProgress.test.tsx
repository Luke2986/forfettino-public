import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InpsFixedRatesProgress } from "./InpsFixedRatesProgress";
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

describe("InpsFixedRatesProgress", () => {
  it("renders progress bar with 2/4 rate pagate", () => {
    const schedules = [
      makeSchedule({ id: "1", bucket: "inps_q1", status: "paid" }),
      makeSchedule({ id: "2", bucket: "inps_q2", status: "paid" }),
      makeSchedule({ id: "3", bucket: "inps_q3", status: "open" }),
      makeSchedule({ id: "4", bucket: "inps_q4", status: "open" }),
      makeSchedule({ id: "5", bucket: "june", status: "open" }),
    ];
    render(<InpsFixedRatesProgress schedules={schedules} />);

    expect(screen.getByText("2 su 4 rate pagate")).toBeTruthy();
    expect(screen.getByText("Rate INPS fisse")).toBeTruthy();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("2");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("4");
    expect(progressbar.getAttribute("aria-label")).toBe("Copertura rate INPS fisse");
  });

  it("renders 0/4 when none paid", () => {
    const schedules = [
      makeSchedule({ id: "1", bucket: "inps_q1", status: "open" }),
      makeSchedule({ id: "2", bucket: "inps_q2", status: "open" }),
      makeSchedule({ id: "3", bucket: "inps_q3", status: "open" }),
      makeSchedule({ id: "4", bucket: "inps_q4", status: "open" }),
    ];
    render(<InpsFixedRatesProgress schedules={schedules} />);

    expect(screen.getByText("0 su 4 rate pagate")).toBeTruthy();
  });

  it("renders 4/4 when all paid", () => {
    const schedules = [
      makeSchedule({ id: "1", bucket: "inps_q1", status: "paid" }),
      makeSchedule({ id: "2", bucket: "inps_q2", status: "paid" }),
      makeSchedule({ id: "3", bucket: "inps_q3", status: "paid" }),
      makeSchedule({ id: "4", bucket: "inps_q4", status: "paid" }),
    ];
    render(<InpsFixedRatesProgress schedules={schedules} />);

    expect(screen.getByText("4 su 4 rate pagate")).toBeTruthy();
  });

  it("renders nothing when no INPS fixed rates exist (Separata)", () => {
    const schedules = [
      makeSchedule({ id: "1", bucket: "june", status: "open" }),
      makeSchedule({ id: "2", bucket: "november", status: "open" }),
    ];
    const { container } = render(<InpsFixedRatesProgress schedules={schedules} />);

    expect(screen.queryByTestId("inps-fixed-progress")).toBeNull();
    expect(container.innerHTML).toBe("");
  });
});
