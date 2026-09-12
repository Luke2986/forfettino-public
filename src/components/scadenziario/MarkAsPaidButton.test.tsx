import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MarkAsPaidButton } from "./MarkAsPaidButton";
import type { Database } from "@/integrations/supabase/types";

// Mock dell'helper analytics: verifichiamo che gli eventi intent/cancelled
// vengano emessi con i props giusti senza toccare Supabase/PostHog reali.
const { mockTrack } = vi.hoisted(() => ({ mockTrack: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  track: mockTrack,
}));

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

// Helper to create a schedule for tests
function makeSchedule(overrides: Partial<TaxScheduleRow> = {}): TaxScheduleRow {
  return {
    id: "sched-1",
    user_id: "user-1",
    bucket: "june",
    due_date: "2026-06-16",
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as TaxScheduleRow;
}

describe("MarkAsPaidButton", () => {
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));
    mockOnConfirm.mockClear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── AC 9: Visibile per TUTTE le rate non pagate (non solo scadute) ──

  it("mostra il bottone per una rata scaduta non pagata", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-05-01" });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    expect(screen.getByRole("button", { name: /Segna come pagata/i })).toBeInTheDocument();
  });

  it("mostra il bottone per una rata FUTURA non pagata (Story 5.2)", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-08-16" });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    expect(screen.getByRole("button", { name: /Segna come pagata/i })).toBeInTheDocument();
  });

  it("mostra il bottone per una rata imminente non pagata", () => {
    const schedule = makeSchedule({ status: "open", due_date: "2026-06-16" });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    expect(screen.getByRole("button", { name: /Segna come pagata/i })).toBeInTheDocument();
  });

  it("NON mostra il bottone per una rata già pagata", () => {
    const schedule = makeSchedule({ status: "paid" });
    const { container } = render(
      <MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("NON mostra il bottone per importo zero", () => {
    const schedule = makeSchedule({ total_expected: 0 });
    const { container } = render(
      <MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />
    );

    expect(container.firstChild).toBeNull();
  });

  // ── AC 1, 2: Dialog con riepilogo e Calendar date picker ──

  it("click apre il Dialog con info rata", () => {
    const schedule = makeSchedule();
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    expect(screen.getByText(/Conferma pagamento/i)).toBeInTheDocument();
  });

  it("Dialog mostra importo, data scadenza e bottone data pagamento", () => {
    const schedule = makeSchedule({
      total_expected: 1500,
      due_date: "2026-06-16",
      bucket: "june",
    });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    // Amount (jsdom Intl format varies)
    expect(screen.getByText(/1\.?500/)).toBeInTheDocument();
    // Due date
    expect(screen.getByText(/16\/06\/2026/)).toBeInTheDocument();
    // Payment date label
    expect(screen.getByText(/Data pagamento/i)).toBeInTheDocument();
    // Calendar trigger button with today's date formatted as dd/MM/yyyy
    const dateBtn = screen.getByLabelText(/Data pagamento/i);
    expect(dateBtn).toBeInTheDocument();
    expect(dateBtn.textContent).toContain("01/06/2026");
  });

  // ── AC 4: Conferma con data scelta ──

  it("Conferma chiama onConfirm con (schedule.id, data ISO di oggi, payload) e chiude il dialog", () => {
    const schedule = makeSchedule({ id: "sched-42", total_expected: 1500 });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    // Click confirm with default date (today) e importo precompilato = stima
    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith(
      "2026-06-01",
      expect.objectContaining({
        // Importo precompilato con la stima → 1500 EUR = 150000 cent, banda verde
        amountPaidCents: 150000,
        reasonCode: null,
        note: null,
        context: expect.objectContaining({
          source: "scadenziario",
          daysToDue: expect.any(Number),
        }),
      }),
    );

    // Dialog should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── Cattura importo reale + tracking discrepanza (2026-06-09) ──

  it("precompila l'input importo con la stima", () => {
    const schedule = makeSchedule({ total_expected: 1500 });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    const amountInput = screen.getByTestId("amount-paid") as HTMLInputElement;
    expect(amountInput.value).toBe("1500.00");
    // Entro tolleranza: nessuna richiesta di motivo
    expect(screen.queryByTestId("discrepancy-reason")).not.toBeInTheDocument();
  });

  it("importo fuori banda verde mostra i chip motivo e li propaga", () => {
    const schedule = makeSchedule({ id: "sched-7", total_expected: 400 });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    // 400 stima → pago 500: delta 100 EUR = 25% → rosso → chiedi motivo
    fireEvent.change(screen.getByTestId("amount-paid"), { target: { value: "500" } });

    const reasonBox = screen.getByTestId("discrepancy-reason");
    expect(reasonBox).toBeInTheDocument();

    // Seleziona il chip "credito compensato" (reality)
    fireEvent.click(within(reasonBox).getByText(/Ho compensato un credito/i));
    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));

    expect(mockOnConfirm).toHaveBeenCalledWith(
      "2026-06-01",
      expect.objectContaining({
        amountPaidCents: 50000,
        reasonCode: "credito_compensato",
      }),
    );
  });

  it("non blocca la conferma anche senza motivo selezionato (fuori banda)", () => {
    const schedule = makeSchedule({ total_expected: 400 });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    fireEvent.change(screen.getByTestId("amount-paid"), { target: { value: "500" } });

    // Nessun chip selezionato → conferma comunque abilitata
    const confirmBtn = screen.getByRole("button", { name: /Conferma/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ amountPaidCents: 50000, reasonCode: null }),
    );
  });

  it("importo vuoto o zero disabilita la conferma", () => {
    const schedule = makeSchedule({ total_expected: 1500 });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    fireEvent.change(screen.getByTestId("amount-paid"), { target: { value: "" } });

    expect(screen.getByRole("button", { name: /Conferma/i })).toBeDisabled();
  });

  // ── Conferma disabilitato quando isPending ──

  it("Conferma disabilitato quando isPending è true", () => {
    const schedule = makeSchedule();
    render(
      <MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} isPending={true} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    const confirmBtn = screen.getByRole("button", { name: /Conferma/i });
    expect(confirmBtn).toBeDisabled();
  });

  // ── Accessibilità ──

  it("Dialog ha attributi accessibilità", () => {
    const schedule = makeSchedule();
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conferma/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Annulla/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Data pagamento/i)).toBeInTheDocument();
  });

  // ── Reset data alla riapertura ──

  it("resetta la data a oggi quando si riapre il Dialog", () => {
    const schedule = makeSchedule();
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    // Verify today is shown
    const dateBtn = screen.getByLabelText(/Data pagamento/i);
    expect(dateBtn.textContent).toContain("01/06/2026");

    // Close dialog via Annulla
    fireEvent.click(screen.getByRole("button", { name: /Annulla/i }));

    // Reopen
    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    const dateBtn2 = screen.getByLabelText(/Data pagamento/i);
    expect(dateBtn2.textContent).toContain("01/06/2026"); // reset to today
  });

  // ── Tracking PostHog (hot-fix 2026-04-18 — funnel UX friction vs discovery) ──

  it("emette mark_as_paid_intent al click sul bottone (apertura dialog)", () => {
    const schedule = makeSchedule({
      id: "sched-77",
      bucket: "inps_q2",
      total_expected: 850.5,
      due_date: "2026-06-16",
    });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    expect(mockTrack).toHaveBeenCalledWith(
      "mark_as_paid_intent",
      expect.objectContaining({
        schedule_id: "sched-77",
        bucket: "inps_q2",
        amount: 850.5,
        due_date: "2026-06-16",
        source: "scadenziario",
        days_to_due: expect.any(Number),
      }),
    );
  });

  it("emette mark_as_paid_cancelled con cancel_method='button' al click su Annulla", () => {
    const schedule = makeSchedule({ id: "sched-88" });
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    // Apri + chiudi via Annulla
    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    mockTrack.mockClear(); // scarta l'intent per isolare il cancel
    fireEvent.click(screen.getByRole("button", { name: /Annulla/i }));

    expect(mockTrack).toHaveBeenCalledWith(
      "mark_as_paid_cancelled",
      expect.objectContaining({
        schedule_id: "sched-88",
        cancel_method: "button",
        time_in_dialog_ms: expect.any(Number),
        source: "scadenziario",
      }),
    );
  });

  it("NON emette mark_as_paid_cancelled quando l'utente conferma", () => {
    const schedule = makeSchedule();
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));

    // Verifica: NESSUNA chiamata a track con "mark_as_paid_cancelled".
    // L'intent invece deve essere stato emesso (regression guard sull'apertura).
    const cancelledCalls = mockTrack.mock.calls.filter(
      ([eventName]) => eventName === "mark_as_paid_cancelled",
    );
    expect(cancelledCalls).toHaveLength(0);

    const intentCalls = mockTrack.mock.calls.filter(
      ([eventName]) => eventName === "mark_as_paid_intent",
    );
    expect(intentCalls).toHaveLength(1);
  });

  it("passa source custom dal consumer (prop override)", () => {
    const schedule = makeSchedule();
    render(
      <MarkAsPaidButton
        schedule={schedule}
        onConfirm={mockOnConfirm}
        source="dashboard"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));

    expect(mockTrack).toHaveBeenCalledWith(
      "mark_as_paid_intent",
      expect.objectContaining({ source: "dashboard" }),
    );
  });

  it("emette intent per ciascuna apertura separata del dialog", () => {
    const schedule = makeSchedule();
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);

    // Ciclo: apri → cancel → riapri → conferma.
    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    fireEvent.click(screen.getByRole("button", { name: /Annulla/i }));
    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));

    const intentCalls = mockTrack.mock.calls.filter(
      ([eventName]) => eventName === "mark_as_paid_intent",
    );
    expect(intentCalls).toHaveLength(2);

    const cancelledCalls = mockTrack.mock.calls.filter(
      ([eventName]) => eventName === "mark_as_paid_cancelled",
    );
    expect(cancelledCalls).toHaveLength(1);
  });
});

