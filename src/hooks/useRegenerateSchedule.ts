import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  calcAccontiAnnoSuccessivo,
  generateScheduleEvents,
  calcTotaleMultiGestione,
  calcMinimaleArtigiani,
  calcMinimaleCommercianti,
  calcRateFisseArtigiani,
  calcRateFisseCommercianti,
  getScadenzeFiscali,
} from "@/lib/fiscal-engine";
import type {
  FiscalRulesParams,
  GestioneINPS,
  ScheduleEvent,
} from "@/lib/fiscal-engine";
import { sanitizeMoney, sumMoney, subtractMoney, multiplyByPercent, checkBreakdownEquals } from "@/lib/money";

/**
 * Maps a ScheduleEvent from the fiscal engine to a tax_schedule DB bucket.
 *
 * For Art/Comm: uses typed buckets (inps_q1..q4, acconto_inps_1/2, acconto_tax_1/2).
 * For Separata: NOT used — Separata keeps the V1 june/november path.
 */
export function scheduleEventToBucket(event: ScheduleEvent): string {
  // Preferire il campo strutturato `rataIndex` (deterministico). Lo string-match
  // su descrizione/data resta SOLO come fallback per eventi legacy senza rataIndex.
  if (event.tipo === "INPS_FISSO") {
    if (event.rataIndex && event.rataIndex >= 1 && event.rataIndex <= 4) {
      return `inps_q${event.rataIndex}`;
    }
    if (event.descrizione.includes("Q1")) return "inps_q1";
    if (event.descrizione.includes("Q2")) return "inps_q2";
    if (event.descrizione.includes("Q3")) return "inps_q3";
    if (event.descrizione.includes("Q4")) return "inps_q4";
    console.warn(`[scheduleEventToBucket] Unknown INPS_FISSO event (rataIndex=${event.rataIndex}, desc="${event.descrizione}")`);
    return "inps_q1";
  }

  if (event.tipo === "INPS_VARIABILE") {
    if (event.rataIndex === 1) return "acconto_inps_1";
    if (event.rataIndex === 2) return "acconto_inps_2";
    if (event.descrizione.includes("1°")) return "acconto_inps_1";
    return "acconto_inps_2";
  }

  if (event.tipo === "TAX") {
    // rataIndex 1 = giugno (40% o, storicamente, prima rata), 2 = novembre (60% o unica rata)
    if (event.rataIndex === 1) return "acconto_tax_1";
    if (event.rataIndex === 2) return "acconto_tax_2";
    // Fallback legacy su data: la 1ª rata (saldo + 1° acconto) cade a giugno o,
    // con la proroga forfettari/ISA, a luglio; la 2ª rata cade a novembre.
    const mese = event.dataScadenza.slice(5, 7);
    if (mese === "06" || mese === "07") return "acconto_tax_1";
    return "acconto_tax_2";
  }

  console.warn(`[scheduleEventToBucket] Unknown event tipo: "${event.tipo}"`);
  return "acconto_tax_1";
}

/**
 * Maps a ScheduleEvent to the amount breakdown columns of tax_schedule.
 * For INPS_FISSO: importo goes to inps_balance (minimale includes maternità).
 * For INPS_VARIABILE: importo goes to inps_advance.
 * For TAX: importo goes to tax_advance (acconti) or tax_balance (saldo).
 */
export function scheduleEventToAmounts(event: ScheduleEvent): {
  tax_balance: number;
  tax_advance: number;
  inps_balance: number;
  inps_advance: number;
} {
  switch (event.tipo) {
    case "INPS_FISSO":
      return { tax_balance: 0, tax_advance: 0, inps_balance: event.importo, inps_advance: 0 };
    case "INPS_VARIABILE":
      return { tax_balance: 0, tax_advance: 0, inps_balance: 0, inps_advance: event.importo };
    case "TAX":
      return { tax_balance: 0, tax_advance: event.importo, inps_balance: 0, inps_advance: 0 };
    default:
      return { tax_balance: 0, tax_advance: event.importo, inps_balance: 0, inps_advance: 0 };
  }
}

// ── Story 39-1: First year Art/Comm detection and rate building (pure functions) ──

export type FirstYearDetectionResult =
  | { isFirstYear: true; gestione: "artigiani" | "commercianti"; riduzione35Attiva: boolean; riduzione50Attiva: boolean }
  | { isFirstYear: false; reason: string };

