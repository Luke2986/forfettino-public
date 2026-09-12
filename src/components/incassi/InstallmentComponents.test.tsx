/**
 * Test per componenti UI piani rate — Story 18.4
 *
 * Copertura:
 * - AC#1: InstallmentProgressBar (Progress shadcn, blue accent, compact mode)
 * - AC#2: InstallmentDeadlineItem (data, label, importo, badge stato)
 * - AC#3: InstallmentPlanCard (border-left, progress bar, dropdown, azioni condizionali)
 * - AC#4: InstallmentPlanSheet (Sheet dettaglio, lista deadlines, CTA pagamento)
 * - AC#5: RegisterPaymentDialog (pre-fill importo, validazione, campo data/note)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InstallmentProgressBar } from "./InstallmentProgressBar";
import { InstallmentDeadlineItem } from "./InstallmentDeadlineItem";
import { InstallmentPlanCard, deriveCardActions } from "./InstallmentPlanCard";
import { InstallmentPlanSheet } from "./InstallmentPlanSheet";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";
import type { InstallmentPlanWithProgress, InstallmentDeadlineRow } from "@/hooks/useInstallmentPlans";

// ---------- Mock formatCurrency ----------
// jsdom Intl.NumberFormat("it-IT") may not fully work, so use a simple mock
// that matches the pattern: "€ X,XX" without thousands separator (jsdom limitation)
vi.mock("@/hooks/useFiscalCalculations", () => ({
  formatCurrency: (v: number | null | undefined) => {
    const n = typeof v === "number" ? v : 0;
    return `€ ${n.toFixed(2).replace(".", ",")}`;
  },
}));

// ---------- Helpers ----------

function makeDeadline(overrides: Partial<InstallmentDeadlineRow> = {}): InstallmentDeadlineRow {
  return {
    id: "dl-1",
    installment_plan_id: "plan-1",
    user_id: "user-1",
    label: "Rata 1",
    expected_amount: 500,
    due_date: "2026-03-15",
    is_paid: false,
    receipt_id: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function makePlan(overrides: Partial<InstallmentPlanWithProgress> = {}): InstallmentPlanWithProgress {
  const deadlines = overrides.deadlines ?? [
    makeDeadline({ id: "dl-1", is_paid: true, expected_amount: 500 }),
    makeDeadline({ id: "dl-2", is_paid: false, expected_amount: 500, label: "Rata 2", due_date: "2026-04-15" }),
  ];
  const paidDeadlines = deadlines.filter((d) => d.is_paid);
  return {
    id: "plan-1",
    user_id: "user-1",
    total_amount: 1000,
    client_name: "Mario Rossi",
    description: "Progetto web",
    start_date: "2026-01-01",
    fiscal_year: 2026,
    status: "in_corso",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    rivalsa_inps_applied: false,
    deadlines,
    totalPaid: paidDeadlines.reduce((s, d) => s + d.expected_amount, 0),
    residuo: overrides.residuo ?? 500,
    paidCount: overrides.paidCount ?? paidDeadlines.length,
    totalCount: overrides.totalCount ?? deadlines.length,
    nextDeadline: overrides.nextDeadline ?? (deadlines.find((d) => !d.is_paid) || null),
    ...overrides,
  };
}

// ============================
// AC#1: InstallmentProgressBar
// ============================
describe("InstallmentProgressBar", () => {
  it("renders Progress component with blue accent and correct aria-label", () => {
    const { container } = render(
      <InstallmentProgressBar totalAmount={1000} collectedAmount={500} />
    );
    // Should render aria-label on the Progress root
    const progressRoot = container.querySelector("[role='progressbar']");
    expect(progressRoot).not.toBeNull();
    expect(progressRoot!.getAttribute("aria-label")).toContain("€ 500,00");
    expect(progressRoot!.getAttribute("aria-label")).toContain("€ 1000,00");
  });

  it("shows text info when not compact", () => {
    render(<InstallmentProgressBar totalAmount={2000} collectedAmount={800} />);
    expect(screen.getByText(/€ 800,00/)).toBeTruthy();
    expect(screen.getByText(/€ 2000,00/)).toBeTruthy();
    expect(screen.getByText(/incassati/)).toBeTruthy();
  });

  it("hides text info in compact mode", () => {
    render(<InstallmentProgressBar totalAmount={2000} collectedAmount={800} compact />);
    expect(screen.queryByText(/incassati/)).toBeNull();
  });

  it("caps percentage at 100", () => {
    const { container } = render(
      <InstallmentProgressBar totalAmount={100} collectedAmount={200} />
    );
    // 100% should show "Completato"
    expect(screen.getByText("Completato")).toBeTruthy();
  });

  it("shows 0% when totalAmount is 0", () => {
    const { container } = render(
      <InstallmentProgressBar totalAmount={0} collectedAmount={0} />
    );
    // aria-label should mention €0
    const progressRoot = container.querySelector("[role='progressbar']");
    expect(progressRoot).not.toBeNull();
  });

  it("shows Completato label when 100%", () => {
    render(<InstallmentProgressBar totalAmount={1000} collectedAmount={1000} />);
    expect(screen.getByText("Completato")).toBeTruthy();
  });
});

// ============================
// AC#2: InstallmentDeadlineItem
// ============================
describe("InstallmentDeadlineItem", () => {
  it("renders date formatted DD/MM/YYYY", () => {
    const dl = makeDeadline({ due_date: "2026-03-15" });
    render(<InstallmentDeadlineItem deadline={dl} />);
    // toLocaleDateString("it-IT") for 2026-03-15 → "15/3/2026"
    expect(screen.getByText(/15/)).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it("renders label", () => {
    const dl = makeDeadline({ label: "Seconda rata" });
    render(<InstallmentDeadlineItem deadline={dl} />);
    expect(screen.getByText("Seconda rata")).toBeTruthy();
  });

  it("renders importo in euro", () => {
    const dl = makeDeadline({ expected_amount: 750 });
    render(<InstallmentDeadlineItem deadline={dl} />);
    expect(screen.getByText("€ 750,00")).toBeTruthy();
  });

  it("renders badge Pagata with Check icon when is_paid=true", () => {
    const dl = makeDeadline({ is_paid: true });
    render(<InstallmentDeadlineItem deadline={dl} />);
    expect(screen.getByText("Pagata")).toBeTruthy();
  });

  it("renders badge In attesa with Clock icon when is_paid=false", () => {
    const dl = makeDeadline({ is_paid: false });
    render(<InstallmentDeadlineItem deadline={dl} />);
    expect(screen.getByText("In attesa")).toBeTruthy();
  });

  it("handles missing due_date", () => {
    const dl = makeDeadline({ due_date: null as any });
    render(<InstallmentDeadlineItem deadline={dl} />);
    expect(screen.getByText("Data non definita")).toBeTruthy();
  });
});

// ============================
// AC#3: InstallmentPlanCard
// ============================
describe("InstallmentPlanCard", () => {
  const handlers = {
    onViewDetail: vi.fn(),
    onRegisterPayment: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders blue border-left for active plans", () => {
    const plan = makePlan({ status: "in_corso" });
    const { container } = render(<InstallmentPlanCard plan={plan} {...handlers} />);
    const card = container.querySelector("[data-testid='plan-card-plan-1']");
    expect(card?.className).toContain("border-l-4");
    expect(card?.className).toContain("border-info");
  });

  it("renders muted style for completed plans", () => {
    const plan = makePlan({ status: "completato" });
    const { container } = render(<InstallmentPlanCard plan={plan} {...handlers} />);
    const card = container.querySelector("[data-testid='plan-card-plan-1']");
    expect(card?.className).toContain("opacity-70");
    expect(card?.className).not.toContain("border-l-4");
  });

  it("displays client_name and total_amount", () => {
    const plan = makePlan();
    render(<InstallmentPlanCard plan={plan} {...handlers} />);
    expect(screen.getByText("Mario Rossi")).toBeTruthy();
    expect(screen.getByText("€ 1000,00")).toBeTruthy();
  });

  it("shows InstallmentProgressBar when paidCount > 0", () => {
    const plan = makePlan({ paidCount: 1 });
    const { container } = render(<InstallmentPlanCard plan={plan} {...handlers} />);
    // Progress bar should render
    const progressBar = container.querySelector("[role='progressbar']");
    expect(progressBar).not.toBeNull();
  });

  it("hides InstallmentProgressBar when paidCount is 0", () => {
    const plan = makePlan({ paidCount: 0 });
    const { container } = render(<InstallmentPlanCard plan={plan} {...handlers} />);
    const progressBar = container.querySelector("[role='progressbar']");
    expect(progressBar).toBeNull();
  });

  it("shows next deadline hint for active plans", () => {
    const plan = makePlan();
    render(<InstallmentPlanCard plan={plan} {...handlers} />);
    expect(screen.getByText(/Prossima rata/)).toBeTruthy();
  });

  it("hides next deadline hint for completed plans", () => {
    const plan = makePlan({ status: "completato" });
    render(<InstallmentPlanCard plan={plan} {...handlers} />);
    expect(screen.queryByText(/Prossima rata/)).toBeNull();
  });

  it("renders dropdown trigger button", () => {
    const plan = makePlan();
    render(<InstallmentPlanCard plan={plan} {...handlers} />);
    const trigger = screen.getByRole("button", { name: "Azioni per piano Mario Rossi" });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("shows paidCount/totalCount when paidCount > 0", () => {
    const plan = makePlan({ paidCount: 1, totalCount: 3 });
    render(<InstallmentPlanCard plan={plan} {...handlers} />);
    expect(screen.getByText(/rate pagate/)).toBeTruthy();
  });

  it("hides paidCount/totalCount when paidCount === 0", () => {
    const plan = makePlan({ paidCount: 0 });
    render(<InstallmentPlanCard plan={plan} {...handlers} />);
    expect(screen.queryByText(/rate pagate/)).toBeNull();
  });
});

// ============================
// AC#3 bis: deriveCardActions
// ============================
describe("deriveCardActions", () => {
  it("active plan: canEdit=true, isActive=true", () => {
    const plan = makePlan({ status: "in_corso" });
    const actions = deriveCardActions(plan);
    expect(actions.isActive).toBe(true);
    expect(actions.canEdit).toBe(true);
  });

  it("completed plan: canEdit=false, isActive=false", () => {
    const plan = makePlan({ status: "completato" });
    const actions = deriveCardActions(plan);
    expect(actions.isActive).toBe(false);
    expect(actions.canEdit).toBe(false);
  });

  it("canDelete=true when paidCount === 0", () => {
    const plan = makePlan({ paidCount: 0 });
    expect(deriveCardActions(plan).canDelete).toBe(true);
  });

  it("canDelete=false when paidCount > 0", () => {
    const plan = makePlan({ paidCount: 2 });
    expect(deriveCardActions(plan).canDelete).toBe(false);
  });

  it("hasResiduo=true when residuo > 0", () => {
    const plan = makePlan({ residuo: 500 });
    expect(deriveCardActions(plan).hasResiduo).toBe(true);
  });

  it("hasResiduo=false when residuo === 0", () => {
    const plan = makePlan({ residuo: 0 });
    expect(deriveCardActions(plan).hasResiduo).toBe(false);
  });
});

// ============================
// AC#4: InstallmentPlanSheet
// ============================
describe("InstallmentPlanSheet", () => {
  const onOpenChange = vi.fn();
  const onRegisterPayment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when plan is null", () => {
    const { container } = render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={null}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders header with client_name", () => {
    const plan = makePlan();
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.getByText("Mario Rossi")).toBeTruthy();
  });

  it("renders total amount", () => {
    const plan = makePlan();
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.getAllByText("€ 1000,00").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all deadlines", () => {
    const plan = makePlan();
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.getByText("Rata 1")).toBeTruthy();
    expect(screen.getByText("Rata 2")).toBeTruthy();
  });

  it("shows CTA 'Registra pagamento' when residuo > 0", () => {
    const plan = makePlan({ residuo: 500 });
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    const cta = screen.getByTestId("detail-register-payment");
    expect(cta).toBeTruthy();
    expect(cta.textContent).toContain("Registra pagamento");
  });

  it("hides CTA when residuo === 0", () => {
    const plan = makePlan({ residuo: 0 });
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.queryByTestId("detail-register-payment")).toBeNull();
  });

  it("calls onRegisterPayment when CTA clicked", () => {
    const plan = makePlan({ residuo: 500 });
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    fireEvent.click(screen.getByTestId("detail-register-payment"));
    expect(onRegisterPayment).toHaveBeenCalledWith(plan);
  });

  it("shows 'Nessuna rata definita' when deadlines empty", () => {
    const plan = makePlan({ deadlines: [], nextDeadline: null, totalCount: 0 });
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.getByText(/Nessuna rata definita/)).toBeTruthy();
  });

  it("renders badge 'In corso' for active plans", () => {
    const plan = makePlan({ status: "in_corso" });
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.getByText("In corso")).toBeTruthy();
  });

  it("renders badge 'Completato' for completed plans", () => {
    const plan = makePlan({ status: "completato" });
    render(
      <InstallmentPlanSheet
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onRegisterPayment={onRegisterPayment}
      />
    );
    expect(screen.getByText("Completato")).toBeTruthy();
  });
});

// ============================
// AC#5: RegisterPaymentDialog
// ============================
describe("RegisterPaymentDialog", () => {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when plan is null", () => {
    const { container } = render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={null}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("pre-fills importo with nextDeadline expected_amount", () => {
    const nextDl = makeDeadline({ expected_amount: 300 });
    const plan = makePlan({ nextDeadline: nextDl, residuo: 700 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    const input = screen.getByTestId("payment-amount") as HTMLInputElement;
    expect(input.value).toBe("300.00");
  });

  it("pre-fills importo with residuo when no nextDeadline", () => {
    const plan = makePlan({ nextDeadline: null, residuo: 450 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    const input = screen.getByTestId("payment-amount") as HTMLInputElement;
    expect(input.value).toBe("450.00");
  });

  it("validates importo > 0", () => {
    const plan = makePlan({ residuo: 500 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    // Set importo to 0
    const input = screen.getByTestId("payment-amount");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("confirm-payment"));
    expect(screen.getByTestId("payment-error")).toBeTruthy();
    expect(screen.getByText(/maggiore di zero/)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("validates importo <= residuo", () => {
    const plan = makePlan({ residuo: 500 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    const input = screen.getByTestId("payment-amount");
    fireEvent.change(input, { target: { value: "600" } });
    fireEvent.click(screen.getByTestId("confirm-payment"));
    expect(screen.getByTestId("payment-error")).toBeTruthy();
    expect(screen.getByText(/supera il residuo/)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with correct params on valid submit", () => {
    const nextDl = makeDeadline({ id: "dl-99", expected_amount: 250 });
    const plan = makePlan({ nextDeadline: nextDl, residuo: 500 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    // importo is pre-filled to 250
    fireEvent.click(screen.getByTestId("confirm-payment"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const args = onConfirm.mock.calls[0];
    expect(args[0]).toBe("plan-1"); // planId
    expect(args[1]).toBe("dl-99"); // deadlineId
    expect(args[2]).toBe(250); // importo
    expect(args[3]).toBeInstanceOf(Date); // dataIncasso
    // note is undefined (empty)
    expect(args[4]).toBeUndefined();
  });

  it("passes note when provided", () => {
    const nextDl = makeDeadline({ id: "dl-99", expected_amount: 250 });
    const plan = makePlan({ nextDeadline: nextDl, residuo: 500 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    const noteInput = screen.getByTestId("payment-note");
    fireEvent.change(noteInput, { target: { value: "Seconda rata sito" } });
    fireEvent.click(screen.getByTestId("confirm-payment"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][4]).toBe("Seconda rata sito");
  });

  it("disables confirm button when isPending", () => {
    const plan = makePlan();
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={true}
      />
    );
    const btn = screen.getByTestId("confirm-payment");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("shows client_name in description", () => {
    const plan = makePlan({ client_name: "Acme Corp" });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    expect(screen.getByText(/Acme Corp/)).toBeTruthy();
  });

  it("shows residuo in description", () => {
    const plan = makePlan({ residuo: 750 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    expect(screen.getByText(/€ 750,00/)).toBeTruthy();
  });

  it("date picker trigger has accessible aria-label", () => {
    const plan = makePlan({ residuo: 500 });
    render(
      <RegisterPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        plan={plan}
        onConfirm={onConfirm}
        isPending={false}
      />
    );
    const dateButton = screen.getByRole("button", { name: /data incasso/i });
    expect(dateButton).toBeTruthy();
  });
});