// ── Annulla pagamento (undo "segna come pagata") ──

describe("MarkAsPaidButton — annulla pagamento", () => {
  const mockOnConfirm = vi.fn();
  const mockOnUndo = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnUndo.mockClear();
    mockTrack.mockClear();
  });

  it("rata pagata SENZA onUndo: nessun controllo (backward compat)", () => {
    const schedule = makeSchedule({ status: "paid", total_paid: 1500 });
    const { container } = render(
      <MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rata pagata CON onUndo: mostra 'Annulla pagamento' (non 'Segna come pagata')", () => {
    const schedule = makeSchedule({ status: "paid", total_paid: 1500 });
    render(
      <MarkAsPaidButton
        schedule={schedule}
        onConfirm={mockOnConfirm}
        onUndo={mockOnUndo}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Annulla pagamento/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Segna come pagata/i }),
    ).not.toBeInTheDocument();
  });

  it("click → dialog conferma → onUndo(scheduleId) + eventi tracking", () => {
    const schedule = makeSchedule({
      id: "sched-undo-1",
      status: "paid",
      total_paid: 1500,
    });
    render(
      <MarkAsPaidButton
        schedule={schedule}
        onConfirm={mockOnConfirm}
        onUndo={mockOnUndo}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Annulla pagamento/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/Annullare il pagamento\?/i),
    ).toBeInTheDocument();

    // Bottone conferma DENTRO il dialog (distinto dal trigger esterno)
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Annulla pagamento$/i }),
    );

    expect(mockOnUndo).toHaveBeenCalledTimes(1);
    expect(mockOnUndo).toHaveBeenCalledWith("sched-undo-1");

    const intent = mockTrack.mock.calls.filter(
      ([e]) => e === "mark_as_paid_undo_intent",
    );
    const confirmed = mockTrack.mock.calls.filter(
      ([e]) => e === "mark_as_paid_undo_confirmed",
    );
    expect(intent).toHaveLength(1);
    expect(confirmed).toHaveLength(1);
  });

  it("isUndoing: bottone conferma disabilitato", () => {
    const schedule = makeSchedule({ status: "paid", total_paid: 1500 });
    render(
      <MarkAsPaidButton
        schedule={schedule}
        onConfirm={mockOnConfirm}
        onUndo={mockOnUndo}
        isUndoing
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Annulla pagamento/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: /Annullamento/i }),
    ).toBeDisabled();
  });
});

