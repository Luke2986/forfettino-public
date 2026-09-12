/**
 * Story 2.1 — Test di type-safety per le nuove colonne Art/Comm
 * in fiscal_year_settings (Row, Insert, Update).
 *
 * Questi test compilano SOLO se i tipi sono corretti — sono test
 * di compilazione, non di runtime. Se il tipo manca o è sbagliato,
 * tsc fallisce e il test non compila.
 */
import { describe, it, expect } from "vitest";
import type { Database } from "./types";

type FiscalYearSettingsRow =
  Database["public"]["Tables"]["fiscal_year_settings"]["Row"];
type FiscalYearSettingsInsert =
  Database["public"]["Tables"]["fiscal_year_settings"]["Insert"];
type FiscalYearSettingsUpdate =
  Database["public"]["Tables"]["fiscal_year_settings"]["Update"];

describe("fiscal_year_settings types — Story 2.1 Art/Comm columns", () => {
  // ===== ROW TYPE =====

  it("Row should include inps_management as string", () => {
    // Type-level assertion: se il tipo è sbagliato, tsc fallisce
    // Il runtime test verifica che la chiave esista nel tipo
    const key: keyof FiscalYearSettingsRow = "inps_management";
    expect(key).toBe("inps_management");
    // Type assignability: compila solo se inps_management è string
    const _check: string = {} as FiscalYearSettingsRow["inps_management"];
    expect(true).toBe(true);
  });

  it("Row should include inps_enrollment_year as number | null", () => {
    const key: keyof FiscalYearSettingsRow = "inps_enrollment_year";
    expect(key).toBe("inps_enrollment_year");
    const _check: number | null = {} as FiscalYearSettingsRow["inps_enrollment_year"];
    expect(true).toBe(true);
  });

  it("Row should include riduzione_35_attiva as boolean", () => {
    const key: keyof FiscalYearSettingsRow = "riduzione_35_attiva";
    expect(key).toBe("riduzione_35_attiva");
    const _check: boolean = {} as FiscalYearSettingsRow["riduzione_35_attiva"];
    expect(true).toBe(true);
  });

  it("Row should include riduzione_50_attiva as boolean", () => {
    const key: keyof FiscalYearSettingsRow = "riduzione_50_attiva";
    expect(key).toBe("riduzione_50_attiva");
    const _check: boolean = {} as FiscalYearSettingsRow["riduzione_50_attiva"];
    expect(true).toBe(true);
  });

  it("Row should include riduzione_50_scadenza as string | null", () => {
    const key: keyof FiscalYearSettingsRow = "riduzione_50_scadenza";
    expect(key).toBe("riduzione_50_scadenza");
    const _check: string | null = {} as FiscalYearSettingsRow["riduzione_50_scadenza"];
    expect(true).toBe(true);
  });

  it("Row should preserve existing V1 columns", () => {
    const row = {} as FiscalYearSettingsRow;
    // Verify V1 columns still exist (backward compatibility)
    const _fiscalYear: number = row.fiscal_year;
    const _userId: string = row.user_id;
    const _inpsRate: number = row.inps_rate;
    const _inpsType: string = row.inps_type; // Legacy V1 column — DO NOT remove
    const _taxRate: number = row.tax_rate;
    const _profitCoefficient: number = row.profit_coefficient;
    const _bufferBase: string = row.buffer_base;
    // prudenza_preset removed in schema update
    expect(true).toBe(true);
    expect(true).toBe(true);
  });

  // ===== INSERT TYPE =====

  it("Insert should have inps_management as optional (has DB default)", () => {
    // Valid insert WITHOUT inps_management (uses DB default 'separata')
    const insertMinimal: FiscalYearSettingsInsert = {
      fiscal_year: 2026,
      user_id: "test-uuid",
    };
    expect(insertMinimal.fiscal_year).toBe(2026);

    // Valid insert WITH inps_management
    const insertFull: FiscalYearSettingsInsert = {
      fiscal_year: 2026,
      user_id: "test-uuid",
      inps_management: "artigiani",
      inps_enrollment_year: 2024,
      riduzione_35_attiva: true,
      riduzione_50_attiva: false,
      riduzione_50_scadenza: null,
    };
    expect(insertFull.inps_management).toBe("artigiani");
  });

  it("Insert should accept all three GestioneINPS values", () => {
    const base = { fiscal_year: 2026, user_id: "test-uuid" };

    const separata: FiscalYearSettingsInsert = {
      ...base,
      inps_management: "separata",
    };
    const artigiani: FiscalYearSettingsInsert = {
      ...base,
      inps_management: "artigiani",
    };
    const commercianti: FiscalYearSettingsInsert = {
      ...base,
      inps_management: "commercianti",
    };

    expect(separata.inps_management).toBe("separata");
    expect(artigiani.inps_management).toBe("artigiani");
    expect(commercianti.inps_management).toBe("commercianti");
  });

  // ===== UPDATE TYPE =====

  it("Update should allow updating only Art/Comm fields", () => {
    const update: FiscalYearSettingsUpdate = {
      inps_management: "commercianti",
      inps_enrollment_year: 2023,
      riduzione_35_attiva: false,
      riduzione_50_attiva: true,
      riduzione_50_scadenza: "2026-12-31",
    };
    expect(update.inps_management).toBe("commercianti");
    expect(update.riduzione_50_scadenza).toBe("2026-12-31");
  });

  it("Update should allow partial updates (single field)", () => {
    const updateOnlyRiduzione: FiscalYearSettingsUpdate = {
      riduzione_35_attiva: true,
    };
    expect(updateOnlyRiduzione.riduzione_35_attiva).toBe(true);
  });

  // ===== BACKWARD COMPATIBILITY =====

  it("Separata user insert should work without new Art/Comm fields", () => {
    // Simulates a V1 Separata user insert — no new fields required
    const v1Insert: FiscalYearSettingsInsert = {
      fiscal_year: 2026,
      user_id: "test-uuid",
      tax_rate: 15,
      profit_coefficient: 78,
      inps_rate: 26.07,
      inps_type: "gestione_separata",
      safety_buffer_rate: 5,
      deadline_window_days: 45,
      buffer_base: "receipts",
      reserve_amount: 0,
      // prudenza_preset removed in schema update
    };
    // All new Art/Comm fields should be undefined (will use DB defaults)
    expect(v1Insert.inps_management).toBeUndefined();
    expect(v1Insert.riduzione_35_attiva).toBeUndefined();
    expect(v1Insert.riduzione_50_attiva).toBeUndefined();
    expect(v1Insert.inps_enrollment_year).toBeUndefined();
    expect(v1Insert.riduzione_50_scadenza).toBeUndefined();
  });
});

