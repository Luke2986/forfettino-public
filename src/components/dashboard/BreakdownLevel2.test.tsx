import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BreakdownLevel2 } from "./BreakdownLevel2";
import type { FiscalMetrics } from "@/hooks/useFiscalCalculations";

// Helper: create mock FiscalMetrics
function createMockMetrics(overrides?: Partial<FiscalMetrics>): FiscalMetrics {
  return {
    inpsManagement: "separata",
    incassiYTD: 50000,
    settings: {
      taxRate: 15,
      profitCoeff: 78,
      inpsRate: 26.07,
      safetyBuffer: 5,
      reserveAmount: 1000,
      bufferBase: "receipts",
      deadlineWindowDays: 45,
    },
    taxableAmount: 39000,
    taxAmount: 5850,
    inpsAmount: 10167.3,
    totalWithholding: 16017.3,
    bufferAmount: 2500,
    monthlyToolCost: 50,
    monthlyAccountantCost: 30,
    yearlyToolCost: 600,
    toolCostsYTD: 300,
    dueSoonRemaining: 0,
    spendable: 29882.7,
    fiscalPeak: {
      saldoTax: 5850,
      saldoInps: 10167.3,
      accontoTax1: 2925,
      accontoTax2: 2925,
      accontoTaxSingle: 0,
      accontoInps1: 5083.65,
      accontoInps2: 5083.65,
      juneTotal: 24025.95,
      novemberTotal: 8008.65,
      yearTotal: 32034.6,
      paymentYear: 2027,
      isEstimate: true,
      // Story 11.1
      accontiImpostaVersati: 0,
      accontiInpsVersati: 0,
      saldoTaxNetto: 5850,
      saldoInpsNetto: 10167.3,
      creditoImposta: 0,
      creditoInps: 0,
      
    },
    nextDeadlineInWindow: null,
    nextDeadlineAny: null,
    hasScheduleData: false,
    activeToolsCount: 1,
    upcomingDeadlines: [],
    expiredRatesCount: 0,
    bannerRateScaduteDismissed: false,
    unpaidCurrentYearTotal: 0,
    paidCurrentYearTotal: 0,
    currentYearSchedules: [],
    currentYearObligations: {
      saldoTaxPrevYear: 0,
      saldoInpsPrevYear: 0,
      accontiResult: null,
      rateInpsFisseAnnoN: 0,
      paymentYear: 2026,
      hasData: false,
      juneTotal: 0,
      novemberTotal: 0,
      yearTotal: 0,
      // Story 11.1
      accontiImpostaVersati: 0,
      accontiInpsVersati: 0,
      saldoTaxNettoAnnoN: 0,
      saldoInpsNettoAnnoN: 0,
      creditoImposta: 0,
      creditoInps: 0,
      isFirstYearOnly: false,
      
    },
    saldoInizialeCC: 0,
    unpaidSchedules30d: [],
    hasUnpaidOver30d: false,
    bannerFallbackCommercialistaDismissed: false,
    // Story 40-2: defaults for Separata (flat values = legacy values)
    impostaConDeducibilita: 5850,
    inpsVariabile: 0,
    inpsMinimale: 0,
    inpsTotale: 10167.3,
    daCopireAmount: 16017.3,
    ...overrides,
  };
}

// Helper: build a tax_schedule row for tests
function mkSched(
  bucket: string,
  expected: number,
  paid: number,
  status: string,
) {
  return {
    id: bucket,
    user_id: "u",
    bucket,
    payment_year: 2026,
    due_date: "2026-06-30",
    total_expected: expected,
    total_paid: paid,
    status,
    created_at: "",
    updated_at: "",
  } as any;
}