// ── Finestre di versamento (proroga forfettari/ISA) ──

describe("MarkAsPaidButton — finestre di versamento", () => {
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    // 1 giugno → la finestra di default è "ordinary" (entro 30/06)
    vi.setSystemTime(new Date("2026-06-01T00:00:00"));
    mockOnConfirm.mockClear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function openDialog(schedule: TaxScheduleRow) {
    render(<MarkAsPaidButton schedule={schedule} onConfirm={mockOnConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /Segna come pagata/i }));
  }

  it("mostra il selettore a 4 finestre per la rata giugno in anno con proroga (2026)", () => {
    openDialog(makeSchedule({ bucket: "june", payment_year: 2026 }));
    const box = screen.getByTestId("payment-window");
    expect(box).toBeInTheDocument();
    expect(within(box).getByText(/Entro il 30 giugno/)).toBeInTheDocument();
    expect(within(box).getByText(/20 luglio/)).toBeInTheDocument(); // proroga
    expect(within(box).getByText(/21 luglio/)).toBeInTheDocument(); // differimento
    expect(within(box).getByText(/Dopo il 20 agosto/)).toBeInTheDocument(); // late
  });

  it("NON mostra il selettore per la rata di novembre", () => {
    openDialog(
      makeSchedule({ bucket: "november", payment_year: 2026, due_date: "2026-11-30" }),
    );
    expect(screen.queryByTestId("payment-window")).not.toBeInTheDocument();
  });

  it("NON mostra il selettore per una rata INPS fissa", () => {
    openDialog(makeSchedule({ bucket: "inps_q2", payment_year: 2026 }));
    expect(screen.queryByTestId("payment-window")).not.toBeInTheDocument();
  });

  it("NON mostra il selettore per un anno senza proroga (2025)", () => {
    openDialog(
      makeSchedule({
        bucket: "june",
        payment_year: 2025,
        due_date: "2025-06-30",
        reference_year: 2024,
      }),
    );
    expect(screen.queryByTestId("payment-window")).not.toBeInTheDocument();
  });

  it("default = finestra di oggi (ordinary), nessuna maggiorazione", () => {
    openDialog(makeSchedule({ total_expected: 1500 }));
    expect((screen.getByTestId("amount-paid") as HTMLInputElement).value).toBe("1500.00");
    expect(screen.queryByTestId("differimento-note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ paymentWindow: "ordinary", surchargeCents: 0 }),
    );
  });

  it("differimento applica +0,80%: prefill maggiorato, nota, banda verde, surcharge nel payload", () => {
    openDialog(makeSchedule({ total_expected: 1500 }));
    fireEvent.click(within(screen.getByTestId("payment-window")).getByText(/21 luglio/));

    // 1500 × 1,008 = 1512,00
    expect((screen.getByTestId("amount-paid") as HTMLInputElement).value).toBe("1512.00");
    expect(screen.getByTestId("differimento-note")).toBeInTheDocument();
    // Pagato = atteso della finestra → banda verde → niente richiesta motivo
    expect(screen.queryByTestId("discrepancy-reason")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        paymentWindow: "differimento",
        surchargeCents: 1200, // round(150000 × 0,008)
        amountPaidCents: 151200,
      }),
    );
  });

  it("proroga: nessuna maggiorazione (surcharge 0, nessuna nota differimento)", () => {
    openDialog(makeSchedule({ total_expected: 1500 }));
    fireEvent.click(within(screen.getByTestId("payment-window")).getByText(/20 luglio/));
    expect((screen.getByTestId("amount-paid") as HTMLInputElement).value).toBe("1500.00");
    expect(screen.queryByTestId("differimento-note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ paymentWindow: "proroga", surchargeCents: 0 }),
    );
  });

  it("late: pre-seleziona ravvedimento + mostra nota, e lo propaga nel payload", () => {
    openDialog(makeSchedule({ total_expected: 1500 }));
    fireEvent.click(
      within(screen.getByTestId("payment-window")).getByText(/Dopo il 20 agosto/),
    );

    expect(screen.getByTestId("late-note")).toBeInTheDocument();
    const reasonBox = screen.getByTestId("discrepancy-reason");
    const ravvChip = within(reasonBox).getByRole("radio", { name: /Ravvedimento/i });
    expect(ravvChip).toHaveAttribute("data-state", "on");

    fireEvent.click(screen.getByRole("button", { name: /Conferma/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        paymentWindow: "late",
        reasonCode: "ravvedimento",
        surchargeCents: 0,
      }),
    );
  });
});