// ===== Story 2.5 — profit_coeff_presets category column =====

type ProfitCoeffPresetsRow =
  Database["public"]["Tables"]["profit_coeff_presets"]["Row"];
type ProfitCoeffPresetsInsert =
  Database["public"]["Tables"]["profit_coeff_presets"]["Insert"];
type ProfitCoeffPresetsUpdate =
  Database["public"]["Tables"]["profit_coeff_presets"]["Update"];

describe("profit_coeff_presets types — Story 2.5 category column", () => {
  it("Row should include category as string | null", () => {
    const key: keyof ProfitCoeffPresetsRow = "category";
    expect(key).toBe("category");
    const _check: string | null = {} as ProfitCoeffPresetsRow["category"];
    expect(true).toBe(true);
  });

  it("Row should preserve existing columns", () => {
    const row = {} as ProfitCoeffPresetsRow;
    const _atecoCode: string = row.ateco_code;
    const _description: string = row.description;
    const _coefficient: number = row.coefficient;
    const _id: string = row.id;
    const _createdAt: string = row.created_at;
    const _category: string | null = row.category;
    expect(true).toBe(true);
  });

  it("Insert should have category as optional", () => {
    // V1 insert without category
    const insertWithout: ProfitCoeffPresetsInsert = {
      ateco_code: "62.01",
      description: "Sviluppo software",
      coefficient: 67,
    };
    expect(insertWithout.category).toBeUndefined();

    // V2 insert with category
    const insertWith: ProfitCoeffPresetsInsert = {
      ateco_code: "43.21.01",
      description: "Installazione impianti",
      coefficient: 86,
      category: "artigiani",
    };
    expect(insertWith.category).toBe("artigiani");
  });

  it("Update should allow updating category", () => {
    const update: ProfitCoeffPresetsUpdate = {
      category: "commercianti",
    };
    expect(update.category).toBe("commercianti");
  });

  it("Insert should accept all three category values", () => {
    const base = { ateco_code: "99.99", description: "Test", coefficient: 78 };
    const prof: ProfitCoeffPresetsInsert = { ...base, category: "professionisti" };
    const art: ProfitCoeffPresetsInsert = { ...base, category: "artigiani" };
    const comm: ProfitCoeffPresetsInsert = { ...base, category: "commercianti" };
    expect(prof.category).toBe("professionisti");
    expect(art.category).toBe("artigiani");
    expect(comm.category).toBe("commercianti");
  });
});