/**
 * Detects whether the user qualifies for the first-year Art/Comm INPS path.
 * Pure function — no Supabase dependency, testable in isolation.
 *
 * @param settingsN - fiscal_year_settings for paymentYear (N), or null if missing
 * @param paymentYear - the year to generate rates for
 */
export function detectFirstYearArtComm(
  settingsN: { inps_management: string; riduzione_35_attiva: boolean; riduzione_50_attiva: boolean; anno_apertura_piva: number | null } | null,
  paymentYear: number
): FirstYearDetectionResult {
  if (!settingsN) {
    return { isFirstYear: false, reason: `Impostazioni fiscali mancanti per il ${paymentYear}.` };
  }

  const gestione = settingsN.inps_management;
  if (gestione !== "artigiani" && gestione !== "commercianti") {
    return { isFirstYear: false, reason: `Gestione ${gestione}: nessuna rata INPS trimestrale primo anno.` };
  }

  if (settingsN.anno_apertura_piva == null) {
    return { isFirstYear: false, reason: "Anno apertura P.IVA non configurato." };
  }

  if (settingsN.anno_apertura_piva < paymentYear) {
    return { isFirstYear: false, reason: `Impostazioni fiscali mancanti per il ${paymentYear - 1}.` };
  }

  return {
    isFirstYear: true,
    gestione,
    riduzione35Attiva: settingsN.riduzione_35_attiva === true,
    riduzione50Attiva: settingsN.riduzione_50_attiva === true,
  };
}

export type FirstYearINPSRow = {
  bucket: string;
  due_date: string;
  reference_year: number;
  inps_balance: number;
  inps_advance: number;
  tax_balance: number;
  tax_advance: number;
  total_expected: number;
};

/**
 * Builds 4 INPS Q1-Q4 rows for first-year Art/Comm users.
 * Pure function — uses fiscal-engine calc functions, no Supabase dependency.
 */
export function buildFirstYearINPSRows(
  gestione: "artigiani" | "commercianti",
  fiscalRulesParams: FiscalRulesParams,
  riduzione35Attiva: boolean,
  paymentYear: number,
  riduzione50Attiva: boolean = false
): FirstYearINPSRow[] {
  const minimale = gestione === "artigiani"
    ? calcMinimaleArtigiani(fiscalRulesParams, riduzione35Attiva, riduzione50Attiva)
    : calcMinimaleCommercianti(fiscalRulesParams, riduzione35Attiva, riduzione50Attiva);

  const rate = gestione === "artigiani"
    ? calcRateFisseArtigiani(minimale)
    : calcRateFisseCommercianti(minimale);

  const scadenze = getScadenzeFiscali(paymentYear);
  const dueDates = [scadenze.inpsFissoQ1, scadenze.inpsFissoQ2, scadenze.inpsFissoQ3, scadenze.inpsFissoQ4];
  const buckets = ["inps_q1", "inps_q2", "inps_q3", "inps_q4"];

  const maternitaAnnuale = sanitizeMoney(fiscalRulesParams.maternita_annuale);
  const maternitaPerRata = Math.round((maternitaAnnuale / 4) * 100) / 100;

  return rate.map((rataImporto, i) => ({
    bucket: buckets[i],
    due_date: dueDates[i],
    reference_year: paymentYear, // same-year obligation
    inps_balance: subtractMoney(rataImporto, maternitaPerRata),
    inps_advance: maternitaPerRata,
    tax_balance: 0,
    tax_advance: 0,
    total_expected: rataImporto,
  }));
}

/**
 * Hook per rigenerare le entry tax_schedule per un dato payment_year.
 *
 * payment_year = anno in cui si pagano le tasse
 * reference_year = anno degli incassi (= payment_year - 1)
 *
 * Supporta tutte e 3 le gestioni INPS:
 * - Separata: 2 righe (june, november) — path V1 invariato
 * - Artigiani/Commercianti: fino a 8 righe (inps_q1..q4, acconto_inps_1/2, acconto_tax_1/2)
 *   via generateScheduleEvents dal fiscal-engine
 *
 * Prerequisiti: devono esistere fiscal_year_settings e fiscal_rules
 * per il reference_year. Se mancano, la rigenerazione viene skippata.
 */
