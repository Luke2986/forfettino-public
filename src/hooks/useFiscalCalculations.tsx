import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useFiscalRules } from "@/hooks/useFiscalRules";
import {
  calcAccontiAnnoSuccessivo,
  calcTotaleMultiGestione,
  calcMinimaleArtigiani,
  calcMinimaleCommercianti,
  computeBufferAmount,
  computeMonthlyToolCost,
  computeYearlyToolCost,
  computeUnpaidCurrentYearTotal,
  computePaidCurrentYearTotal,
  computeDaCopireAmount,
  computeNetSpendable,
  computeNetSpendableRaw,
} from "@/lib/fiscal-engine";
import type { FiscalRulesParams, GestioneINPS, AccontiResult } from "@/lib/fiscal-engine";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];
import {
  formatCurrency as formatCurrencyLib,
  sanitizeMoney,
  sumMoney,
  subtractMoney,
  multiplyByPercent,
  calculateTaxAdvances as calcTaxAdv,
  calculateInpsAdvances as calcInpsAdv,
  checkBreakdownEquals,
} from "@/lib/money";

// Re-export formatCurrency per retrocompatibilità
export const formatCurrency = formatCurrencyLib;

// Re-export funzioni calcolo acconti per retrocompatibilità (usato da Landing.tsx)
export const calculateTaxAdvances = calcTaxAdv;
export const calculateInpsAdvances = calcInpsAdv;

// Breakdown scadenze giugno e novembre
export interface FiscalPeakBreakdown {
  // Saldi anno corrente (da pagare a giugno anno prossimo)
  saldoTax: number;
  saldoInps: number;
  // Acconti imposta
  accontoTax1: number; // giugno (40%)
  accontoTax2: number; // novembre (60% o unica)
  accontoTaxSingle: number; // rata unica se sotto soglia
  // Acconti INPS
  accontoInps1: number; // giugno (50%)
  accontoInps2: number; // novembre (50%)
  // Totali scadenze
  juneTotal: number;
  novemberTotal: number;
  yearTotal: number;
  // Meta
  paymentYear: number;
  isEstimate: boolean;
  // Story 11.1 — Saldo netto (dopo acconti già versati)
  accontiImpostaVersati: number;
  accontiInpsVersati: number;
  saldoTaxNetto: number;
  saldoInpsNetto: number;
  creditoImposta: number;
  creditoInps: number;
}

/** Obbligazioni dell'anno corrente calcolate da reddito anno precedente (Story 3.6) */
export interface CurrentYearObligations {
  /** Saldo imposta sostitutiva anno N-1 (da pagare a giugno anno N) */
  saldoTaxPrevYear: number;
  /** Saldo INPS anno N-1 (da pagare a giugno anno N) */
  saldoInpsPrevYear: number;
  /** Acconti anno N calcolati da reddito anno N-1 */
  accontiResult: AccontiResult | null;
  /** Rate INPS fisse anno N — solo Art/Comm (4 rate trimestrali) */
  rateInpsFisseAnnoN: number;
  /** Anno di pagamento (= currentYear) */
  paymentYear: number;
  /** true se i dati anno N-1 sono disponibili */
  hasData: boolean;
  /** Totale giugno (saldi + primo acconto) */
  juneTotal: number;
  /** Totale novembre (secondo acconto) */
  novemberTotal: number;
  /** Totale anno (giugno + novembre + rate fisse Art/Comm) */
  yearTotal: number;
  // Story 11.1 — Saldo netto (dopo acconti già versati anno N)
  /** Acconti imposta sostitutiva già versati nell'anno N-1 (cod. 1790+1791) */
  accontiImpostaVersati: number;
  /** Acconti INPS eccedenza già versati nell'anno N-1 */
  accontiInpsVersati: number;
  /** Saldo netto imposta = max(0, saldoTaxPrevYear - accontiImpostaVersati) */
  saldoTaxNettoAnnoN: number;
  /** Saldo netto INPS = max(0, saldoInpsPrevYear - accontiInpsVersati) */
  saldoInpsNettoAnnoN: number;
  /** Credito imposta = max(0, accontiImpostaVersati - saldoTaxPrevYear) */
  creditoImposta: number;
  /** Credito INPS = max(0, accontiInpsVersati - saldoInpsPrevYear) */
  creditoInps: number;
  /** true se gli obblighi sono SOLO rate INPS primo anno (no cross-year) — Story 40.3 */
  isFirstYearOnly: boolean;
}