// ===== Story 18.1 — installment_plans + installment_deadlines + receipts FK =====

type InstallmentPlansRow =
  Database["public"]["Tables"]["installment_plans"]["Row"];
type InstallmentPlansInsert =
  Database["public"]["Tables"]["installment_plans"]["Insert"];
type InstallmentPlansUpdate =
  Database["public"]["Tables"]["installment_plans"]["Update"];

type InstallmentDeadlinesRow =
  Database["public"]["Tables"]["installment_deadlines"]["Row"];
type InstallmentDeadlinesInsert =
  Database["public"]["Tables"]["installment_deadlines"]["Insert"];
type InstallmentDeadlinesUpdate =
  Database["public"]["Tables"]["installment_deadlines"]["Update"];

type ReceiptsRow = Database["public"]["Tables"]["receipts"]["Row"];
type ReceiptsInsert = Database["public"]["Tables"]["receipts"]["Insert"];
type ReceiptsUpdate = Database["public"]["Tables"]["receipts"]["Update"];

describe("installment_plans types — Story 18.1", () => {
  // ===== ROW TYPE =====

  it("Row should include all 10 columns with correct types", () => {
    const row = {} as InstallmentPlansRow;
    const _id: string = row.id;
    const _userId: string = row.user_id;
    const _totalAmount: number = row.total_amount;
    const _clientName: string | null = row.client_name;
    const _description: string | null = row.description;
    const _startDate: string = row.start_date;
    const _fiscalYear: number = row.fiscal_year;
    const _status: string = row.status;
    const _createdAt: string = row.created_at;
    const _updatedAt: string = row.updated_at;
    expect(true).toBe(true);
  });

  // ===== INSERT TYPE =====

  it("Insert should require user_id, total_amount, fiscal_year", () => {
    const insert: InstallmentPlansInsert = {
      user_id: "test-uuid",
      total_amount: 5000,
      fiscal_year: 2026,
    };
    expect(insert.user_id).toBe("test-uuid");
    expect(insert.total_amount).toBe(5000);
    expect(insert.fiscal_year).toBe(2026);
    // Optional fields should be undefined
    expect(insert.client_name).toBeUndefined();
    expect(insert.description).toBeUndefined();
    expect(insert.status).toBeUndefined();
  });

  it("Insert should accept all optional fields", () => {
    const insertFull: InstallmentPlansInsert = {
      user_id: "test-uuid",
      total_amount: 10000,
      fiscal_year: 2026,
      client_name: "Acme Corp",
      description: "Contratto annuale",
      start_date: "2026-01-15",
      status: "in_corso",
    };
    expect(insertFull.client_name).toBe("Acme Corp");
    expect(insertFull.start_date).toBe("2026-01-15");
  });

  // ===== UPDATE TYPE =====

  it("Update should allow partial updates", () => {
    const update: InstallmentPlansUpdate = {
      status: "completato",
    };
    expect(update.status).toBe("completato");
  });

  it("Update should allow updating total_amount only", () => {
    const update: InstallmentPlansUpdate = {
      total_amount: 7500,
    };
    expect(update.total_amount).toBe(7500);
  });
});