export function useRegenerateSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const getStatus = (paid: number, expected: number): string => {
    if (paid >= expected && expected > 0) return "paid";
    if (paid > 0) return "partial";
    return "open";
  };

  const invalidateScheduleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["tax_schedule"] });
    queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
    queryClient.invalidateQueries({ queryKey: ["next_deadline_any"] });
    queryClient.invalidateQueries({ queryKey: ["next_deadline_in_window"] });
    queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
    // Story 5.4: Align calendar query invalidation with schedule regeneration
    queryClient.invalidateQueries({ queryKey: ["calendar_tax_deadlines"] });
  };

  /**
   * Rigenera le scadenze con il path V1 per utenti Separata.
   * Produce esattamente 2 righe: june + november.
   */
  const regenerateSeparata = async (
    paymentYear: number,
    referenceYear: number,
    receiptsSum: number,
    profitCoeff: number,
    taxRate: number,
    inpsRate: number,
    fiscalRulesData: FiscalRulesParams
  ): Promise<{ success: boolean; reason?: string }> => {
    // Saldi anno N — Fix F1: imposta post-deducibilità INPS anche per Separata
    // (art. 1 c.64 L.190/2014). calcTotaleMultiGestione applica la deducibilità
    // e allinea il saldo agli acconti (che già la applicavano via calcAcconti…).
    const aliquotaSep: 5 | 15 = (taxRate <= 5 ? 5 : 15) as 5 | 15;
    const totaleSep = calcTotaleMultiGestione(
      receiptsSum,
      profitCoeff,
      "separata",
      fiscalRulesData,
      aliquotaSep,
      false,
      false,
    );
    const taxDue = totaleSep.imposta;
    const inpsDue = totaleSep.contributiINPS;

    // Acconti anno N+1 via fiscal-engine
    const accontiResult = calcAccontiAnnoSuccessivo({
      ricaviLordiAnnoN: receiptsSum,
      coefficienteRedditivita: profitCoeff,
      gestione: "separata",
      paramsAnnoN: fiscalRulesData,
      aliquotaSostitutiva: (taxRate <= 5 ? 5 : 15) as 5 | 15,
      primoAnno: false,
    });

    // June: saldo anno N (100%) + 1° acconto anno N+1
    const juneTaxBalance = taxDue;
    const juneTaxAdvance = accontiResult.accontoImpostaGiugno;
    const juneInpsBalance = inpsDue;
    const juneInpsAdvance = accontiResult.accontoINPSGiugno;
    const juneTotal = sumMoney(juneTaxBalance, juneTaxAdvance, juneInpsBalance, juneInpsAdvance);

    // November: 2° acconto anno N+1
    const novTaxAdvance = accontiResult.accontoImpostaNovembre;
    const novInpsAdvance = accontiResult.accontoINPSNovembre;
    const novTotal = sumMoney(novTaxAdvance, novInpsAdvance);

    // Dev invariant check
    if (process.env.NODE_ENV === "development") {
      if (!checkBreakdownEquals(juneTotal, [juneTaxBalance, juneTaxAdvance, juneInpsBalance, juneInpsAdvance])) {
        console.warn("[useRegenerateSchedule] June breakdown mismatch");
      }
      if (!checkBreakdownEquals(novTotal, [novTaxAdvance, novInpsAdvance])) {
        console.warn("[useRegenerateSchedule] November breakdown mismatch");
      }
    }

    // Fetch existing schedules per preservare total_paid
    const { data: existingSchedules } = await supabase
      .from("tax_schedule")
      .select("*")
      .eq("user_id", user!.id)
      .eq("payment_year", paymentYear);

    const existingByBucket = new Map(
      (existingSchedules || []).map((s) => [s.bucket, s])
    );

    const existingJune = existingByBucket.get("june");
    const existingNov = existingByBucket.get("november");
    const existingJunePaid = sanitizeMoney(existingJune?.total_paid);
    const existingNovPaid = sanitizeMoney(existingNov?.total_paid);

    // Date scadenza dal motore: includono la proroga forfettari/ISA (giugno →
    // luglio per gli anni con proroga) e lo slittamento al giorno lavorativo.
    const scadenze = getScadenzeFiscali(paymentYear);

    // Upsert June
    // onConflict on natural key to handle re-runs safely
    const { error: juneError } = await supabase.from("tax_schedule").upsert({
      user_id: user!.id,
      payment_year: paymentYear,
      reference_year: referenceYear,
      bucket: "june",
      due_date: existingJune?.due_date || scadenze.taxGiugno,
      tax_balance: juneTaxBalance,
      tax_advance: juneTaxAdvance,
      inps_balance: juneInpsBalance,
      inps_advance: juneInpsAdvance,
      total_expected: juneTotal,
      total_paid: existingJunePaid,
      status: getStatus(existingJunePaid, juneTotal),
    }, { onConflict: "user_id,payment_year,bucket" });

    if (juneError) {
      console.error("[useRegenerateSchedule] June upsert error:", {
        code: juneError.code,
        message: juneError.message,
        details: juneError.details,
        hint: juneError.hint,
      });
      return { success: false, reason: `Errore nel salvataggio della scadenza di giugno: ${juneError.message}` };
    }

    // Upsert November
    // onConflict on natural key to handle re-runs safely
    const { error: novError } = await supabase.from("tax_schedule").upsert({
      user_id: user!.id,
      payment_year: paymentYear,
      reference_year: referenceYear,
      bucket: "november",
      due_date: existingNov?.due_date || scadenze.taxNovembre,
      tax_balance: 0,
      tax_advance: novTaxAdvance,
      inps_balance: 0,
      inps_advance: novInpsAdvance,
      total_expected: novTotal,
      total_paid: existingNovPaid,
      status: getStatus(existingNovPaid, novTotal),
    }, { onConflict: "user_id,payment_year,bucket" });

    if (novError) {
      console.error("[useRegenerateSchedule] November upsert error:", {
        code: novError.code,
        message: novError.message,
        details: novError.details,
        hint: novError.hint,
      });
      return { success: false, reason: `Errore nel salvataggio della scadenza di novembre: ${novError.message}` };
    }

    // Delete orphan buckets (in case user switched from Art/Comm to Separata)
    const separataBuckets = ["june", "november"];
    const orphanRows = (existingSchedules || []).filter(
      (s) => !separataBuckets.includes(s.bucket) && sanitizeMoney(s.total_paid) <= 0
    );
    if (orphanRows.length > 0) {
      const orphanIds = orphanRows.map((s) => s.id);
      const { error: deleteError } = await supabase
        .from("tax_schedule")
        .delete()
        .in("id", orphanIds);
      if (deleteError) {
        console.error("[useRegenerateSchedule] Orphan delete error:", deleteError);
        return { success: false, reason: "Errore nella rimozione delle scadenze obsolete." };
      }
    }

    return { success: true };
  };

  /**
   * Rigenera le scadenze per utenti Artigiani/Commercianti
   * usando generateScheduleEvents dal fiscal-engine.
   * Produce fino a 8 righe con bucket tipizzati.
   */
  const regenerateArtComm = async (
    paymentYear: number,
    referenceYear: number,
    receiptsSum: number,
    profitCoeff: number,
    taxRate: number,
    gestione: "artigiani" | "commercianti",
    riduzione35Attiva: boolean,
    riduzione50Attiva: boolean,
    fiscalRulesData: FiscalRulesParams
  ): Promise<{ success: boolean; reason?: string }> => {
    const aliquotaSostitutiva = (taxRate <= 5 ? 5 : 15) as 5 | 15;

    // Generate schedule events via fiscal-engine (pure function, battle-tested)
    const events = generateScheduleEvents(
      gestione,
      receiptsSum,
      profitCoeff,
      fiscalRulesData,
      aliquotaSostitutiva,
      paymentYear, // events are for the payment year
      riduzione35Attiva,
      riduzione50Attiva
    );

    // Calcola maternità per rata per il breakdown corretto INPS_FISSO
    // maternita_annuale è il contributo maternità annuo (es. 7.44€/anno)
    // La rata = maternita_annuale / 4, arrotondata per centesimi
    const maternitaAnnuale = sanitizeMoney(fiscalRulesData.maternita_annuale);
    const maternitaPerRata = Math.round((maternitaAnnuale / 4) * 100) / 100;

    // Fetch existing schedules per preservare total_paid
    const { data: existingSchedules } = await supabase
      .from("tax_schedule")
      .select("*")
      .eq("user_id", user!.id)
      .eq("payment_year", paymentYear);

    const existingByBucket = new Map(
      (existingSchedules || []).map((s) => [s.bucket, s])
    );

    // Map events to DB rows for batch upsert
    const newBuckets: string[] = [];
    const upsertRows: Array<{
      user_id: string;
      payment_year: number;
      reference_year: number;
      bucket: string;
      due_date: string;
      tax_balance: number;
      tax_advance: number;
      inps_balance: number;
      inps_advance: number;
      total_expected: number;
      total_paid: number;
      status: string;
    }> = [];

    for (const event of events) {
      const bucket = scheduleEventToBucket(event);
      newBuckets.push(bucket);

      const existing = existingByBucket.get(bucket);
      const existingPaid = sanitizeMoney(existing?.total_paid);
      let amounts = scheduleEventToAmounts(event);

      // Override INPS_FISSO breakdown: split importo into minimale + maternità
      // inps_balance = minimale puro (senza maternità)
      // inps_advance = quota maternità per rata
      if (event.tipo === "INPS_FISSO") {
        amounts = {
          tax_balance: 0,
          tax_advance: 0,
          inps_balance: subtractMoney(event.importo, maternitaPerRata),
          inps_advance: maternitaPerRata,
        };
      }

      upsertRows.push({
        user_id: user!.id,
        payment_year: paymentYear,
        reference_year: referenceYear,
        bucket,
        due_date: event.dataScadenza,
        ...amounts,
        total_expected: event.importo,
        total_paid: existingPaid,
        status: getStatus(existingPaid, event.importo),
      });
    }

    // Batch upsert all rows in a single DB call
    // onConflict on natural key to handle re-runs safely (avoids UNIQUE violation
    // when existing rows aren't matched by PK, e.g. after a partial first attempt)
    const { error: upsertError } = await supabase
      .from("tax_schedule")
      .upsert(upsertRows, { onConflict: "user_id,payment_year,bucket" });

    if (upsertError) {
      console.error("[useRegenerateSchedule] Batch upsert error:", {
        code: upsertError.code,
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
      });
      return { success: false, reason: `Errore nel salvataggio delle scadenze: ${upsertError.message}` };
    }

    // Delete orphan rows (buckets that no longer exist for current gestione)
    // BUT preserve rows with total_paid > 0 (user already paid them)
    const orphanRows = (existingSchedules || []).filter(
      (s) => !newBuckets.includes(s.bucket) && sanitizeMoney(s.total_paid) <= 0
    );
    if (orphanRows.length > 0) {
      const orphanIds = orphanRows.map((s) => s.id);
      const { error: deleteError } = await supabase
        .from("tax_schedule")
        .delete()
        .in("id", orphanIds);
      if (deleteError) {
        console.error("[useRegenerateSchedule] Orphan delete error:", deleteError);
        return { success: false, reason: "Errore nella rimozione delle scadenze obsolete." };
      }
    }

    // Dev invariant check: sum of INPS_FISSO rates should equal minimale
    if (process.env.NODE_ENV === "development") {
      const inpsFissoEvents = events.filter((e) => e.tipo === "INPS_FISSO");
      if (inpsFissoEvents.length === 4) {
        const inpsFissoTotal = inpsFissoEvents.reduce((sum, e) => sumMoney(sum, e.importo), 0);
        const totale = calcTotaleMultiGestione(
          receiptsSum, profitCoeff, gestione, fiscalRulesData,
          aliquotaSostitutiva, riduzione35Attiva
        );
        if (totale.dettaglioINPS.gestione !== "separata") {
          const minimaleAnnuo = totale.dettaglioINPS.result.minimaleAnnuo;
          if (!checkBreakdownEquals(minimaleAnnuo, inpsFissoEvents.map((e) => e.importo))) {
            console.warn("[useRegenerateSchedule] INPS fisso rates don't sum to minimale");
          }
        }
      }
    }

    return { success: true };
  };

  /**
   * Story 39-1: Genera le 4 rate INPS trimestrali per il primo anno Art/Comm.
   * Queste rate hanno reference_year = paymentYear (same-year obligation).
   */
  const regenerateFirstYearArtComm = async (
    paymentYear: number,
    gestione: "artigiani" | "commercianti",
    riduzione35Attiva: boolean,
    riduzione50Attiva: boolean,
    fiscalRulesData: FiscalRulesParams
  ): Promise<{ success: boolean; reason?: string }> => {
    const rows = buildFirstYearINPSRows(gestione, fiscalRulesData, riduzione35Attiva, paymentYear, riduzione50Attiva);

    // Fetch existing schedules to preserve total_paid
    const { data: existingSchedules } = await supabase
      .from("tax_schedule")
      .select("*")
      .eq("user_id", user!.id)
      .eq("payment_year", paymentYear);

    const existingByBucket = new Map(
      (existingSchedules || []).map((s) => [s.bucket, s])
    );

    const upsertRows = rows.map((row) => {
      const existing = existingByBucket.get(row.bucket);
      const existingPaid = sanitizeMoney(existing?.total_paid);
      return {
        user_id: user!.id,
        payment_year: paymentYear,
        reference_year: row.reference_year,
        bucket: row.bucket,
        due_date: row.due_date,
        tax_balance: row.tax_balance,
        tax_advance: row.tax_advance,
        inps_balance: row.inps_balance,
        inps_advance: row.inps_advance,
        total_expected: row.total_expected,
        total_paid: existingPaid,
        status: getStatus(existingPaid, row.total_expected),
      };
    });

    const { error: upsertError } = await supabase
      .from("tax_schedule")
      .upsert(upsertRows, { onConflict: "user_id,payment_year,bucket" });

    if (upsertError) {
      console.error("[useRegenerateSchedule] First year upsert error:", {
        code: upsertError.code,
        message: upsertError.message,
      });
      return { success: false, reason: `Errore nel salvataggio delle scadenze primo anno: ${upsertError.message}` };
    }

    // Delete orphan rows (only inps_q1..q4 are valid for first year)
    const validBuckets = rows.map((r) => r.bucket);
    const orphanRows = (existingSchedules || []).filter(
      (s) => !validBuckets.includes(s.bucket) && sanitizeMoney(s.total_paid) <= 0
    );
    if (orphanRows.length > 0) {
      const orphanIds = orphanRows.map((s) => s.id);
      const { error: deleteError } = await supabase
        .from("tax_schedule")
        .delete()
        .in("id", orphanIds);
      if (deleteError) {
        console.error("[useRegenerateSchedule] First year orphan delete error:", deleteError);
        return { success: false, reason: "Errore nella rimozione delle scadenze obsolete." };
      }
    }

    return { success: true };
  };

  /**
   * Rigenera le scadenze tax_schedule per un dato anno di pagamento.
   * @param paymentYear - Anno in cui si pagano le tasse (es. 2026 per incassi del 2025)
   * @returns { success: true } oppure { success: false, reason: string } con motivo specifico
   */
  const regenerateForPaymentYear = async (paymentYear: number): Promise<{ success: boolean; reason?: string }> => {
    if (!user) return { success: false, reason: "Utente non autenticato" };

    const referenceYear = paymentYear - 1;

    // 1. Fetch fiscal_year_settings per reference_year
    const { data: settings, error: settingsErr } = await supabase
      .from("fiscal_year_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("fiscal_year", referenceYear)
      .single();

    if (settingsErr || !settings) {
      // Story 39-1: No settings for N-1 — check if this is a first-year Art/Comm user
      const { data: settingsN } = await supabase
        .from("fiscal_year_settings")
        .select("inps_management, riduzione_35_attiva, riduzione_50_attiva, anno_apertura_piva")
        .eq("user_id", user.id)
        .eq("fiscal_year", paymentYear)
        .single();

      const detection = detectFirstYearArtComm(settingsN, paymentYear);

      if (detection.isFirstYear === false) {
        console.warn(`[useRegenerateSchedule] No settings for year ${referenceYear}, skipping. ${detection.reason}`);
        return { success: false, reason: detection.reason };
      }

      // First year Art/Comm: fetch fiscal_rules for paymentYear (not referenceYear)
      const { data: fiscalRulesN, error: rulesNErr } = await supabase
        .from("fiscal_rules")
        .select("*")
        .eq("fiscal_year", paymentYear)
        .single();

      if (rulesNErr || !fiscalRulesN) {
        console.warn(`[useRegenerateSchedule] No fiscal_rules for year ${paymentYear}`);
        return {
          success: false,
          reason: `Parametri normativi non disponibili per il ${paymentYear}. Contatta il supporto.`,
        };
      }

      const result = await regenerateFirstYearArtComm(
        paymentYear,
        detection.gestione,
        detection.riduzione35Attiva,
        detection.riduzione50Attiva,
        fiscalRulesN as FiscalRulesParams
      );

      if (!result.success) return result;

      invalidateScheduleQueries();
      console.log(`[useRegenerateSchedule] Generated first-year INPS rates for ${paymentYear} (gestione: ${detection.gestione})`);
      return { success: true };
    }

    // 2. Fetch fiscal_rules per reference_year
    const { data: fiscalRulesData, error: rulesErr } = await supabase
      .from("fiscal_rules")
      .select("*")
      .eq("fiscal_year", referenceYear)
      .single();

    if (rulesErr || !fiscalRulesData) {
      console.warn(`[useRegenerateSchedule] No fiscal_rules for year ${referenceYear}, skipping`);
      return {
        success: false,
        reason: `Parametri normativi INPS mancanti per il ${referenceYear}. Contatta il supporto.`,
      };
    }

    // 3. Fetch receipts per reference_year
    const { data: receipts, error: receiptsErr } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", user.id)
      .eq("fiscal_year", referenceYear);

    if (receiptsErr) {
      console.error(`[useRegenerateSchedule] Error fetching receipts:`, receiptsErr);
      return { success: false, reason: "Errore nel caricamento degli incassi." };
    }

    // 4. Common data
    const receiptsSum = (receipts || []).reduce(
      (sum, r) => sumMoney(sum, sanitizeMoney(r.gross_amount)),
      0
    );
    const profitCoeff = sanitizeMoney(settings.profit_coefficient);
    const taxRate = sanitizeMoney(settings.tax_rate);
    const inpsRate = sanitizeMoney(settings.inps_rate);
    // Fix F5: distinguere una gestione ESPLICITA dal default. Il reference_year
    // ha SEMPRE una riga (early-return sopra se mancante), quindi un "separata"
    // qui è una scelta deliberata dell'utente, non un default da indovinare.
    const explicitGestione = (settings.inps_management as GestioneINPS) || null;
    let gestione: GestioneINPS = explicitGestione || "separata";
    let riduzione35Attiva = settings.riduzione_35_attiva === true;
    let riduzione50Attiva = settings.riduzione_50_attiva === true;

    // Story 20-1 + Fix F5: fallback cross-anno SOLO se la gestione del reference_year
    // è ASSENTE (null/""). Un "separata" esplicito NON va mai sovrascritto: farlo
    // misclassificava gli utenti realmente in Gestione Separata che avevano un altro
    // anno in Art/Comm (cambio gestione tra annualità → scadenze trimestrali fantasma).
    if (!explicitGestione) {
      const { data: fallbackSettings, error: fallbackErr } = await supabase
        .from("fiscal_year_settings")
        .select("inps_management, riduzione_35_attiva, riduzione_50_attiva, fiscal_year")
        .eq("user_id", user.id)
        .neq("inps_management", "separata")
        .order("fiscal_year", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackErr) {
        console.warn(`[useRegenerateSchedule] Story 20-1 fallback query failed: ${fallbackErr.message}, proceeding with gestione="${gestione}"`);
      }

      if (fallbackSettings?.inps_management) {
        console.warn(`[useRegenerateSchedule] Story 20-1 fallback gestione from year ${fallbackSettings.fiscal_year}: ${fallbackSettings.inps_management}`);
        gestione = fallbackSettings.inps_management as GestioneINPS;
        riduzione35Attiva = fallbackSettings.riduzione_35_attiva === true;
        riduzione50Attiva = fallbackSettings.riduzione_50_attiva === true;
      }
    }

    // 5. Delegate to gestione-specific path
    let result: { success: boolean; reason?: string };

    if (gestione === "separata") {
      result = await regenerateSeparata(
        paymentYear, referenceYear, receiptsSum,
        profitCoeff, taxRate, inpsRate, fiscalRulesData as FiscalRulesParams
      );
    } else {
      result = await regenerateArtComm(
        paymentYear, referenceYear, receiptsSum,
        profitCoeff, taxRate, gestione, riduzione35Attiva,
        riduzione50Attiva, fiscalRulesData as FiscalRulesParams
      );
    }

    if (!result.success) return result;

    // 6. Invalidate relevant queries
    invalidateScheduleQueries();

    console.log(`[useRegenerateSchedule] Regenerated schedule for payment year ${paymentYear} (gestione: ${gestione})`);
    return { success: true };
  };

  return { regenerateForPaymentYear };
}