export interface DeadlineInfo {
  id: string;
  bucket: string;
  paymentYear: number;
  dueDate: string;
  totalExpected: number;
  totalPaid: number;
  remaining: number;
  isEstimate?: boolean;
}

export interface FiscalMetrics {
  // Gestione INPS dell'utente (default: 'separata' per backward compat)
  inpsManagement: GestioneINPS;

  // Raw data
  incassiYTD: number;
  settings: {
    taxRate: number;
    profitCoeff: number;
    inpsRate: number;
    safetyBuffer: number;
    reserveAmount: number;
    bufferBase: string;
    deadlineWindowDays: number;
  };

  // Calculated amounts
  taxableAmount: number;
  taxAmount: number;
  inpsAmount: number;
  totalWithholding: number;
  bufferAmount: number;
  monthlyToolCost: number;
  monthlyAccountantCost: number;
  yearlyToolCost: number;
  toolCostsYTD: number;
  dueSoonRemaining: number;
  spendable: number;
  /** Raw spendable before Math.max(0, ...) floor — can be negative */
  spendableRaw?: number;

  // Obbligazioni anno corrente da reddito anno precedente (Story 3.6)
  currentYearObligations: CurrentYearObligations;

  // Picco fiscale anno prossimo (Opzione A - acconti separati)
  fiscalPeak: FiscalPeakBreakdown;

  // Scadenze
  nextDeadlineInWindow: DeadlineInfo | null; // scadenza nei prossimi X giorni
  nextDeadlineAny: DeadlineInfo | null; // prossima scadenza qualsiasi
  upcomingDeadlines: DeadlineInfo[]; // fino a 3 prossime scadenze (Story 3.4)
  hasScheduleData: boolean; // se esistono record in tax_schedule

  // Tool subscriptions count
  activeToolsCount: number;

  // Banner rate scadute (Story 4-1)
  expiredRatesCount: number;
  bannerRateScaduteDismissed: boolean;

  // Saldo iniziale conto corrente (Story 19-1)
  saldoInizialeCC: number;

  // Obbligazioni anno corrente non pagate (Story 3.7)
  // Somma di tutte le scadenze tax_schedule con payment_year=currentYear e status!='paid'
  unpaidCurrentYearTotal: number;
  // Tasse anno corrente già pagate (cassa uscita) — neutralizza l'aumento
  // spurio del netto spendibile al "segna come pagata" (opzione 2)
  paidCurrentYearTotal: number;
  // Scadenze grezze anno corrente (tutte, incluse pagate) per breakdown L2 stato per-voce
  currentYearSchedules: TaxScheduleRow[];

  // Fallback commercialista (Story 4-3)
  unpaidSchedules30d: TaxScheduleRow[];
  hasUnpaidOver30d: boolean;
  bannerFallbackCommercialistaDismissed: boolean;

  // Story 40-2: Calcolo INPS reale per Art/Comm
  /** Imposta sostitutiva calcolata con deducibilità INPS (reale per Art/Comm, = taxAmount per Separata) */
  impostaConDeducibilita: number;
  /** INPS variabile su eccedenza oltre reddito minimale (0 per Separata) */
  inpsVariabile: number;
  /** INPS minimale annuo fisso (0 per Separata) */
  inpsMinimale: number;
  /** INPS totale = minimale + variabile (= inpsAmount per Separata) */
  inpsTotale: number;
  /** Importo "Da coprire": imposta con deducibilità + variabile per Art/Comm, totalWithholding per Separata */
  daCopireAmount: number;
}