describe("BreakdownLevel2", () => {
  describe("Separata", () => {
    it("renders INPS and Tasse sections", () => {
      const metrics = createMockMetrics();
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // INPS section header
      expect(screen.getByText("INPS")).toBeInTheDocument();
      // Tasse section header
      expect(screen.getByText("Tasse")).toBeInTheDocument();
    });

    it("shows INPS formula: reddito imponibile × aliquota = contributi", () => {
      const metrics = createMockMetrics();
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // "Reddito imponibile" appears in both INPS and Tasse sections
      expect(screen.getAllByText("Reddito imponibile").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Aliquota INPS.*26\.07%/)).toBeInTheDocument();
      expect(screen.getByText("Contributi INPS")).toBeInTheDocument();
    });

    it("shows Tasse formula: ricavi → coefficiente → imponibile → aliquota → imposta", () => {
      const metrics = createMockMetrics();
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      expect(screen.getByText("Ricavi lordi")).toBeInTheDocument();
      expect(screen.getByText(/Coefficiente.*78%/)).toBeInTheDocument();
      // "Reddito imponibile" appears in both sections
      expect(screen.getAllByText("Reddito imponibile").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Aliquota sostitutiva.*15%/)).toBeInTheDocument();
      expect(screen.getByText("Imposta sostitutiva")).toBeInTheDocument();
    });
  });

  describe("Artigiani", () => {
    it("renders INPS Artigiani section header", () => {
      const metrics = createMockMetrics({ inpsManagement: "artigiani" });
      render(<BreakdownLevel2 gestione="artigiani" metrics={metrics} />);

      expect(screen.getByText("INPS Artigiani")).toBeInTheDocument();
    });

    it("shows INPS breakdown with minimale, variabile and totale", () => {
      const metrics = createMockMetrics({
        inpsManagement: "artigiani",
        inpsMinimale: 4427.04,
        inpsVariabile: 1102.08,
        inpsTotale: 5529.12,
        impostaConDeducibilita: 5020,
        daCopireAmount: 6122.08,
        settings: {
          ...createMockMetrics().settings,
          inpsRate: 24.0,
        },
      });
      render(<BreakdownLevel2 gestione="artigiani" metrics={metrics} />);

      expect(screen.getByText("Minimale fisso annuo")).toBeInTheDocument();
      expect(screen.getByText("Variabile su eccedenza")).toBeInTheDocument();
      expect(screen.getByText(/Totale INPS Artigiani/)).toBeInTheDocument();
    });

    it("renders Tasse section with INPS deducibilità for Art/Comm", () => {
      const metrics = createMockMetrics({
        inpsManagement: "artigiani",
        inpsTotale: 4427.04,
        impostaConDeducibilita: 5181,
      });
      render(<BreakdownLevel2 gestione="artigiani" metrics={metrics} />);

      expect(screen.getByText("Tasse")).toBeInTheDocument();
      expect(screen.getByText("Ricavi lordi")).toBeInTheDocument();
      expect(screen.getByText("INPS deducibile")).toBeInTheDocument();
      expect(screen.getByText("Base imponibile netta")).toBeInTheDocument();
      expect(screen.getByText("Imposta sostitutiva")).toBeInTheDocument();
    });
  });

  describe("Commercianti", () => {
    it("renders INPS Commercianti section header", () => {
      const metrics = createMockMetrics({ inpsManagement: "commercianti" });
      render(<BreakdownLevel2 gestione="commercianti" metrics={metrics} />);

      expect(screen.getByText("INPS Commercianti")).toBeInTheDocument();
    });

    it("shows INPS breakdown with minimale, variabile and totale", () => {
      const metrics = createMockMetrics({
        inpsManagement: "commercianti",
        inpsMinimale: 4515.43,
        inpsVariabile: 1124.12,
        inpsTotale: 5639.55,
        impostaConDeducibilita: 5003,
        daCopireAmount: 6127.12,
        settings: {
          ...createMockMetrics().settings,
          inpsRate: 24.48,
        },
      });
      render(<BreakdownLevel2 gestione="commercianti" metrics={metrics} />);

      expect(screen.getByText("Minimale fisso annuo")).toBeInTheDocument();
      expect(screen.getByText(/Totale INPS Commercianti/)).toBeInTheDocument();
    });
  });

  describe("Semantic HTML", () => {
    it("uses dl, dt, dd elements", () => {
      const metrics = createMockMetrics();
      const { container } = render(
        <BreakdownLevel2 gestione="separata" metrics={metrics} />
      );

      const dlElements = container.querySelectorAll("dl");
      const dtElements = container.querySelectorAll("dt");
      const ddElements = container.querySelectorAll("dd");

      expect(dlElements.length).toBeGreaterThanOrEqual(2); // INPS + Tasse
      expect(dtElements.length).toBeGreaterThanOrEqual(5);
      expect(ddElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Popover", () => {
    it("renders info icons for terms with explanations", () => {
      const metrics = createMockMetrics();
      const { container } = render(
        <BreakdownLevel2 gestione="separata" metrics={metrics} />
      );

      const infoButtons = container.querySelectorAll("[aria-label='Informazioni']");
      // At least: coefficienteRedditivita + aliquotaINPS
      expect(infoButtons.length).toBeGreaterThanOrEqual(2);
    });

    it("shows explanation text when popover is clicked", async () => {
      const metrics = createMockMetrics();
      const { container } = render(
        <BreakdownLevel2 gestione="separata" metrics={metrics} />
      );

      const infoButtons = container.querySelectorAll("[aria-label='Informazioni']");
      // Click the first info button
      fireEvent.click(infoButtons[0] as HTMLElement);

      // Should show one of the explanation texts
      // The popover content should now be visible
      const popoverContent = await screen.findByText(
        /Percentuale fissa basata|L'INPS pagato riduce|Importo fisso annuale|Contributo aggiuntivo|Percentuale applicata/
      );
      expect(popoverContent).toBeInTheDocument();
    });
  });

  // ===== Story 3.7 — AC5: ObligationsSection =====
  describe("ObligationsSection (Story 3.7 — AC5)", () => {
    it("renders when currentYearObligations.hasData is true and schedules exist", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 4805,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 4805,
          novemberTotal: 0,
          yearTotal: 4805,
          accontiImpostaVersati: 0,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 1755,
          saldoInpsNettoAnnoN: 3050,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s1", user_id: "u", bucket: "saldo_tax", payment_year: 2026, due_date: "2026-06-30", total_expected: 1755, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
          { id: "s2", user_id: "u", bucket: "saldo_inps", payment_year: 2026, due_date: "2026-06-30", total_expected: 3050, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      expect(screen.getByText("Obbligazioni 2026")).toBeInTheDocument();
      expect(screen.getByText("Saldo Imposte 2025")).toBeInTheDocument();
      expect(screen.getByText("Saldo INPS 2025")).toBeInTheDocument();
      expect(screen.getByText("Totale non pagato")).toBeInTheDocument();
    });

    it("hidden when hasData is false", () => {
      const metrics = createMockMetrics(); // hasData: false by default
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      expect(screen.queryByText(/Obbligazioni/)).not.toBeInTheDocument();
    });

    it("shows 'Pagato' with green text for paid schedules", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 3050,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 4805,
          novemberTotal: 0,
          yearTotal: 4805,
          accontiImpostaVersati: 0,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 1755,
          saldoInpsNettoAnnoN: 3050,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s1", user_id: "u", bucket: "saldo_tax", payment_year: 2026, due_date: "2026-06-30", total_expected: 1755, total_paid: 1755, status: "paid", created_at: "", updated_at: "" },
          { id: "s2", user_id: "u", bucket: "saldo_inps", payment_year: 2026, due_date: "2026-06-30", total_expected: 3050, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      expect(screen.getByText("Pagato")).toBeInTheDocument();
    });

    it("shows remaining amount for unpaid schedules", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 3050,
        currentYearObligations: {
          saldoTaxPrevYear: 0,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 3050,
          novemberTotal: 0,
          yearTotal: 3050,
          accontiImpostaVersati: 0,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 0,
          saldoInpsNettoAnnoN: 3050,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s2", user_id: "u", bucket: "saldo_inps", payment_year: 2026, due_date: "2026-06-30", total_expected: 3050, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      expect(screen.getByText("Saldo INPS 2025")).toBeInTheDocument();
      // The remaining amount should be displayed (3050 formatted — jsdom Intl may vary)
      const text = screen.getByText("Saldo INPS 2025").closest("div")?.textContent || "";
      expect(text).toMatch(/3[.,]?050/);
    });

    it("shows INPS fixed rates from actual schedule data (Art/Comm)", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 1000,
        currentYearObligations: {
          saldoTaxPrevYear: 0,
          saldoInpsPrevYear: 0,
          accontiResult: null,
          rateInpsFisseAnnoN: 0, // Even with 0, schedule data should still show
          paymentYear: 2026,
          hasData: true,
          juneTotal: 0,
          novemberTotal: 0,
          yearTotal: 0,
          accontiImpostaVersati: 0,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 0,
          saldoInpsNettoAnnoN: 0,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "q1", user_id: "u", bucket: "inps_q1", payment_year: 2026, due_date: "2026-05-16", total_expected: 1000, total_paid: 1000, status: "paid", created_at: "", updated_at: "" },
          { id: "q2", user_id: "u", bucket: "inps_q2", payment_year: 2026, due_date: "2026-08-20", total_expected: 1000, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="artigiani" metrics={metrics} />);

      // Should render INPS fixed rows from actual schedule data
      expect(screen.getByText("Obbligazioni 2026")).toBeInTheDocument();
    });
  });

  // ===== Story 11.1 — Saldo netto formula =====
  describe("Saldo netto formula (Story 11.1)", () => {
    it("renders saldo row from schedule (totale già al netto degli acconti)", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 1255,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 4305,
          novemberTotal: 0,
          yearTotal: 4305,
          accontiImpostaVersati: 500,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 1255,
          saldoInpsNettoAnnoN: 3050,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s1", user_id: "u", bucket: "saldo_tax", payment_year: 2026, due_date: "2026-06-30", total_expected: 1255, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // Le righe vengono dalle schedule DB; il totale è già al netto.
      expect(screen.getByText("Saldo Imposte 2025")).toBeInTheDocument();
      expect(screen.getByText("Totale non pagato")).toBeInTheDocument();
    });

    it("shows credito badge when acconti > imposta dovuta", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 0,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 3050,
          novemberTotal: 0,
          yearTotal: 3050,
          accontiImpostaVersati: 2000,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 0,
          saldoInpsNettoAnnoN: 3050,
          creditoImposta: 245,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s1", user_id: "u", bucket: "saldo_inps", payment_year: 2026, due_date: "2026-06-30", total_expected: 3050, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      expect(screen.getByText(/Credito imposta/)).toBeInTheDocument();
    });

    it("mostra riga 'Acconti già versati' quando il totale < somma righe", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 1255,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 3805,
          novemberTotal: 0,
          yearTotal: 3805,
          accontiImpostaVersati: 0,
          accontiInpsVersati: 1000,
          saldoTaxNettoAnnoN: 1755,
          saldoInpsNettoAnnoN: 2050,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s1", user_id: "u", bucket: "saldo_tax", payment_year: 2026, due_date: "2026-06-30", total_expected: 1755, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // schedule lordo 1755, totale 1255 → 500 di acconti già versati riconciliati
      expect(screen.getByText("Saldo Imposte 2025")).toBeInTheDocument();
      const ded = screen.getByText(/Acconti già versati/).closest("div");
      expect(ded?.textContent || "").toMatch(/500/);
    });

    it("[BUG-FIX] righe lorde + detrazione acconti riconciliano col totale", () => {
      // Riproduce il bug segnalato dall'utente:
      // - Formula in alto mostra correttamente il saldo netto
      // - Lista in basso mostrava il lordo invece del netto
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 3305, // netto: 1255 + 2050
        currentYearObligations: {
          saldoTaxPrevYear: 1755, // lordo
          saldoInpsPrevYear: 3050, // lordo
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 3305,
          novemberTotal: 0,
          yearTotal: 3305,
          accontiImpostaVersati: 500,
          accontiInpsVersati: 1000,
          saldoTaxNettoAnnoN: 1255, // netto = 1755 - 500
          saldoInpsNettoAnnoN: 2050, // netto = 3050 - 1000
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          mkSched("saldo_tax", 1755, 0, "pending"),
          mkSched("saldo_inps", 3050, 0, "pending"),
        ],
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // Righe lorde dalle schedule (1755 + 3050 = 4805) + UNA riga di detrazione
      // "Acconti già versati" (500 + 1000 = 1500) → riconciliano col totale 3305.
      expect(screen.getByText("Saldo Imposte 2025")).toBeInTheDocument();
      expect(screen.getByText("Saldo INPS 2025")).toBeInTheDocument();
      const ded = screen.getByText(/Acconti già versati/).closest("div");
      expect(ded?.textContent || "").toMatch(/1[.,]?500/);
    });

    it("[BUG-FIX] saldo row hidden when netto = 0 (full credit)", () => {
      // Quando acconti >= lordo, il saldo netto è 0 → la riga NON deve apparire
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 0,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 0,
          novemberTotal: 0,
          yearTotal: 0,
          accontiImpostaVersati: 2000,
          accontiInpsVersati: 4000,
          saldoTaxNettoAnnoN: 0, // credito
          saldoInpsNettoAnnoN: 0, // credito
          creditoImposta: 245,
          creditoInps: 950,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [],
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // Nessuna riga saldo deve apparire (netto = 0)
      expect(screen.queryByText("Saldo Imposte 2025")).not.toBeInTheDocument();
      expect(screen.queryByText("Saldo INPS 2025")).not.toBeInTheDocument();
    });

    it("hides formula when acconti = 0 (backward compatible)", () => {
      const metrics = createMockMetrics({
        unpaidCurrentYearTotal: 4805,
        currentYearObligations: {
          saldoTaxPrevYear: 1755,
          saldoInpsPrevYear: 3050,
          accontiResult: null,
          rateInpsFisseAnnoN: 0,
          paymentYear: 2026,
          hasData: true,
          juneTotal: 4805,
          novemberTotal: 0,
          yearTotal: 4805,
          accontiImpostaVersati: 0,
          accontiInpsVersati: 0,
          saldoTaxNettoAnnoN: 1755,
          saldoInpsNettoAnnoN: 3050,
          creditoImposta: 0,
          creditoInps: 0,
          isFirstYearOnly: false,
          
        },
        currentYearSchedules: [
          { id: "s1", user_id: "u", bucket: "saldo_tax", payment_year: 2026, due_date: "2026-06-30", total_expected: 1755, total_paid: 0, status: "pending", created_at: "", updated_at: "" },
        ] as any,
      });
      render(<BreakdownLevel2 gestione="separata" metrics={metrics} />);

      // Formula sections should NOT appear when acconti = 0
      expect(screen.queryByText(/Saldo Imposta Sostitutiva/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Saldo INPS Eccedenza/)).not.toBeInTheDocument();
    });
  });

  describe("Data consistency", () => {
    it("all displayed values come from metrics props (no hardcoded numbers)", () => {
      const customMetrics = createMockMetrics({
        incassiYTD: 12345,
        taxableAmount: 9629.1,
        taxAmount: 1444.37,
        inpsAmount: 2510.34,
        settings: {
          ...createMockMetrics().settings,
          taxRate: 5,
          profitCoeff: 67,
          inpsRate: 26.07,
        },
      });
      const { container } = render(
        <BreakdownLevel2 gestione="separata" metrics={customMetrics} />
      );

      const text = container.textContent || "";
      // Custom values should appear formatted
      expect(text).toContain("5%"); // aliquota sostitutiva
      expect(text).toContain("67%"); // coefficiente
      expect(text).toContain("26.07%"); // INPS rate (JS number formatting uses dot)
    });
  });
});