describe("installment_deadlines types — Story 18.1", () => {
  // ===== ROW TYPE =====

  it("Row should include all 10 columns with correct types", () => {
    const row = {} as InstallmentDeadlinesRow;
    const _id: string = row.id;
    const _planId: string = row.installment_plan_id;
    const _userId: string = row.user_id;
    const _label: string = row.label;
    const _expectedAmount: number = row.expected_amount;
    const _dueDate: string = row.due_date;
    const _receiptId: string | null = row.receipt_id;
    const _isPaid: boolean = row.is_paid;
    const _createdAt: string = row.created_at;
    const _updatedAt: string = row.updated_at;
    expect(true).toBe(true);
  });

  // ===== INSERT TYPE =====

  it("Insert should require installment_plan_id, user_id, expected_amount, due_date", () => {
    const insert: InstallmentDeadlinesInsert = {
      installment_plan_id: "plan-uuid",
      user_id: "test-uuid",
      expected_amount: 2500,
      due_date: "2026-03-15",
    };
    expect(insert.installment_plan_id).toBe("plan-uuid");
    expect(insert.expected_amount).toBe(2500);
    expect(insert.due_date).toBe("2026-03-15");
    // Optional fields with DB defaults
    expect(insert.label).toBeUndefined();
    expect(insert.is_paid).toBeUndefined();
    expect(insert.receipt_id).toBeUndefined();
  });

  it("Insert should accept optional label and receipt_id", () => {
    const insert: InstallmentDeadlinesInsert = {
      installment_plan_id: "plan-uuid",
      user_id: "test-uuid",
      expected_amount: 1000,
      due_date: "2026-06-30",
      label: "Rata 2",
      receipt_id: "receipt-uuid",
      is_paid: true,
    };
    expect(insert.label).toBe("Rata 2");
    expect(insert.receipt_id).toBe("receipt-uuid");
    expect(insert.is_paid).toBe(true);
  });

  // ===== UPDATE TYPE =====

  it("Update should allow marking as paid", () => {
    const update: InstallmentDeadlinesUpdate = {
      is_paid: true,
      receipt_id: "receipt-uuid",
    };
    expect(update.is_paid).toBe(true);
    expect(update.receipt_id).toBe("receipt-uuid");
  });

  it("Update should allow changing due_date only", () => {
    const update: InstallmentDeadlinesUpdate = {
      due_date: "2026-07-31",
    };
    expect(update.due_date).toBe("2026-07-31");
  });
});

describe("receipts FK columns — Story 18.1", () => {
  it("Row should include installment_plan_id as string | null", () => {
    const key: keyof ReceiptsRow = "installment_plan_id";
    expect(key).toBe("installment_plan_id");
    const _check: string | null = {} as ReceiptsRow["installment_plan_id"];
    expect(true).toBe(true);
  });

  it("Row should include installment_deadline_id as string | null", () => {
    const key: keyof ReceiptsRow = "installment_deadline_id";
    expect(key).toBe("installment_deadline_id");
    const _check: string | null = {} as ReceiptsRow["installment_deadline_id"];
    expect(true).toBe(true);
  });

  it("Row should include invoice_number as string | null", () => {
    const key: keyof ReceiptsRow = "invoice_number";
    expect(key).toBe("invoice_number");
    const _check: string | null = {} as ReceiptsRow["invoice_number"];
    expect(true).toBe(true);
  });

  it("Insert should accept new FK columns as optional", () => {
    const insert: ReceiptsInsert = {
      user_id: "test-uuid",
      fiscal_year: 2026,
      gross_amount: 1000,
      installment_plan_id: "plan-uuid",
      installment_deadline_id: "deadline-uuid",
      invoice_number: "FT-2026-001",
    };
    expect(insert.installment_plan_id).toBe("plan-uuid");
    expect(insert.installment_deadline_id).toBe("deadline-uuid");
    expect(insert.invoice_number).toBe("FT-2026-001");
  });

  it("Insert should work without new FK columns (backward compat)", () => {
    const insert: ReceiptsInsert = {
      user_id: "test-uuid",
      fiscal_year: 2026,
      gross_amount: 500,
    };
    expect(insert.installment_plan_id).toBeUndefined();
    expect(insert.installment_deadline_id).toBeUndefined();
    expect(insert.invoice_number).toBeUndefined();
  });

  it("Update should allow setting FK columns", () => {
    const update: ReceiptsUpdate = {
      installment_plan_id: "plan-uuid",
      installment_deadline_id: "deadline-uuid",
    };
    expect(update.installment_plan_id).toBe("plan-uuid");
    expect(update.installment_deadline_id).toBe("deadline-uuid");
  });
});