export function useFiscalCalculations(yearOverride?: number) {
  const { user } = useAuth();
  const { selectedYear } = useFiscalYear();
  const currentYear = yearOverride ?? selectedYear;

  // Fetch fiscal_rules per anno corrente (parametri normativi per calcAccontiAnnoSuccessivo)
  const { data: fiscalRulesData, isLoading: fiscalRulesLoading, isError: fiscalRulesError } = useFiscalRules(currentYear);

  // Fetch fiscal year settings
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    retry: 1, // Evita retry su anni senza settings (utente nuovo)
  });

  // Fetch receipts YTD
  const {
    data: receipts,
    isLoading: receiptsLoading,
    isError: receiptsError,
    refetch: refetchReceipts,
  } = useQuery({
    queryKey: ["receipts_ytd", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // === CROSS-ANNO: Fetch dati anno N-1 per obbligazioni anno corrente (Story 3.6) ===
  const prevYear = currentYear - 1;

  // Fetch fiscal_rules anno N-1 (parametri normativi)
  const { data: fiscalRulesPrevYear, isLoading: fiscalRulesPrevLoading, isError: fiscalRulesPrevError } = useFiscalRules(prevYear);

  // Fetch fiscal_year_settings anno N-1
  const {
    data: settingsPrevYear,
    isLoading: settingsPrevLoading,
    isError: settingsPrevError,
  } = useQuery({
    queryKey: ["fiscal_year_settings_prev", user?.id, prevYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", prevYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min — dati anno precedente cambiano raramente (ADR-2)
  });

  // Fetch receipts anno N-1
  const {
    data: receiptsPrevYear,
    isLoading: receiptsPrevLoading,
    isError: receiptsPrevError,
  } = useQuery({
    queryKey: ["receipts_ytd_prev", user?.id, prevYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", prevYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min — dati anno precedente stabili (ADR-2)
  });

  // Fetch active tool subscriptions
  const {
    data: toolSubscriptions,
    isLoading: toolsLoading,
    isError: toolsError,
    refetch: refetchTools,
  } = useQuery({
    queryKey: ["tool_subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tool_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch deadline window setting
  const deadlineWindowDays = settings?.deadline_window_days || 45;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const windowEndDate = new Date();
  windowEndDate.setDate(windowEndDate.getDate() + deadlineWindowDays);
  const windowEnd = `${windowEndDate.getFullYear()}-${String(windowEndDate.getMonth() + 1).padStart(2, "0")}-${String(windowEndDate.getDate()).padStart(2, "0")}`;

  // Fetch next deadline IN WINDOW (entro X giorni)
  const {
    data: nextDeadlineInWindowRaw,
    isLoading: deadlineInWindowLoading,
    refetch: refetchDeadlineInWindow,
  } = useQuery({
    queryKey: ["next_deadline_in_window", user?.id, deadlineWindowDays],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "paid")
        .gte("due_date", today)
        .lte("due_date", windowEnd)
        .order("due_date")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!settings,
  });

  // Fetch next deadlines ANY (qualsiasi data futura) — fino a 3 per mini-timeline (Story 3.4)
  const {
    data: upcomingDeadlinesRaw,
    isLoading: deadlineAnyLoading,
    refetch: refetchDeadlineAny,
  } = useQuery({
    queryKey: ["next_deadline_any", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "paid")
        .gte("due_date", today)
        .order("due_date")
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch due_soon deadlines (within deadline_window_days)
  const {
    data: dueSoonSchedules,
    isLoading: dueSoonLoading,
    refetch: refetchDueSoon,
  } = useQuery({
    queryKey: ["due_soon_schedules", user?.id, deadlineWindowDays],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "paid")
        .gte("due_date", today)
        .lte("due_date", windowEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!settings,
  });

  // Fetch ALL schedules for current year — both paid and unpaid (Story 3.7)
  // Used for: spendable calc (unpaid sum), L2 breakdown (per-bucket status)
  const {
    data: currentYearSchedulesRaw,
    isLoading: unpaidCurrentYearLoading,
    isError: currentYearSchedulesError,
    refetch: refetchUnpaidCurrentYear,
  } = useQuery({
    queryKey: ["current_year_schedules", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .eq("payment_year", currentYear)
        .order("due_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
  const currentYearSchedules = currentYearSchedulesRaw || [];

  // Fetch expired rates count (due_date < today AND status != 'paid') — Story 4-1
  const {
    data: expiredRatesCountRaw,
    isLoading: expiredRatesLoading,
    refetch: refetchExpiredRates,
  } = useQuery({
    queryKey: ["expired_rates_count", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("tax_schedule")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("payment_year", currentYear)
        .lt("due_date", today)
        .neq("status", "paid");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Fetch unpaid schedules scadute da più di 30 giorni — Story 4-3
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const {
    data: unpaidSchedules30dRaw,
    isLoading: unpaidSchedules30dLoading,
    refetch: refetchUnpaidSchedules30d,
  } = useQuery({
    queryKey: ["unpaid_schedules_30d", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .eq("payment_year", currentYear)
        .lt("due_date", thirtyDaysAgoStr)
        .neq("status", "paid")
        .order("due_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Refetch all data
  const refetchAll = async () => {
    await Promise.all([
      refetchSettings(),
      refetchReceipts(),
      refetchTools(),
      refetchDeadlineInWindow(),
      refetchDeadlineAny(),
      refetchDueSoon(),
      refetchUnpaidCurrentYear(),
      refetchExpiredRates(),
      refetchUnpaidSchedules30d(),
    ]);
  };

  // Calculate metrics - usando sanitizeMoney per gestire null/undefined
  const incassiYTD = receipts?.reduce((sum, r) => sum + sanitizeMoney(r.gross_amount), 0) || 0;

  // Nota: `|| N` trattava 0 come "assente" e lo sostituiva con il default, impedendo
  // all'utente di disattivare davvero il buffer (0% silenziosamente → 5%).
  // `?? N` applica il default solo quando il campo è null/undefined (settings vuoti).
  const taxRate = sanitizeMoney(settings?.tax_rate ?? 15);
  const profitCoeff = sanitizeMoney(settings?.profit_coefficient ?? 78);
  const inpsRate = sanitizeMoney(settings?.inps_rate ?? 26.07);
  const safetyBuffer = sanitizeMoney(settings?.safety_buffer_rate ?? 5);
  const reserveAmount = sanitizeMoney(settings?.reserve_amount ?? 0);
  const bufferBase = settings?.buffer_base || "receipts";
  const inpsManagement: GestioneINPS = (settings?.inps_management as GestioneINPS) || "separata";

  // Calculate taxable and withholdings - usando multiplyByPercent per precisione
  const taxableAmount = multiplyByPercent(incassiYTD, profitCoeff);
  const taxAmount = multiplyByPercent(taxableAmount, taxRate);
  const inpsAmount = multiplyByPercent(taxableAmount, inpsRate);
  const totalWithholding = sumMoney(taxAmount, inpsAmount);

  // Story 40-2 + Fix F1: imposta SEMPRE post-deducibilità INPS per tutte le gestioni
  // (Separata inclusa — art. 1 c.64 L.190/2014). calcTotaleMultiGestione applica
  // la deducibilità a ogni gestione; inpsVariabile/inpsMinimale restano 0 per Separata.
  let impostaConDeducibilita = taxAmount;
  let inpsVariabile = 0;
  let inpsMinimale = 0;
  let inpsTotale = inpsAmount;

  if (fiscalRulesData) {
    const aliquota: 5 | 15 = taxRate <= 5 ? 5 : 15;
    const riduzione35 = settings?.riduzione_35_attiva === true;
    const riduzione50 = settings?.riduzione_50_attiva === true;
    const totaleReale = calcTotaleMultiGestione(
      incassiYTD,
      profitCoeff,
      inpsManagement,
      fiscalRulesData as FiscalRulesParams,
      aliquota,
      riduzione35,
      riduzione50,
    );
    impostaConDeducibilita = totaleReale.imposta;
    inpsTotale = totaleReale.contributiINPS;
    if (totaleReale.dettaglioINPS.gestione !== "separata") {
      inpsVariabile = totaleReale.dettaglioINPS.result.variabile;
      inpsMinimale = totaleReale.dettaglioINPS.result.minimaleAnnuo;
    }
  }

  // Story 40-2: "Da coprire" = imposta con deducibilità + variabile (ESCLUSO minimale) per Art/Comm
  // Pure function unificata — vedi src/lib/fiscal-engine.ts
  const daCopireAmount = computeDaCopireAmount({
    inpsManagement,
    totalWithholding,
    impostaConDeducibilita,
    inpsVariabile,
    inpsTotale,
  });

  // Tool subscriptions cost — pure functions unificate
  const monthlyToolCost = computeMonthlyToolCost(toolSubscriptions);
  const yearlyToolCost = computeYearlyToolCost(monthlyToolCost);

  // Calculate specific accountant cost
  const monthlyAccountantCost =
    toolSubscriptions?.reduce((sum, tool) => {
      if (tool.category !== "accountant") return sum;
      const cost = sanitizeMoney(tool.cost);
      if (tool.frequency === "yearly") return sumMoney(sum, cost / 12);
      if (tool.frequency === "quarterly") return sumMoney(sum, cost / 3);
      return sumMoney(sum, cost);
    }, 0) || 0;

  // Calculate tool costs YTD estimate (monthlyToolCost * months elapsed)
  const currentMonth = new Date().getMonth() + 1;
  const toolCostsYTD = multiplyByPercent(monthlyToolCost, currentMonth * 100);

  // Calculate buffer amount based on buffer_base setting — pure function unificata
  const bufferAmount = computeBufferAmount(
    bufferBase as "receipts" | "reserve",
    totalWithholding,
    incassiYTD,
    safetyBuffer,
  );

  // Calculate due_soon_remaining (deadlines within window) - con sanitizeMoney
  // NOTA: dueSoonRemaining è mantenuto per backward compat (usato da altri componenti)
  const dueSoonRemaining =
    dueSoonSchedules?.reduce((sum, s) => {
      const expected = sanitizeMoney(s.total_expected);
      const paid = sanitizeMoney(s.total_paid);
      return sumMoney(sum, subtractMoney(expected, paid));
    }, 0) || 0;

  // Story 3.7: TUTTE le scadenze non pagate dell'anno corrente, al netto degli acconti già versati.
  // Pure function unificata — superset di dueSoonRemaining, evita double-counting.
  const unpaidCurrentYearTotal = computeUnpaidCurrentYearTotal(
    currentYearSchedules,
    settings?.acconti_imposta_versati,
    settings?.acconti_inps_eccedenza_versati,
  );

  // Opzione 2: tasse anno corrente già pagate (cassa realmente uscita).
  // Sottratta dalla base per neutralizzare l'aumento spurio del netto
  // spendibile quando una rata viene segnata pagata. Vedi computePaidCurrentYearTotal.
  const paidCurrentYearTotal = computePaidCurrentYearTotal(currentYearSchedules);

  // Story 19-1: saldo iniziale conto corrente
  const saldoInizialeCC = sanitizeMoney(settings?.saldo_iniziale_cc);

  // Spendibile netto — single source of truth (pure function in fiscal-engine.ts).
  // Storia formula:
  //   - Story 19-1: base = saldoInizialeCC + incassiYTD
  //   - Story 3.7:  usa unpaidCurrentYearTotal (superset dueSoonRemaining) per evitare double-counting
  //   - Story 40-2: usa daCopireAmount (Art/Comm: imposta deducibilità + INPS variabile, no minimale)
  const netSpendableInput = {
    saldoInizialeCC,
    incassiYTD,
    daCopireAmount,
    bufferAmount,
    yearlyToolCost,
    unpaidCurrentYearTotal,
    paidCurrentYearTotal,
    reserveAmount,
  };
  const spendableRaw = computeNetSpendableRaw(netSpendableInput);
  const spendable = computeNetSpendable(netSpendableInput);

  // === Calcolo picco fiscale via calcAccontiAnnoSuccessivo (Story 1.9) ===
  const paymentYear = currentYear + 1;

  // Saldi (imposta e INPS dell'anno corrente, da pagare a giugno anno prossimo)
  // Story 40-2: per Art/Comm usa valori reali (con deducibilità + variabile), non piatti
  // saldoInps: per Art/Comm solo variabile (minimale pagato via rate trimestrali), per Separata = inpsAmount
  const saldoTax = impostaConDeducibilita;
  const saldoInps = inpsManagement !== "separata" ? inpsVariabile : inpsAmount;

  // Story 11.1 — Acconti già versati e saldo netto
  const accontiImpostaVersati = sanitizeMoney(settings?.acconti_imposta_versati);
  const accontiInpsVersati = sanitizeMoney(settings?.acconti_inps_eccedenza_versati);
  const saldoTaxNetto = Math.max(0, subtractMoney(saldoTax, accontiImpostaVersati));
  const saldoInpsNetto = Math.max(0, subtractMoney(saldoInps, accontiInpsVersati));
  const creditoImposta = Math.max(0, subtractMoney(accontiImpostaVersati, saldoTax));
  const creditoInps = Math.max(0, subtractMoney(accontiInpsVersati, saldoInps));

  // Acconti via fiscal-engine — usa la gestione effettiva dell'utente
  const accontiResult = fiscalRulesData
    ? calcAccontiAnnoSuccessivo({
        ricaviLordiAnnoN: incassiYTD,
        coefficienteRedditivita: profitCoeff,
        gestione: inpsManagement,
        paramsAnnoN: fiscalRulesData,
        aliquotaSostitutiva: (taxRate <= 5 ? 5 : 15) as 5 | 15,
        primoAnno: false,
        riduzione35Attiva: settings?.riduzione_35_attiva === true,
        riduzione50Attiva: settings?.riduzione_50_attiva === true,
      })
    : null;

  const accontoTax1 = accontiResult?.accontoImpostaGiugno ?? 0;
  const accontoTax2 = accontiResult?.accontoImpostaNovembre ?? 0;
  const accontoTaxSingle = accontiResult ? (accontiResult.impostaHasDueRate ? 0 : accontiResult.accontoImpostaNovembre) : 0;
  const accontoInps1 = accontiResult?.accontoINPSGiugno ?? 0;
  const accontoInps2 = accontiResult?.accontoINPSNovembre ?? 0;

  // Totali scadenze - usando sumMoney per precisione
  // Story 11.1: usa saldi netti (dopo acconti già versati)
  const juneTotal = sumMoney(saldoTaxNetto, saldoInpsNetto, accontoTax1, accontoInps1);
  const novemberTotal = sumMoney(accontoTax2, accontoInps2);
  const yearTotal = sumMoney(juneTotal, novemberTotal);

  // INVARIANTE: verifica che breakdown == totale
  if (process.env.NODE_ENV === "development" && incassiYTD > 0) {
    const juneComponents = [saldoTaxNetto, saldoInpsNetto, accontoTax1, accontoInps1];
    const novComponents = [accontoTax2, accontoInps2];
    if (!checkBreakdownEquals(juneTotal, juneComponents)) {
      console.warn("[INVARIANT] June breakdown mismatch:", { juneTotal, juneComponents });
    }
    if (!checkBreakdownEquals(novemberTotal, novComponents)) {
      console.warn("[INVARIANT] November breakdown mismatch:", { novemberTotal, novComponents });
    }
  }

  const fiscalPeak: FiscalPeakBreakdown = {
    saldoTax,
    saldoInps,
    accontoTax1,
    accontoTax2,
    accontoTaxSingle,
    accontoInps1,
    accontoInps2,
    juneTotal,
    novemberTotal,
    yearTotal,
    paymentYear,
    isEstimate: true,
    // Story 11.1 — Saldo netto
    accontiImpostaVersati,
    accontiInpsVersati,
    saldoTaxNetto,
    saldoInpsNetto,
    creditoImposta,
    creditoInps,
  };

  // === Calcolo obbligazioni anno corrente da reddito anno N-1 (Story 3.6) ===
  const currentYearObligations: CurrentYearObligations = useMemo(() => {
    const emptyObligations: CurrentYearObligations = {
      saldoTaxPrevYear: 0,
      saldoInpsPrevYear: 0,
      accontiResult: null,
      rateInpsFisseAnnoN: 0,
      paymentYear: currentYear,
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
    };

    // Guard: nessun dato anno N-1
    const incassiAnnoPrec = receiptsPrevYear?.reduce((sum, r) => sum + sanitizeMoney(r.gross_amount), 0) || 0;
    if (!settingsPrevYear || !fiscalRulesPrevYear || incassiAnnoPrec <= 0) {
      // Story 39-2: Check primo anno Art/Comm — obblighi INPS same-year
      const gestioneN = settings?.inps_management as GestioneINPS | undefined;
      const annoAperturaN = settings?.anno_apertura_piva as number | null;
      const isFirstYearArtComm =
        gestioneN != null &&
        (gestioneN === "artigiani" || gestioneN === "commercianti") &&
        annoAperturaN != null &&
        annoAperturaN >= currentYear;

      if (isFirstYearArtComm) {
        if (!fiscalRulesData) {
          console.warn(
            `[useFiscalCalculations] fiscalRulesData anno ${currentYear} assente — primo anno Art/Comm senza rate`
          );
          return emptyObligations;
        }
        const riduzione35 = settings?.riduzione_35_attiva === true;
        const riduzione50N = settings?.riduzione_50_attiva === true;
        const rateInpsFisse = sanitizeMoney(
          gestioneN === "artigiani"
            ? calcMinimaleArtigiani(fiscalRulesData as FiscalRulesParams, riduzione35, riduzione50N)
            : calcMinimaleCommercianti(fiscalRulesData as FiscalRulesParams, riduzione35, riduzione50N)
        );
        return {
          ...emptyObligations,
          hasData: true,
          rateInpsFisseAnnoN: rateInpsFisse,
          yearTotal: rateInpsFisse,
          isFirstYearOnly: true,
        };
      }

      return emptyObligations;
    }

    // Parametri anno N-1
    const prevProfitCoeff = sanitizeMoney(settingsPrevYear.profit_coefficient) || 78;
    const prevTaxRate = sanitizeMoney(settingsPrevYear.tax_rate) || 15;
    const prevInpsManagement: GestioneINPS = (settingsPrevYear.inps_management as GestioneINPS) || "separata";
    const prevRiduzione35 = settingsPrevYear.riduzione_35_attiva === true;
    const prevRiduzione50 = settingsPrevYear.riduzione_50_attiva === true;

    // Determina aliquota sostitutiva anno N-1
    const prevAliquota: 5 | 15 = (prevTaxRate <= 5 ? 5 : 15);

    // Calcola saldo imposta e INPS anno N-1 con pipeline multi-gestione
    const totaleAnnoPrec = calcTotaleMultiGestione(
      incassiAnnoPrec,
      prevProfitCoeff,
      prevInpsManagement,
      fiscalRulesPrevYear,
      prevAliquota,
      prevRiduzione35,
      prevRiduzione50
    );

    const saldoTaxPrevYear = totaleAnnoPrec.imposta;
    const saldoInpsPrevYear = totaleAnnoPrec.contributiINPS;

    // Determina se primo anno di attività
    const annoApertura = settingsPrevYear.anno_apertura_piva as number | null;
    const isPrimoAnno = annoApertura != null && prevYear === annoApertura;

    // Calcola acconti anno N via calcAccontiAnnoSuccessivo con dati N-1
    const accontiCrossAnno = calcAccontiAnnoSuccessivo({
      ricaviLordiAnnoN: incassiAnnoPrec,
      coefficienteRedditivita: prevProfitCoeff,
      gestione: prevInpsManagement,
      paramsAnnoN: fiscalRulesPrevYear,
      aliquotaSostitutiva: prevAliquota,
      primoAnno: isPrimoAnno,
      riduzione35Attiva: prevRiduzione35,
      riduzione50Attiva: prevRiduzione50,
    });

    // Rate INPS fisse anno N — solo per Art/Comm (da parametri anno N corrente)
    // Applica la riduzione 35/50 dell'anno N (settings correnti), non dell'anno N-1,
    // perché le 4 rate fisse sono pagamenti dell'anno N.
    let rateInpsFisseAnnoN = 0;
    if (prevInpsManagement === "artigiani" || prevInpsManagement === "commercianti") {
      if (!fiscalRulesData) {
        console.warn(
          `[useFiscalCalculations] fiscalRulesData anno ${currentYear} assente per gestione ${prevInpsManagement} — rate INPS fisse = 0`
        );
      } else {
        const rid35N = settings?.riduzione_35_attiva === true;
        const rid50N = settings?.riduzione_50_attiva === true;
        rateInpsFisseAnnoN = sanitizeMoney(
          prevInpsManagement === "artigiani"
            ? calcMinimaleArtigiani(fiscalRulesData as FiscalRulesParams, rid35N, rid50N)
            : calcMinimaleCommercianti(fiscalRulesData as FiscalRulesParams, rid35N, rid50N)
        );
      }
    }

    // Story 11.1 — Saldo netto obbligazioni anno corrente
    // Acconti versati letti da settings anno corrente (N)
    const accontiImpostaVersatiN = sanitizeMoney(settings?.acconti_imposta_versati);
    const accontiInpsVersatiN = sanitizeMoney(settings?.acconti_inps_eccedenza_versati);
    const saldoTaxNettoN = Math.max(0, subtractMoney(saldoTaxPrevYear, accontiImpostaVersatiN));
    const saldoInpsNettoN = Math.max(0, subtractMoney(saldoInpsPrevYear, accontiInpsVersatiN));
    const creditoImpostaN = Math.max(0, subtractMoney(accontiImpostaVersatiN, saldoTaxPrevYear));
    const creditoInpsN = Math.max(0, subtractMoney(accontiInpsVersatiN, saldoInpsPrevYear));

    // Totali scadenze anno corrente (usa saldi netti)
    const juneTotalCross = sumMoney(
      saldoTaxNettoN,
      saldoInpsNettoN,
      accontiCrossAnno.accontoImpostaGiugno,
      accontiCrossAnno.accontoINPSGiugno
    );
    const novemberTotalCross = sumMoney(
      accontiCrossAnno.accontoImpostaNovembre,
      accontiCrossAnno.accontoINPSNovembre
    );
    const yearTotalCross = sumMoney(juneTotalCross, novemberTotalCross, rateInpsFisseAnnoN);

    return {
      saldoTaxPrevYear,
      saldoInpsPrevYear,
      accontiResult: accontiCrossAnno,
      rateInpsFisseAnnoN,
      paymentYear: currentYear,
      hasData: true,
      juneTotal: juneTotalCross,
      novemberTotal: novemberTotalCross,
      yearTotal: yearTotalCross,
      // Story 11.1
      accontiImpostaVersati: accontiImpostaVersatiN,
      accontiInpsVersati: accontiInpsVersatiN,
      saldoTaxNettoAnnoN: saldoTaxNettoN,
      saldoInpsNettoAnnoN: saldoInpsNettoN,
      creditoImposta: creditoImpostaN,
      creditoInps: creditoInpsN,
      isFirstYearOnly: false,
    };
  }, [receiptsPrevYear, settingsPrevYear, fiscalRulesPrevYear, fiscalRulesData, prevYear, currentYear, settings]);

  // Format deadline info - usando sanitizeMoney per sicurezza
  const formatDeadline = (raw: typeof nextDeadlineInWindowRaw): DeadlineInfo | null => {
    if (!raw) return null;
    const totalExpected = sanitizeMoney(raw.total_expected);
    const totalPaid = sanitizeMoney(raw.total_paid);
    return {
      id: raw.id,
      bucket: raw.bucket,
      paymentYear: raw.payment_year,
      dueDate: raw.due_date,
      totalExpected,
      totalPaid,
      remaining: Math.max(0, subtractMoney(totalExpected, totalPaid)),
      isEstimate: false, // da DB è "actual" per ora
    };
  };

  const nextDeadlineInWindow = formatDeadline(nextDeadlineInWindowRaw);

  // Map upcoming deadlines array (Story 3.4) e derivare nextDeadlineAny per backward compat
  const upcomingDeadlines: DeadlineInfo[] = (upcomingDeadlinesRaw || [])
    .map(formatDeadline)
    .filter((d): d is DeadlineInfo => d !== null);
  const nextDeadlineAny = upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

  const metrics: FiscalMetrics = {
    inpsManagement,
    incassiYTD,
    settings: {
      taxRate,
      profitCoeff,
      inpsRate,
      safetyBuffer,
      reserveAmount,
      bufferBase,
      deadlineWindowDays,
    },
    taxableAmount,
    taxAmount,
    inpsAmount,
    totalWithholding,
    bufferAmount,
    monthlyToolCost,
    monthlyAccountantCost,
    yearlyToolCost,
    toolCostsYTD,
    dueSoonRemaining,
    spendable,
    spendableRaw,
    saldoInizialeCC,
    unpaidCurrentYearTotal,
    paidCurrentYearTotal,
    currentYearSchedules,
    currentYearObligations,
    fiscalPeak,
    nextDeadlineInWindow,
    nextDeadlineAny,
    upcomingDeadlines,
    hasScheduleData: !!nextDeadlineAny || (dueSoonSchedules?.length || 0) > 0,
    activeToolsCount: toolSubscriptions?.length || 0,
    expiredRatesCount: expiredRatesCountRaw ?? 0,
    bannerRateScaduteDismissed: settings?.banner_rate_scadute_dismissed ?? false,
    unpaidSchedules30d: unpaidSchedules30dRaw ?? [],
    hasUnpaidOver30d: (unpaidSchedules30dRaw?.length ?? 0) > 0,
    bannerFallbackCommercialistaDismissed:
      settings?.banner_fallback_commercialista_dismissed ?? false,
    // Story 40-2: Calcolo INPS reale per Art/Comm
    impostaConDeducibilita,
    inpsVariabile,
    inpsMinimale,
    inpsTotale,
    daCopireAmount,
  };

  return {
    metrics,
    isLoading:
      settingsLoading ||
      receiptsLoading ||
      toolsLoading ||
      fiscalRulesLoading ||
      fiscalRulesPrevLoading ||
      settingsPrevLoading ||
      receiptsPrevLoading ||
      deadlineInWindowLoading ||
      deadlineAnyLoading ||
      dueSoonLoading ||
      unpaidCurrentYearLoading ||
      expiredRatesLoading ||
      unpaidSchedules30dLoading,
    // isError aggrega SOLO le query che guidano i numeri fiscali (settings,
    // receipts, fiscal_rules correnti + N-1, tools, scadenze anno corrente).
    // Se true, `metrics` è calcolato su dati parziali/default → la UI deve
    // mostrare uno stato errore invece di numeri potenzialmente errati (zeri).
    isError:
      settingsError ||
      receiptsError ||
      fiscalRulesError ||
      fiscalRulesPrevError ||
      settingsPrevError ||
      receiptsPrevError ||
      toolsError ||
      currentYearSchedulesError,
    currentYear,
    refetch: refetchAll,
  };
}
