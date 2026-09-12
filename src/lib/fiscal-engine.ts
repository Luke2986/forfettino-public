/**
 * fiscal-engine.ts — Funzioni Pure del Motore Fiscale
 * Story 1.2 — Gestione Separata
 * Story 1.3 — INPS Artigiani con Minimale e Variabile
 * Story 1.4 — INPS Commercianti con Minimale e Variabile + Dispatcher calcINPS
 * Story 1.5 — Deducibilità INPS e Calcolo Imposta Sostitutiva Multi-Gestione
 * Story 1.6 — Generazione Schedule Events Tipizzati per Tutte le Gestioni
 * Story 1.7 — Pipeline Componibile Completo con Ricalcolo e Spendibile
 * Story 1.8 — Logica Acconti Cross-Anno e Primo Anno di Attività
 *
 * Tutte le funzioni sono pure: nessuna dipendenza React/Supabase.
 * I parametri INPS vengono passati come FiscalRulesParams (da fiscal_rules table).
 * I calcoli monetari usano le utility di money.ts (centesimi-based).
 */

import { multiplyByPercent, sumMoney, splitWithRemainder, subtractMoney, split50_50, calculateTaxAdvances, calculateInpsAdvances, sanitizeMoney } from "./money";
import type { Database } from "@/integrations/supabase/types";

type FiscalRulesRow = Database["public"]["Tables"]["fiscal_rules"]["Row"];
type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];
type ToolSubscriptionRow = Database["public"]["Tables"]["tool_subscriptions"]["Row"];

// Parametri necessari per i calcoli — subset tipizzato di fiscal_rules Row
export type FiscalRulesParams = Pick<
  FiscalRulesRow,
  // Separata (Story 1.2)
  | "fiscal_year"
  | "inps_rate_separata"
  | "massimale_separata"
  | "aliquota_sostitutiva_5"
  | "aliquota_sostitutiva_15"
  // Artigiani (Story 1.3)
  | "inps_rate_artigiani"
  | "inps_rate_artigiani_alta"
  | "minimale_artigiani"
  | "massimale_artigiani"
  | "reddito_minimale"
  | "soglia_reddito_prima_fascia"
  | "maternita_annuale"
  // Commercianti (Story 1.4)
  | "inps_rate_commercianti"
  | "inps_rate_commercianti_alta"
  | "minimale_commercianti"
  | "massimale_commercianti"
>;

/**
 * Calcola il reddito imponibile forfettario
 * imponibile = ricaviLordi × coefficienteRedditivita
 */
export function calcImponibile(
  ricaviLordi: number,
  coefficienteRedditivita: number // es. 78 per 78%
): number {
  return multiplyByPercent(ricaviLordi, coefficienteRedditivita);
}

/**
 * Calcola l'imposta sostitutiva
 * imposta = imponibile × aliquotaSostitutiva
 */
export function calcImpostaSostitutiva(
  ricaviLordi: number,
  coefficienteRedditivita: number, // es. 78 per 78%
  aliquotaSostitutiva: number // es. 15 per 15%
): number {
  const imponibile = calcImponibile(ricaviLordi, coefficienteRedditivita);
  return multiplyByPercent(imponibile, aliquotaSostitutiva);
}

/**
 * Calcola il contributo INPS Gestione Separata
 * inps = min(imponibile, massimale) × aliquotaINPS
 * La Separata NON ha minimale — si paga solo se si guadagna
 * Il massimale limita l'imponibile su cui si calcolano i contributi
 */
export function calcINPSSeparata(
  imponibile: number,
  aliquotaINPS: number, // es. 26.07 per 26.07%
  massimale?: number // es. 122295.00 — se omesso, nessun cap
): number {
  const base = massimale != null && massimale > 0
    ? Math.min(imponibile, massimale)
    : imponibile;
  return multiplyByPercent(base, aliquotaINPS);
}

/**
 * Pipeline completa per Gestione Separata
 * Compone: imponibile → imposta + INPS → totale accantonamento
 */
export function calcTotaleSeparata(
  ricaviLordi: number,
  coefficienteRedditivita: number,
  params: FiscalRulesParams,
  aliquotaSostitutiva: 5 | 15 // scelta utente
): {
  imponibile: number;
  imposta: number;
  inps: number;
  totaleAccantonamento: number;
} {
  const aliquota =
    aliquotaSostitutiva === 5
      ? params.aliquota_sostitutiva_5
      : params.aliquota_sostitutiva_15;

  const imponibile = calcImponibile(ricaviLordi, coefficienteRedditivita);
  const imposta = calcImpostaSostitutiva(
    ricaviLordi,
    coefficienteRedditivita,
    aliquota
  );
  const inps = calcINPSSeparata(imponibile, params.inps_rate_separata, params.massimale_separata);
  const totaleAccantonamento = sumMoney(imposta, inps);

  return { imponibile, imposta, inps, totaleAccantonamento };
}

// ========== Story 1.3 — INPS Artigiani ==========

/** Risultato calcolo INPS Artigiani */
export interface INPSArtigianiResult {
  minimaleAnnuo: number;
  rateFisse: number[];
  variabile: number;
  totale: number;
  riduzione35Applicata: boolean;
  riduzione50Applicata: boolean;
}

/**
 * Calcola il minimale annuo Artigiani
 * Il minimale è dovuto per intero indipendentemente dal fatturato.
 * Include già la maternità (nel campo minimale_artigiani del DB).
 * Se riduzione50 attiva (Circolare INPS 83/2025): 50% solo su IVS, maternità intatta.
 * Se riduzione35 attiva, si applica il 65% (100 - 35).
 * Mutual exclusivity: riduzione50 prevale su riduzione35.
 */
export function calcMinimaleArtigiani(
  params: FiscalRulesParams,
  riduzione35Attiva: boolean,
  riduzione50Attiva: boolean = false
): number {
  if (riduzione50Attiva) {
    // 50% solo su IVS, maternità intatta (Circolare INPS 83/2025)
    const minimaleIVS = subtractMoney(params.minimale_artigiani, params.maternita_annuale);
    return sumMoney(multiplyByPercent(minimaleIVS, 50), params.maternita_annuale);
  }
  if (riduzione35Attiva) {
    return multiplyByPercent(params.minimale_artigiani, 65);
  }
  return params.minimale_artigiani;
}

/**
 * Divide il minimale annuo in 4 rate trimestrali
 * con invariante somma rate = minimale
 */
export function calcRateFisseArtigiani(minimaleAnnuo: number): number[] {
  return splitWithRemainder(minimaleAnnuo, [25, 25, 25, 25]);
}

/**
 * Calcola i contributi variabili Artigiani sull'eccedenza oltre il reddito minimale.
 * Il massimale limita l'imponibile su cui si calcolano i contributi.
 * Doppia fascia: aliquota base fino a soglia_reddito_prima_fascia,
 * aliquota alta oltre la soglia.
 * Se riduzione35 attiva, il variabile totale è ridotto del 35%.
 */
export function calcVariabileArtigiani(
  imponibile: number,
  params: FiscalRulesParams,
  riduzione35Attiva: boolean,
  riduzione50Attiva: boolean = false
): number {
  // Applica il massimale: l'imponibile non può superare il tetto
  const base = params.massimale_artigiani > 0
    ? Math.min(imponibile, params.massimale_artigiani)
    : imponibile;

  const eccedenza = subtractMoney(base, params.reddito_minimale);
  if (eccedenza <= 0) return 0;

  // Fascia 1: da reddito_minimale fino a soglia_reddito_prima_fascia
  const limFascia1 = subtractMoney(params.soglia_reddito_prima_fascia, params.reddito_minimale);
  const fascia1 = Math.min(eccedenza, limFascia1);
  const varFascia1 = multiplyByPercent(fascia1, params.inps_rate_artigiani);

  // Fascia 2: oltre soglia_reddito_prima_fascia (cappata dal massimale)
  const fascia2 = subtractMoney(base, params.soglia_reddito_prima_fascia);
  const varFascia2 = fascia2 > 0 ? multiplyByPercent(fascia2, params.inps_rate_artigiani_alta) : 0;

  const variabile = sumMoney(varFascia1, varFascia2);

  // Mutual exclusivity: riduzione50 prevale su riduzione35
  if (riduzione50Attiva) {
    return multiplyByPercent(variabile, 50);
  }
  if (riduzione35Attiva) {
    return multiplyByPercent(variabile, 65);
  }
  return variabile;
}

/**
 * Pipeline completa INPS Artigiani
 * Compone: minimale (fisso) + variabile (eccedenza) = totale
 */
export function calcINPSArtigiani(
  imponibile: number,
  params: FiscalRulesParams,
  riduzione35Attiva: boolean,
  riduzione50Attiva: boolean = false
): INPSArtigianiResult {
  // Mutual exclusivity: riduzione50 prevale su riduzione35
  const effective35 = riduzione35Attiva && !riduzione50Attiva;
  const minimaleAnnuo = calcMinimaleArtigiani(params, effective35, riduzione50Attiva);
  const rateFisse = calcRateFisseArtigiani(minimaleAnnuo);
  const variabile = calcVariabileArtigiani(imponibile, params, effective35, riduzione50Attiva);
  const totale = sumMoney(minimaleAnnuo, variabile);

  return {
    minimaleAnnuo,
    rateFisse,
    variabile,
    totale,
    riduzione35Applicata: effective35,
    riduzione50Applicata: riduzione50Attiva,
  };
}

// ========== Story 1.4 — INPS Commercianti ==========

/** Risultato calcolo INPS Commercianti */
export interface INPSCommerciantiResult {
  minimaleAnnuo: number;
  rateFisse: number[];
  variabile: number;
  totale: number;
  riduzione35Applicata: boolean;
  riduzione50Applicata: boolean;
}

/**
 * Calcola il minimale annuo Commercianti
 * Il minimale è dovuto per intero indipendentemente dal fatturato.
 * Include già la maternità (nel campo minimale_commercianti del DB).
 * Se riduzione50 attiva (Circolare INPS 83/2025): 50% solo su IVS, maternità intatta.
 * Se riduzione35 attiva, si applica il 65% (100 - 35).
 * Mutual exclusivity: riduzione50 prevale su riduzione35.
 */
export function calcMinimaleCommercianti(
  params: FiscalRulesParams,
  riduzione35Attiva: boolean,
  riduzione50Attiva: boolean = false
): number {
  if (riduzione50Attiva) {
    // 50% solo su IVS, maternità intatta (Circolare INPS 83/2025)
    const minimaleIVS = subtractMoney(params.minimale_commercianti, params.maternita_annuale);
    return sumMoney(multiplyByPercent(minimaleIVS, 50), params.maternita_annuale);
  }
  if (riduzione35Attiva) {
    return multiplyByPercent(params.minimale_commercianti, 65);
  }
  return params.minimale_commercianti;
}

/**
 * Divide il minimale annuo Commercianti in 4 rate trimestrali
 * con invariante somma rate = minimale
 */
export function calcRateFisseCommercianti(minimaleAnnuo: number): number[] {
  return splitWithRemainder(minimaleAnnuo, [25, 25, 25, 25]);
}

/**
 * Calcola i contributi variabili Commercianti sull'eccedenza oltre il reddito minimale.
 * Il massimale limita l'imponibile su cui si calcolano i contributi.
 * Doppia fascia: aliquota base (24.48%) fino a soglia_reddito_prima_fascia,
 * aliquota alta (25.48%) oltre la soglia.
 * Se riduzione35 attiva, il variabile totale è ridotto del 35%.
 */
export function calcVariabileCommercianti(
  imponibile: number,
  params: FiscalRulesParams,
  riduzione35Attiva: boolean,
  riduzione50Attiva: boolean = false
): number {
  // Applica il massimale: l'imponibile non può superare il tetto
  const base = params.massimale_commercianti > 0
    ? Math.min(imponibile, params.massimale_commercianti)
    : imponibile;

  const eccedenza = subtractMoney(base, params.reddito_minimale);
  if (eccedenza <= 0) return 0;

  // Fascia 1: da reddito_minimale fino a soglia_reddito_prima_fascia
  const limFascia1 = subtractMoney(params.soglia_reddito_prima_fascia, params.reddito_minimale);
  const fascia1 = Math.min(eccedenza, limFascia1);
  const varFascia1 = multiplyByPercent(fascia1, params.inps_rate_commercianti);

  // Fascia 2: oltre soglia_reddito_prima_fascia (cappata dal massimale)
  const fascia2 = subtractMoney(base, params.soglia_reddito_prima_fascia);
  const varFascia2 = fascia2 > 0 ? multiplyByPercent(fascia2, params.inps_rate_commercianti_alta) : 0;

  const variabile = sumMoney(varFascia1, varFascia2);

  // Mutual exclusivity: riduzione50 prevale su riduzione35
  if (riduzione50Attiva) {
    return multiplyByPercent(variabile, 50);
  }
  if (riduzione35Attiva) {
    return multiplyByPercent(variabile, 65);
  }
  return variabile;
}

/**
 * Pipeline completa INPS Commercianti
 * Compone: minimale (fisso) + variabile (eccedenza) = totale
 */
export function calcINPSCommercianti(
  imponibile: number,
  params: FiscalRulesParams,
  riduzione35Attiva: boolean,
  riduzione50Attiva: boolean = false
): INPSCommerciantiResult {
  // Mutual exclusivity: riduzione50 prevale su riduzione35
  const effective35 = riduzione35Attiva && !riduzione50Attiva;
  const minimaleAnnuo = calcMinimaleCommercianti(params, effective35, riduzione50Attiva);
  const rateFisse = calcRateFisseCommercianti(minimaleAnnuo);
  const variabile = calcVariabileCommercianti(imponibile, params, effective35, riduzione50Attiva);
  const totale = sumMoney(minimaleAnnuo, variabile);

  return {
    minimaleAnnuo,
    rateFisse,
    variabile,
    totale,
    riduzione35Applicata: effective35,
    riduzione50Applicata: riduzione50Attiva,
  };
}

// ========== Story 1.4 — Dispatcher calcINPS ==========

/** Gestione INPS supportata */
export type GestioneINPS = "separata" | "artigiani" | "commercianti";

/** Risultato unificato del dispatcher calcINPS */
export type INPSResult =
  | { gestione: "separata"; inps: number }
  | { gestione: "artigiani"; result: INPSArtigianiResult }
  | { gestione: "commercianti"; result: INPSCommerciantiResult };

/**
 * Punto d'ingresso unico per il calcolo INPS di tutte le gestioni.
 * Smista su Separata/Artigiani/Commercianti in base al parametro gestione.
 *
 * Per Separata: riduzione35/riduzione50 sono ignorate (non applicabili).
 * Per Artigiani/Commercianti: riduzione35/riduzione50 determinano la riduzione contributiva.
 * Mutual exclusivity: riduzione50 prevale su riduzione35.
 */
export function calcINPS(
  gestione: GestioneINPS,
  imponibile: number,
  params: FiscalRulesParams,
  riduzione35Attiva: boolean = false,
  riduzione50Attiva: boolean = false
): INPSResult {
  switch (gestione) {
    case "separata":
      return {
        gestione: "separata",
        inps: calcINPSSeparata(imponibile, params.inps_rate_separata, params.massimale_separata),
      };
    case "artigiani":
      return {
        gestione: "artigiani",
        result: calcINPSArtigiani(imponibile, params, riduzione35Attiva, riduzione50Attiva),
      };
    case "commercianti":
      return {
        gestione: "commercianti",
        result: calcINPSCommercianti(imponibile, params, riduzione35Attiva, riduzione50Attiva),
      };
    default: {
      const _exhaustive: never = gestione;
      return _exhaustive;
    }
  }
}

// ========== Story 1.5 — Deducibilità INPS e Imposta Sostitutiva Multi-Gestione ==========

/** Risultato calcolo imposta con deducibilità INPS */
export interface ImpostaConDeducibilitaResult {
  imponibileLordo: number;      // ricavi × coefficiente
  contributiDeducibili: number;  // contributi INPS usati come deduzione
  imponibileNetto: number;       // max(0, imponibileLordo - contributiDeducibili)
  imposta: number;               // imponibileNetto × aliquotaSostitutiva
}

/** Risultato pipeline completo multi-gestione con deducibilità */
export interface TotaleMultiGestioneResult {
  imponibileLordo: number;
  contributiINPS: number;         // totale INPS (per qualsiasi gestione)
  imponibileNetto: number;
  imposta: number;
  totaleAccantonamento: number;   // imposta + contributiINPS
  dettaglioINPS: INPSResult;      // risultato dettagliato dal dispatcher calcINPS
}

/**
 * Calcola l'imposta sostitutiva con deducibilità INPS.
 * La base imponibile è ridotta dai contributi INPS deducibili.
 * Se i contributi superano l'imponibile, la base netta è 0 (mai negativa).
 */
export function calcImpostaConDeducibilita(
  ricaviLordi: number,
  coefficienteRedditivita: number,
  contributiINPS: number,
  aliquotaSostitutiva: 5 | 15
): ImpostaConDeducibilitaResult {
  const imponibileLordo = calcImponibile(ricaviLordi, coefficienteRedditivita);
  const differenza = subtractMoney(imponibileLordo, contributiINPS);
  const imponibileNetto = Math.max(0, differenza);
  const imposta = multiplyByPercent(imponibileNetto, aliquotaSostitutiva);

  return {
    imponibileLordo,
    contributiDeducibili: contributiINPS,
    imponibileNetto,
    imposta,
  };
}

/**
 * Estrae il totale INPS dal risultato del dispatcher calcINPS.
 * Per Separata: .inps (number diretto)
 * Per Artigiani/Commercianti: .result.totale
 */
export function estraiTotaleINPS(inpsResult: INPSResult): number {
  switch (inpsResult.gestione) {
    case "separata":
      return inpsResult.inps;
    case "artigiani":
      return inpsResult.result.totale;
    case "commercianti":
      return inpsResult.result.totale;
    default: {
      const _exhaustive: never = inpsResult;
      return _exhaustive;
    }
  }
}

/**
 * Pipeline completo multi-gestione con deducibilità.
 * Compone: imponibile → INPS → deducibilità → imposta → totale.
 * Punto d'ingresso unico per tutte e 3 le gestioni.
 */
export function calcTotaleMultiGestione(
  ricaviLordi: number,
  coefficienteRedditivita: number,
  gestione: GestioneINPS,
  params: FiscalRulesParams,
  aliquotaSostitutiva: 5 | 15,
  riduzione35Attiva: boolean = false,
  riduzione50Attiva: boolean = false
): TotaleMultiGestioneResult {
  const aliquota =
    aliquotaSostitutiva === 5
      ? params.aliquota_sostitutiva_5
      : params.aliquota_sostitutiva_15;

  // 1. Calcola imponibile lordo
  const imponibileLordo = calcImponibile(ricaviLordi, coefficienteRedditivita);

  // 2. Calcola INPS con dispatcher (su imponibile lordo — nessuna circolarità)
  const dettaglioINPS = calcINPS(gestione, imponibileLordo, params, riduzione35Attiva, riduzione50Attiva);
  const contributiINPS = estraiTotaleINPS(dettaglioINPS);

  // 3. Calcola imposta con deducibilità
  const impostoResult = calcImpostaConDeducibilita(
    ricaviLordi,
    coefficienteRedditivita,
    contributiINPS,
    aliquotaSostitutiva
  );

  // 4. Totale accantonamento = imposta + INPS
  const totaleAccantonamento = sumMoney(impostoResult.imposta, contributiINPS);

  return {
    imponibileLordo,
    contributiINPS,
    imponibileNetto: impostoResult.imponibileNetto,
    imposta: impostoResult.imposta,
    totaleAccantonamento,
    dettaglioINPS,
  };
}

// ========== Story 1.6 — Generazione Schedule Events Tipizzati ==========

/** Tipo di scadenza fiscale */
export type ScheduleEventType = "TAX" | "INPS_FISSO" | "INPS_VARIABILE";

/** Stato pagamento di una scadenza */
export type ScheduleEventStatus = "non_pagato" | "pagato";

/** Singolo evento scadenza */
export interface ScheduleEvent {
  tipo: ScheduleEventType;
  importo: number;
  dataScadenza: string; // formato ISO YYYY-MM-DD
  stato: ScheduleEventStatus;
  descrizione: string;
  /**
   * Indice rata strutturato (1-based) per il mapping deterministico verso i
   * bucket DB, indipendente dal testo di `descrizione` o dalla data.
   *   - INPS_FISSO: 1-4 (trimestre Q1-Q4)
   *   - INPS_VARIABILE: 1 (giugno) | 2 (novembre)
   *   - TAX: 1 (giugno/40%) | 2 (novembre/60% o unica rata)
   * Opzionale per retrocompatibilità con eventi costruiti a mano.
   */
  rataIndex?: number;
}

/** Date scadenza fiscali per un anno */
export interface ScadenzeFiscali {
  inpsFissoQ1: string;
  inpsFissoQ2: string;
  inpsVariabile1: string;
  inpsFissoQ3: string;
  inpsFissoQ4: string;
  inpsVariabile2: string;
  taxGiugno: string;
  taxNovembre: string;
}

/**
 * Festività nazionali italiane a data fissa (formato MM-DD).
 * Usate da nextWorkingDay per lo slittamento delle scadenze.
 * Esclusa la Pasquetta (variabile, marzo/aprile): nessuna scadenza fiscale
 * gestita qui cade in quella finestra né vi slitterebbe.
 */
const ITALIAN_FIXED_HOLIDAYS = new Set<string>([
  "01-01", // Capodanno
  "01-06", // Epifania
  "04-25", // Liberazione
  "05-01", // Festa del Lavoro
  "06-02", // Festa della Repubblica
  "08-15", // Ferragosto
  "11-01", // Ognissanti
  "12-08", // Immacolata
  "12-25", // Natale
  "12-26", // Santo Stefano
]);

/** Formatta una Date come ISO YYYY-MM-DD in ora locale (no UTC shift). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fix F4: slittamento algoritmico al primo giorno lavorativo successivo.
 *
 * Se la scadenza cade di sabato, domenica o festività nazionale fissa, viene
 * posticipata al primo giorno feriale utile (art. 7 c.1 lett. h DL 70/2011 per
 * le imposte; prassi analoga INPS per i contributi — proroga al primo giorno
 * lavorativo). Sostituisce gli override per-anno hardcoded: vale per QUALSIASI
 * anno senza manutenzione manuale.
 *
 * @param iso data base in formato YYYY-MM-DD
 * @returns la stessa data o la prima feriale successiva (YYYY-MM-DD)
 */
export function nextWorkingDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Parse in ora locale (mai `new Date("YYYY-MM-DD")` → sarebbe UTC midnight).
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  // Max 10 iterazioni: copre weekend + eventuale ponte festivo consecutivo.
  for (let i = 0; i < 10; i++) {
    const dow = date.getDay(); // 0 = domenica, 6 = sabato
    const mmdd = toLocalISODate(date).slice(5);
    if (dow !== 0 && dow !== 6 && !ITALIAN_FIXED_HOLIDAYS.has(mmdd)) {
      return toLocalISODate(date);
    }
    date.setDate(date.getDate() + 1);
  }
  return toLocalISODate(date);
}

/**
 * Proroga annuale del termine saldo + 1° acconto per i contribuenti in regime
 * forfettario e per i soggetti ISA.
 *
 * NON è strutturale: ogni anno un decreto ad hoc sposta il termine ordinario
 * del 30/06 e fissa un differimento (~30 giorni) con maggiorazione. Date e
 * percentuale provengono DALLA fonte ufficiale dell'anno (principio ZERO
 * approssimazione) — non vanno ricalcolate. Per gli anni non presenti in mappa
 * vale il termine ordinario 30/06, senza differimento agevolato (comportamento
 * storico invariato).
 *
 *   - 2026: termine 20/07, differimento al 20/08 con maggiorazione 0,80%
 *     (decreto-legge maggio 2026; saldo 2025 + 1° acconto 2026). La proroga
 *     spetta ai forfettari e ai soggetti ISA con ricavi/compensi ≤ 5.164.569 €:
 *     l'intera utenza Forfettino vi rientra, quindi qui è applicata sempre.
 *     Esclusi (dipendenti/pensionati senza P.IVA) restano al 30/06: caso non
 *     gestito dall'app.
 */
interface ProrogaForfettario {
  /** Nuovo termine ordinario, senza maggiorazione (formato MM-DD). */
  termine: string;
  /** Termine ultimo del differimento agevolato, con maggiorazione (MM-DD). */
  differimento: string;
  /** Aliquota della maggiorazione sul differimento (0,008 = 0,80%). */
  maggiorazione: number;
}

const FORFETTARIO_PROROGA: Record<number, ProrogaForfettario> = {
  2026: { termine: "07-20", differimento: "08-20", maggiorazione: 0.008 },
};

/**
 * Genera le date delle scadenze fiscali per un anno (ISO YYYY-MM-DD).
 *
 * Date base:
 * - INPS fisse minimali trimestrali: Q1 16/02, Q2 16/05, Q3 20/08 (sospensione
 *   feriale DL 66/2014), Q4 16/11. NON interessate dalla proroga forfettari.
 * - Imposta sostitutiva + INPS variabile (eccedenza minimale): saldo+1°acconto
 *   30/06, 2°acconto 30/11 — termini IRPEF (DL 73/2022) — Fix F3.
 *
 * Proroga forfettari/ISA: per gli anni presenti in FORFETTARIO_PROROGA il
 * termine di giugno (saldo + 1° acconto → `inpsVariabile1` e `taxGiugno`) slitta
 * alla data prorogata (es. 2026 → 20/07). Il 2° acconto di novembre e le rate
 * INPS fisse NON sono interessati.
 *
 * Ogni data è poi normalizzata con nextWorkingDay (Fix F4): se cade di
 * sabato/domenica/festivo slitta al primo giorno lavorativo, per ogni anno.
 */
export function getScadenzeFiscali(annoFiscale: number): ScadenzeFiscali {
  const anno = String(annoFiscale);
  // Proroga forfettari/ISA: override del termine ordinario 30/06 quando l'anno
  // è coperto da un decreto di proroga (vedi FORFETTARIO_PROROGA).
  const termineGiugno = FORFETTARIO_PROROGA[annoFiscale]?.termine ?? "06-30";
  return {
    inpsFissoQ1: nextWorkingDay(`${anno}-02-16`),
    inpsFissoQ2: nextWorkingDay(`${anno}-05-16`),
    inpsVariabile1: nextWorkingDay(`${anno}-${termineGiugno}`),
    inpsFissoQ3: nextWorkingDay(`${anno}-08-20`),
    inpsFissoQ4: nextWorkingDay(`${anno}-11-16`),
    inpsVariabile2: nextWorkingDay(`${anno}-11-30`),
    taxGiugno: nextWorkingDay(`${anno}-${termineGiugno}`),
    taxNovembre: nextWorkingDay(`${anno}-11-30`),
  };
}

/** Finestra di differimento agevolato (forfettari/ISA) per un anno con proroga. */
export interface DifferimentoForfettario {
  /** Termine prorogato, senza maggiorazione (ISO YYYY-MM-DD). */
  termine: string;
  /** Termine ultimo del differimento, con maggiorazione (ISO YYYY-MM-DD). */
  termineDifferito: string;
  /** Aliquota maggiorazione (0,008 = 0,80%). */
  maggiorazione: number;
}

/**
 * Restituisce la finestra di differimento agevolato per i forfettari/ISA, o
 * `null` per gli anni privi di proroga nota. Le date provengono dal decreto
 * dell'anno (FORFETTARIO_PROROGA), normalizzate al primo giorno lavorativo.
 */
export function getDifferimentoForfettario(annoFiscale: number): DifferimentoForfettario | null {
  const proroga = FORFETTARIO_PROROGA[annoFiscale];
  if (!proroga) return null;
  const anno = String(annoFiscale);
  return {
    termine: nextWorkingDay(`${anno}-${proroga.termine}`),
    termineDifferito: nextWorkingDay(`${anno}-${proroga.differimento}`),
    maggiorazione: proroga.maggiorazione,
  };
}

/**
 * Importo da versare applicando la maggiorazione del differimento, arrotondato
 * ai centesimi. Es. applyMaggiorazioneDifferimento(1000, 0.008) → 1008.
 */
export function applyMaggiorazioneDifferimento(importo: number, maggiorazione: number): number {
  return Math.round(importo * (1 + maggiorazione) * 100) / 100;
}

// ── Finestre di versamento del saldo + 1° acconto (rata `june`) ──────────────
//
// La proroga forfettari/ISA spacchetta il vecchio termine unico 30/06 in più
// finestre con conseguenze fiscali diverse. Servono al "Segna come pagata" per
// applicare la maggiorazione corretta e tracciare quale finestra usa l'utente.

/**
 * Finestra di versamento per il saldo + 1° acconto negli anni con proroga:
 *  - `ordinary`     entro il termine ordinario (30/06) — nessuna maggiorazione
 *  - `proroga`      dal 1/07 al termine prorogato (es. 20/07) — nessuna maggiorazione
 *  - `differimento` nei 30 gg successivi (es. 21/07–20/08) — +0,80% di maggiorazione
 *  - `late`         oltre il differimento — ravvedimento (sanzioni/interessi variabili)
 */
export type PaymentWindowCode = "ordinary" | "proroga" | "differimento" | "late";

export interface PaymentWindowOption {
  code: PaymentWindowCode;
  /** Label breve per il selettore, es. "Entro il 30 giugno" / "21 luglio – 20 agosto". */
  labelShort: string;
  /** Frase estesa, es. "dal 1 luglio al 20 luglio". */
  labelRange: string;
  /** Aliquota maggiorazione applicata alla finestra (0 oppure 0,008). */
  maggiorazione: number;
  /** Data ISO rappresentativa (default per il ledger), normalizzata a giorno lavorativo. */
  isoDate: string;
}

const MESI_LABEL = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** "30 giugno" da un MM-DD; `offsetDays` sposta di N giorni (es. 30/06 +1 → "1 luglio"). */
function windowDayLabel(anno: string, mmdd: string, offsetDays = 0): string {
  const d = new Date(`${anno}-${mmdd}T00:00:00`);
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return `${d.getDate()} ${MESI_LABEL[d.getMonth()]}`;
}

/** ISO YYYY-MM-DD di (MM-DD + N giorni), local-time. */
function isoPlusDays(anno: string, mmdd: string, days: number): string {
  const d = new Date(`${anno}-${mmdd}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Restituisce le finestre di versamento della rata di giugno per un anno con
 * proroga, o `null` se l'anno non è coperto da un decreto di proroga (in tal
 * caso il chiamante mantiene il flusso classico "segna come pagata"). Le date
 * `isoDate` sono normalizzate al primo giorno lavorativo.
 */
export function getPaymentWindows(annoFiscale: number): PaymentWindowOption[] | null {
  const proroga = FORFETTARIO_PROROGA[annoFiscale];
  if (!proroga) return null;
  const anno = String(annoFiscale);
  const ORD = "06-30"; // termine ordinario IRPEF (strutturale)
  const ordLabel = windowDayLabel(anno, ORD);                  // "30 giugno"
  const prorStart = windowDayLabel(anno, ORD, 1);              // "1 luglio"
  const prorEnd = windowDayLabel(anno, proroga.termine);       // "20 luglio"
  const diffStart = windowDayLabel(anno, proroga.termine, 1);  // "21 luglio"
  const diffEnd = windowDayLabel(anno, proroga.differimento);  // "20 agosto"
  return [
    {
      code: "ordinary",
      labelShort: `Entro il ${ordLabel}`,
      labelRange: `fino al ${ordLabel}`,
      maggiorazione: 0,
      isoDate: nextWorkingDay(`${anno}-${ORD}`),
    },
    {
      code: "proroga",
      labelShort: `${prorStart} – ${prorEnd}`,
      labelRange: `dal ${prorStart} al ${prorEnd}`,
      maggiorazione: 0,
      isoDate: nextWorkingDay(`${anno}-${proroga.termine}`),
    },
    {
      code: "differimento",
      labelShort: `${diffStart} – ${diffEnd}`,
      labelRange: `dal ${diffStart} al ${diffEnd}`,
      maggiorazione: proroga.maggiorazione,
      isoDate: nextWorkingDay(`${anno}-${proroga.differimento}`),
    },
    {
      code: "late",
      labelShort: `Dopo il ${diffEnd}`,
      labelRange: `oltre il ${diffEnd}`,
      maggiorazione: 0,
      isoDate: nextWorkingDay(isoPlusDays(anno, proroga.differimento, 1)),
    },
  ];
}

/**
 * Classifica una data ISO nella finestra di versamento di appartenenza, o
 * `null` se l'anno non ha proroga. I confini sono date calendario del decreto
 * (NON normalizzate a giorno lavorativo): un pagamento il 30/06 è `ordinary`,
 * il 20/07 è `proroga`, il 20/08 è `differimento`, dal 21/08 è `late`.
 */
export function classifyPaymentWindow(
  annoFiscale: number,
  isoDate: string,
): PaymentWindowCode | null {
  const proroga = FORFETTARIO_PROROGA[annoFiscale];
  if (!proroga) return null;
  const anno = String(annoFiscale);
  const v = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`).getTime();
  const ord = new Date(`${anno}-06-30T00:00:00`).getTime();
  const term = new Date(`${anno}-${proroga.termine}T00:00:00`).getTime();
  const diff = new Date(`${anno}-${proroga.differimento}T00:00:00`).getTime();
  if (v <= ord) return "ordinary";
  if (v <= term) return "proroga";
  if (v <= diff) return "differimento";
  return "late";
}

/**
 * Genera schedule events tipizzati per tutte le gestioni.
 *
 * Per Separata: 0-2 eventi TAX (regole acconti storiche da calculateTaxAdvances).
 * Per Artigiani/Commercianti: 4 INPS_FISSO + 0-2 INPS_VARIABILE + 0-2 TAX = fino a 8 eventi.
 *
 * Gli eventi sono ordinati per data crescente.
 *
 * @param _precomputed — risultato già calcolato da calcTotaleMultiGestione (opzionale).
 *   Se passato, evita il doppio calcolo quando chiamato dalla pipeline.
 *   Se omesso, calcola internamente (retrocompatibilità con chiamate dirette).
 */
export function generateScheduleEvents(
  gestione: GestioneINPS,
  ricaviLordi: number,
  coefficienteRedditivita: number,
  params: FiscalRulesParams,
  aliquotaSostitutiva: 5 | 15,
  annoFiscale: number,
  riduzione35Attiva: boolean = false,
  riduzione50Attiva: boolean = false,
  _precomputed?: TotaleMultiGestioneResult
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const scadenze = getScadenzeFiscali(annoFiscale);

  // Usa il risultato precomputed se disponibile, altrimenti calcola
  const totale = _precomputed ?? calcTotaleMultiGestione(
    ricaviLordi,
    coefficienteRedditivita,
    gestione,
    params,
    aliquotaSostitutiva,
    riduzione35Attiva,
    riduzione50Attiva
  );

  // --- TAX events (tutte le gestioni) ---
  const taxAdvances = calculateTaxAdvances(totale.imposta);

  if (taxAdvances.hasTwoPayments) {
    // 2 rate: 40% giugno, 60% novembre
    events.push({
      tipo: "TAX",
      importo: taxAdvances.first,
      dataScadenza: scadenze.taxGiugno,
      stato: "non_pagato",
      descrizione: "Acconto imposta sostitutiva 40%",
      rataIndex: 1,
    });
    events.push({
      tipo: "TAX",
      importo: taxAdvances.second,
      dataScadenza: scadenze.taxNovembre,
      stato: "non_pagato",
      descrizione: "Acconto imposta sostitutiva 60%",
      rataIndex: 2,
    });
  } else if (taxAdvances.single > 0) {
    // 1 rata unica a novembre
    events.push({
      tipo: "TAX",
      importo: taxAdvances.single,
      dataScadenza: scadenze.taxNovembre,
      stato: "non_pagato",
      descrizione: "Acconto imposta sostitutiva unica rata",
      rataIndex: 2,
    });
  }
  // Se imposta ≤ 51.65 → 0 eventi TAX (nessun acconto dovuto)

  // --- INPS events (solo Artigiani/Commercianti) ---
  if (gestione === "artigiani" || gestione === "commercianti") {
    const dettaglio = totale.dettaglioINPS;

    if (dettaglio.gestione === "artigiani" || dettaglio.gestione === "commercianti") {
      const { rateFisse, variabile } = dettaglio.result;

      // 4 rate INPS fisse trimestrali
      const dateINPSFisso = [
        scadenze.inpsFissoQ1,
        scadenze.inpsFissoQ2,
        scadenze.inpsFissoQ3,
        scadenze.inpsFissoQ4,
      ];
      const labelQ = ["Q1", "Q2", "Q3", "Q4"];

      for (let i = 0; i < 4; i++) {
        events.push({
          tipo: "INPS_FISSO",
          importo: rateFisse[i],
          dataScadenza: dateINPSFisso[i],
          stato: "non_pagato",
          descrizione: `Rata INPS fissa ${labelQ[i]}`,
          rataIndex: i + 1,
        });
      }

      // INPS variabile (solo se > 0)
      if (variabile > 0) {
        const { first: var1, second: var2 } = split50_50(variabile);
        events.push({
          tipo: "INPS_VARIABILE",
          importo: var1,
          dataScadenza: scadenze.inpsVariabile1,
          stato: "non_pagato",
          descrizione: "Acconto INPS variabile 1° rata",
          rataIndex: 1,
        });
        events.push({
          tipo: "INPS_VARIABILE",
          importo: var2,
          dataScadenza: scadenze.inpsVariabile2,
          stato: "non_pagato",
          descrizione: "Acconto INPS variabile 2° rata",
          rataIndex: 2,
        });
      }
    }
  }

  // Ordina per data crescente
  events.sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza));

  return events;
}

// ========== Story 1.8 — Logica Acconti Cross-Anno e Primo Anno di Attività ==========

/** Input per il calcolo degli acconti anno successivo (metodo storico) */
export interface AccontiInput {
  ricaviLordiAnnoN: number;           // incassi totali anno corrente
  coefficienteRedditivita: number;     // es. 78
  gestione: GestioneINPS;             // "separata" | "artigiani" | "commercianti"
  paramsAnnoN: FiscalRulesParams;     // parametri normativi anno N (per calcolare imposta e INPS)
  aliquotaSostitutiva: 5 | 15;        // scelta utente
  primoAnno: boolean;                  // true = niente acconti
  riduzione35Attiva?: boolean;         // default false
  riduzione50Attiva?: boolean;         // default false (Circolare INPS 83/2025)
}

/** Risultato calcolo acconti anno successivo */
export interface AccontiResult {
  // Totali
  totaleAccontiImposta: number;        // acconti imposta sostitutiva
  totaleAccontiINPS: number;           // acconti INPS (solo variabile per Art/Comm)
  totaleAcconti: number;               // somma dei due

  // Dettaglio imposta (da calculateTaxAdvances)
  accontoImpostaGiugno: number;        // 40% o 0
  accontoImpostaNovembre: number;      // 60% o single o 0
  impostaHasDueRate: boolean;          // true se split 40/60

  // Dettaglio INPS
  accontoINPSGiugno: number;           // 50% dell'80% (Separata) o 50% variabile (Art/Comm)
  accontoINPSNovembre: number;         // 50% dell'80% (Separata) o 50% variabile (Art/Comm)
}

/** Risultato zero per primo anno di attività */
const ACCONTI_ZERO: AccontiResult = {
  totaleAccontiImposta: 0,
  totaleAccontiINPS: 0,
  totaleAcconti: 0,
  accontoImpostaGiugno: 0,
  accontoImpostaNovembre: 0,
  impostaHasDueRate: false,
  accontoINPSGiugno: 0,
  accontoINPSNovembre: 0,
};

/**
 * Calcola gli acconti dell'anno N+1 basandosi sul reddito dell'anno N (metodo storico).
 *
 * - Primo anno di attività: ZERO acconti
 * - Separata: acconti imposta + acconti INPS (80% del totale INPS, split 50/50)
 * - Art/Comm: acconti imposta + acconti INPS (80% della sola componente VARIABILE, split 50/50)
 *
 * Riusa: calcTotaleMultiGestione (Story 1.5), calculateTaxAdvances e calculateInpsAdvances (money.ts)
 */
export function calcAccontiAnnoSuccessivo(input: AccontiInput): AccontiResult {
  const {
    ricaviLordiAnnoN,
    coefficienteRedditivita,
    gestione,
    paramsAnnoN,
    aliquotaSostitutiva,
    primoAnno,
    riduzione35Attiva = false,
    riduzione50Attiva = false,
  } = input;

  // Primo anno di attività → zero acconti
  if (primoAnno) {
    return { ...ACCONTI_ZERO };
  }

  // Input negativi → zero acconti (difesa contro dati invalidi)
  if (ricaviLordiAnnoN <= 0) {
    return { ...ACCONTI_ZERO };
  }

  // Calcola imposta e INPS anno N con pipeline multi-gestione (Story 1.5)
  const totaleAnnoN = calcTotaleMultiGestione(
    ricaviLordiAnnoN,
    coefficienteRedditivita,
    gestione,
    paramsAnnoN,
    aliquotaSostitutiva,
    riduzione35Attiva,
    riduzione50Attiva
  );

  // Acconti imposta sostitutiva (regole: soglia esenzione, unica rata, split 40/60)
  const taxAdv = calculateTaxAdvances(totaleAnnoN.imposta);

  // Acconti INPS: dipende dalla gestione
  let inpsBasePerAcconti: number;

  switch (gestione) {
    case "separata": {
      // Per Separata: acconti sul totale INPS
      inpsBasePerAcconti = totaleAnnoN.contributiINPS;
      break;
    }
    case "artigiani":
    case "commercianti": {
      // Per Art/Comm: acconti SOLO sulla componente VARIABILE (il fisso = rate trimestrali, NON acconti)
      const dettaglio = totaleAnnoN.dettaglioINPS;
      if (dettaglio.gestione !== "artigiani" && dettaglio.gestione !== "commercianti") {
        throw new Error(`Unexpected INPS result type for ${gestione}`);
      }
      inpsBasePerAcconti = dettaglio.result.variabile;
      break;
    }
    default: {
      const _exhaustive: never = gestione;
      return _exhaustive;
    }
  }

  // Acconti INPS: 80% del totale (o variabile per Art/Comm), split 50/50
  const inpsAdv = calculateInpsAdvances(inpsBasePerAcconti);

  // Componi risultato
  const totaleAccontiImposta = taxAdv.total;
  const totaleAccontiINPS = inpsAdv.total;
  const totaleAcconti = sumMoney(totaleAccontiImposta, totaleAccontiINPS);

  return {
    totaleAccontiImposta,
    totaleAccontiINPS,
    totaleAcconti,
    accontoImpostaGiugno: taxAdv.hasTwoPayments ? taxAdv.first : 0,
    accontoImpostaNovembre: taxAdv.hasTwoPayments ? taxAdv.second : taxAdv.single,
    impostaHasDueRate: taxAdv.hasTwoPayments,
    accontoINPSGiugno: inpsAdv.first,
    accontoINPSNovembre: inpsAdv.second,
  };
}

// ========== Story 1.7 — Pipeline Componibile Completo con Ricalcolo e Spendibile ==========

/**
 * Tipi applicativi della pipeline — NON derivati da DB Row.
 * Sono aggregati calcolati, non corrispettivi di tabelle fiscal_rules.
 * Derivazione da Row via Pick non è applicabile qui (ADR-8: tipi computazionali).
 */

/** Pagamento già effettuato dall'utente (per calcolo daCopertura) */
export interface PagamentoEffettuato {
  tipo: ScheduleEventType;
  dataScadenza: string;
  importoPagato: number;
}

/** Singola voce del breakdown "Come Calcolo" */
export interface BreakdownVoce {
  voce: string;
  importo: number;
  tipo: "entrata" | "uscita";
}

/** Input completo per la pipeline componibile */
export interface PipelineInput {
  ricaviLordi: number;
  coefficienteRedditivita: number;
  gestione: GestioneINPS;
  params: FiscalRulesParams;
  aliquotaSostitutiva: 5 | 15;
  annoFiscale: number;
  riduzione35Attiva?: boolean;
  riduzione50Attiva?: boolean;               // Circolare INPS 83/2025
  pagamentiEffettuati?: PagamentoEffettuato[];
  // Story 1.8: Acconti cross-anno (opzionali — backward compatible)
  // NOTA: paramsAnnoSuccessivo funge da FLAG per attivare il calcolo acconti.
  // Per V1 (metodo storico), gli acconti sono calcolati con i params dell'anno N (params).
  // In V2+ (metodo previsionale) potranno essere usati per calcoli con regole anno N+1.
  paramsAnnoSuccessivo?: FiscalRulesParams;  // se fornito, attiva calcolo acconti
  primoAnno?: boolean;                        // default false — true = niente acconti
}

/** Risultato completo della pipeline: spendibile, daCopertura, breakdown, events */
export interface PipelineResult {
  // Identità
  gestione: GestioneINPS;
  annoFiscale: number;

  // Calcoli core (da calcTotaleMultiGestione)
  imponibileLordo: number;
  contributiINPS: number;
  imponibileNetto: number;
  imposta: number;
  totaleAccantonamento: number;
  dettaglioINPS: INPSResult;

  // Spendibile (per TUTTE le gestioni — mai negativo)
  spendibile: number;

  // Da coprire (solo Art/Comm — per Separata = 0)
  daCopertura: number;

  // Schedule events tipizzati
  scheduleEvents: ScheduleEvent[];

  // Breakdown per voce (per "Come Calcolo" UI)
  breakdown: BreakdownVoce[];

  // Story 1.8: Acconti anno successivo (opzionale — undefined se non calcolato)
  accontiAnnoSuccessivo?: AccontiResult;
}

/**
 * Pipeline componibile completo: compone INPS + imposta + deducibilità + schedule events
 * e produce spendibile, daCopertura, breakdown per voce.
 *
 * Punto d'ingresso finale dell'Epic 1.
 * Riusa calcTotaleMultiGestione (Story 1.5) + generateScheduleEvents (Story 1.6).
 * NON include prudenza/buffer/tool costs (responsabilità hook React, Epic 3).
 */
export function calcPipelineCompleto(input: PipelineInput): PipelineResult {
  const {
    ricaviLordi,
    coefficienteRedditivita,
    gestione,
    params,
    aliquotaSostitutiva,
    annoFiscale,
    riduzione35Attiva = false,
    riduzione50Attiva = false,
    pagamentiEffettuati = [],
    paramsAnnoSuccessivo,
    primoAnno = false,
  } = input;

  // 1. Calcoli core con la pipeline multi-gestione (Story 1.5)
  const totale = calcTotaleMultiGestione(
    ricaviLordi,
    coefficienteRedditivita,
    gestione,
    params,
    aliquotaSostitutiva,
    riduzione35Attiva,
    riduzione50Attiva
  );

  // 2. Genera schedule events tipizzati (Story 1.6)
  //    Passa il risultato precomputed per evitare doppio calcolo di calcTotaleMultiGestione
  const scheduleEvents = generateScheduleEvents(
    gestione,
    ricaviLordi,
    coefficienteRedditivita,
    params,
    aliquotaSostitutiva,
    annoFiscale,
    riduzione35Attiva,
    riduzione50Attiva,
    totale
  );

  // 3. Calcola spendibile = max(0, ricavi - totaleAccantonamento)
  const spendibileRaw = subtractMoney(ricaviLordi, totale.totaleAccantonamento);
  const spendibile = Math.max(0, spendibileRaw);

  // 4. Calcola daCopertura (solo Art/Comm — per Separata = 0)
  let daCopertura = 0;
  if (gestione === "artigiani" || gestione === "commercianti") {
    // Somma tutti gli importi degli schedule events
    const totaleObblighi = sumMoney(...scheduleEvents.map(e => e.importo));

    // Sottrai i pagamenti effettuati (matching per tipo + dataScadenza)
    // Ogni evento può essere matchato al massimo una volta per evitare doppi conteggi.
    // Pagamenti con importo ≤ 0 sono ignorati.
    let totalePagato = 0;
    const matchedEventIndices = new Set<number>();
    for (const pagamento of pagamentiEffettuati) {
      if (pagamento.importoPagato <= 0) continue;
      const eventIndex = scheduleEvents.findIndex(
        (e, i) => !matchedEventIndices.has(i) && e.tipo === pagamento.tipo && e.dataScadenza === pagamento.dataScadenza
      );
      if (eventIndex !== -1) {
        matchedEventIndices.add(eventIndex);
        totalePagato = sumMoney(totalePagato, Math.min(pagamento.importoPagato, scheduleEvents[eventIndex].importo));
      }
    }

    daCopertura = Math.max(0, subtractMoney(totaleObblighi, totalePagato));
  }

  // 5. Genera breakdown per voce
  const breakdown = buildBreakdown(gestione, ricaviLordi, totale);

  // 6. Calcola acconti anno successivo (Story 1.8 — opzionale, backward compatible)
  let accontiAnnoSuccessivo: AccontiResult | undefined;
  if (paramsAnnoSuccessivo) {
    accontiAnnoSuccessivo = calcAccontiAnnoSuccessivo({
      ricaviLordiAnnoN: ricaviLordi,
      coefficienteRedditivita,
      gestione,
      paramsAnnoN: params,
      aliquotaSostitutiva,
      primoAnno,
      riduzione35Attiva,
      riduzione50Attiva,
    });
  }

  return {
    gestione,
    annoFiscale,
    imponibileLordo: totale.imponibileLordo,
    contributiINPS: totale.contributiINPS,
    imponibileNetto: totale.imponibileNetto,
    imposta: totale.imposta,
    totaleAccantonamento: totale.totaleAccantonamento,
    dettaglioINPS: totale.dettaglioINPS,
    spendibile,
    daCopertura,
    scheduleEvents,
    breakdown,
    accontiAnnoSuccessivo,
  };
}

/**
 * Costruisce il breakdown per voce in base alla gestione.
 * Per Separata: 3 voci (ricavi, INPS, imposta)
 * Per Artigiani/Commercianti: 4 voci (ricavi, INPS fisso, INPS variabile, imposta)
 */
function buildBreakdown(
  gestione: GestioneINPS,
  ricaviLordi: number,
  totale: TotaleMultiGestioneResult
): BreakdownVoce[] {
  const breakdown: BreakdownVoce[] = [
    { voce: "Ricavi lordi", importo: ricaviLordi, tipo: "entrata" },
  ];

  switch (gestione) {
    case "separata":
      breakdown.push(
        { voce: "INPS Gestione Separata", importo: totale.contributiINPS, tipo: "uscita" },
        { voce: "Imposta sostitutiva", importo: totale.imposta, tipo: "uscita" },
      );
      break;
    case "artigiani":
    case "commercianti": {
      const dettaglio = totale.dettaglioINPS;
      if (dettaglio.gestione === "artigiani" || dettaglio.gestione === "commercianti") {
        breakdown.push(
          { voce: "INPS fisso (minimale)", importo: dettaglio.result.minimaleAnnuo, tipo: "uscita" },
          { voce: "INPS variabile", importo: dettaglio.result.variabile, tipo: "uscita" },
        );
      }
      breakdown.push(
        { voce: "Imposta sostitutiva", importo: totale.imposta, tipo: "uscita" },
      );
      break;
    }
    default: {
      const _exhaustive: never = gestione;
      return _exhaustive;
    }
  }

  return breakdown;
}

// ============================================================================
// === SPENDIBILE NETTO — Pure Functions (fix tech debt formula incoerente) ===
// ============================================================================
//
// Storia: prima esistevano due formule divergenti per il "Netto Spendibile":
//   - useFiscalCalculations.tsx (Dashboard) — formula completa con daCopireAmount,
//     unpaidCurrentYearTotal, yearlyToolCost
//   - Impostazioni.tsx (preview) — formula semplificata con totalWithholding,
//     dueSoonRemaining, senza yearlyToolCost
//
// Risultato: utente vedeva preview diverso dal valore reale Dashboard dopo save.
// Soluzione: pure functions estratte qui, chiamate da entrambi i call site con
// gli STESSI input. Single source of truth per formula spendibile.
//
// Vedi memoria CLAUDE.md "tech debt Impostazioni netto spendibile".

// ---------------------------------------------------------------------------
// computeBufferAmount — Buffer di sicurezza fiscale
// ---------------------------------------------------------------------------
/**
 * Calcola il buffer di sicurezza in base a `bufferBase`:
 *   - "receipts": % degli incassi YTD (default storico)
 *   - "reserve":  % di totalWithholding (riserva su tasse calcolate)
 *
 * @param bufferBase Selettore base di calcolo
 * @param totalWithholding Imposta + INPS lordi (usato solo se base = "reserve")
 * @param incassiYTD Incassi anno corrente (usato solo se base = "receipts")
 * @param safetyBufferRate Percentuale 0-100 (es. 5 per 5%)
 */
export function computeBufferAmount(
  bufferBase: "receipts" | "reserve",
  totalWithholding: number,
  incassiYTD: number,
  safetyBufferRate: number,
): number {
  const base = bufferBase === "reserve"
    ? sanitizeMoney(totalWithholding)
    : sanitizeMoney(incassiYTD);
  return multiplyByPercent(base, safetyBufferRate);
}

// ---------------------------------------------------------------------------
// computeMonthlyToolCost / computeYearlyToolCost — Costi tool ricorrenti
// ---------------------------------------------------------------------------
type ToolSubLite = Pick<ToolSubscriptionRow, "cost" | "frequency">;

/**
 * Normalizza il costo mensile sommando le sottoscrizioni con frequenze diverse.
 *   - yearly:    cost / 12
 *   - quarterly: cost / 3
 *   - monthly:   cost (default)
 */
export function computeMonthlyToolCost(
  toolSubscriptions: ToolSubLite[] | null | undefined,
): number {
  return (
    toolSubscriptions?.reduce((sum, tool) => {
      const cost = sanitizeMoney(tool.cost);
      if (tool.frequency === "yearly") return sumMoney(sum, cost / 12);
      if (tool.frequency === "quarterly") return sumMoney(sum, cost / 3);
      return sumMoney(sum, cost);
    }, 0) || 0
  );
}

/** Costo tool annuale = monthlyToolCost × 12 (centesimi-safe via multiplyByPercent). */
export function computeYearlyToolCost(monthlyToolCost: number): number {
  return multiplyByPercent(sanitizeMoney(monthlyToolCost), 1200);
}

// ---------------------------------------------------------------------------
// computeUnpaidCurrentYearTotal — Obbligazioni anno corrente non pagate
// ---------------------------------------------------------------------------
type ScheduleLite = Pick<TaxScheduleRow, "status" | "total_expected" | "total_paid">;

/**
 * Somma TUTTE le scadenze non pagate dell'anno (non solo quelle nella finestra
 * "due soon"). Sottrae poi gli acconti già versati dall'utente, perché la
 * tax_schedule memorizza i saldi LORDI.
 *
 * Story 3.7 — superset di dueSoonRemaining (include passate, attuali, future).
 * Fix Story 11.1 — sottrae acconti versati per ottenere il netto reale.
 *
 * @param currentYearSchedules Scadenze con payment_year = currentYear
 * @param accontiImpostaVersati Acconti imposta sostitutiva già versati (cod. 1790+1791)
 * @param accontiInpsVersati Acconti INPS eccedenza già versati
 */
export function computeUnpaidCurrentYearTotal(
  currentYearSchedules: ScheduleLite[] | null | undefined,
  accontiImpostaVersati: number,
  accontiInpsVersati: number,
): number {
  const raw = (currentYearSchedules || [])
    .filter((s) => s.status !== "paid")
    .reduce((sum, s) => {
      const expected = sanitizeMoney(s.total_expected);
      const paid = sanitizeMoney(s.total_paid);
      return sumMoney(sum, subtractMoney(expected, paid));
    }, 0);

  const netto = subtractMoney(
    subtractMoney(raw, sanitizeMoney(accontiImpostaVersati)),
    sanitizeMoney(accontiInpsVersati),
  );
  return Math.max(0, netto);
}

// ---------------------------------------------------------------------------
// computePaidCurrentYearTotal — Tasse anno corrente GIÀ pagate (uscita di cassa)
// ---------------------------------------------------------------------------
/**
 * Somma `total_paid` di TUTTE le scadenze dell'anno corrente (pagate +
 * parzialmente pagate). Rappresenta la cassa realmente uscita verso il fisco.
 *
 * Perché esiste (controintuitivo senza questo termine):
 *   La base spendibile è `saldoInizialeCC + incassiYTD` — incassi LORDI, non il
 *   saldo banca live. Senza questo termine, segnare una rata come pagata fa
 *   SALIRE il netto spendibile (l'accantonamento `unpaidCurrentYearTotal` cala
 *   ma l'uscita di cassa non viene mai sottratta). Sottraendo anche il pagato:
 *     - rata segnata pagata → unpaidCurrentYearTotal −rata (spendibile +rata)
 *     - paidCurrentYearTotal +rata (spendibile −rata)
 *     ⇒ netto 0: il netto spendibile resta INVARIATO al pagamento.
 *   Simmetrico anche per pagamenti parziali (status='partial').
 *
 * NOTA doppio conteggio: `accontiImpostaVersati`/`accontiInpsVersati`
 * (sottratti in computeUnpaidCurrentYearTotal) sono campi `settings`, NON
 * `payments`/`total_paid` — fonti distinte, nessuna sovrapposizione.
 * Edge: se il clamp a 0 di computeUnpaidCurrentYearTotal scatta (acconti
 * sovra-dichiarati) l'invarianza non è esatta al boundary — accettato.
 *
 * @param currentYearSchedules Scadenze con payment_year = currentYear
 */
export function computePaidCurrentYearTotal(
  currentYearSchedules: ScheduleLite[] | null | undefined,
): number {
  const total = (currentYearSchedules || []).reduce(
    (sum, s) => sumMoney(sum, sanitizeMoney(s.total_paid)),
    0,
  );
  return Math.max(0, total);
}

// ---------------------------------------------------------------------------
// computeDaCopireAmount — Importo "da coprire" in funzione della gestione INPS
// ---------------------------------------------------------------------------
export interface DaCopireInput {
  /** Gestione INPS dell'utente */
  inpsManagement: GestioneINPS;
  /**
   * Imposta + INPS lordi. Deprecato come base di calcolo: mantenuto solo per
   * retrocompatibilità di firma. Non più usato dal ramo Separata (F1).
   */
  totalWithholding: number;
  /** Imposta sostitutiva post-deducibilità (tutte le gestioni) */
  impostaConDeducibilita: number;
  /** Solo INPS variabile (esclude minimale già nelle scadenze) — Art/Comm */
  inpsVariabile: number;
  /**
   * INPS totale della gestione (Separata: contributi pieni; Art/Comm: minimale
   * + variabile). Usato dal ramo Separata dove tutto l'INPS è dovuto al saldo.
   */
  inpsTotale: number;
}

/**
 * Story 40-2 + Fix F1: l'imposta sostitutiva è SEMPRE post-deducibilità INPS
 * (art. 1 comma 64 L. 190/2014 — i contributi previdenziali obbligatori sono
 * deducibili dall'imponibile per TUTTE le gestioni, Separata inclusa).
 *
 * - Art/Comm: "da coprire" = imposta(deducibilità) + INPS variabile. Il minimale
 *   NON è incluso qui (già in `unpaidCurrentYearTotal` via scadenze trimestrali).
 * - Separata: "da coprire" = imposta(deducibilità) + INPS totale (tutto al saldo,
 *   nessuna rata fissa trimestrale).
 */
export function computeDaCopireAmount(input: DaCopireInput): number {
  if (input.inpsManagement === "separata") {
    return sumMoney(
      sanitizeMoney(input.impostaConDeducibilita),
      sanitizeMoney(input.inpsTotale),
    );
  }
  return sumMoney(
    sanitizeMoney(input.impostaConDeducibilita),
    sanitizeMoney(input.inpsVariabile),
  );
}

// ---------------------------------------------------------------------------
// computeNetSpendable — Formula finale unificata (Dashboard + Impostazioni)
// ---------------------------------------------------------------------------
export interface NetSpendableInput {
  /** Saldo iniziale conto corrente (Story 19-1) */
  saldoInizialeCC: number;
  /** Incassi YTD anno corrente */
  incassiYTD: number;
  /** "Da coprire" — output di computeDaCopireAmount */
  daCopireAmount: number;
  /** Buffer di sicurezza — output di computeBufferAmount */
  bufferAmount: number;
  /** Costo tool annuale — output di computeYearlyToolCost */
  yearlyToolCost: number;
  /** Obbligazioni anno corrente non pagate — output di computeUnpaidCurrentYearTotal */
  unpaidCurrentYearTotal: number;
  /** Tasse anno corrente già pagate (cassa uscita) — output di computePaidCurrentYearTotal */
  paidCurrentYearTotal: number;
  /** Riserva personale dell'utente (settings.reserve_amount) */
  reserveAmount: number;
}

/**
 * Versione "raw" della formula spendibile — può essere negativa.
 * Esposta a parte per consentire ai consumer di mostrare il valore non-clamped
 * a scopo diagnostico (es. campo `metrics.spendableRaw`) senza duplicare logica.
 */
export function computeNetSpendableRaw(input: NetSpendableInput): number {
  const base = sumMoney(
    sanitizeMoney(input.saldoInizialeCC),
    sanitizeMoney(input.incassiYTD),
  );
  const deductions: number[] = [
    sanitizeMoney(input.daCopireAmount),
    sanitizeMoney(input.bufferAmount),
    sanitizeMoney(input.yearlyToolCost),
    sanitizeMoney(input.unpaidCurrentYearTotal),
    sanitizeMoney(input.paidCurrentYearTotal),
    sanitizeMoney(input.reserveAmount),
  ];
  return deductions.reduce(
    (acc, value) => subtractMoney(acc, value),
    base,
  );
}

/**
 * Calcola il "Netto Spendibile" — single source of truth per Dashboard + preview Impostazioni.
 *
 * Formula:
 *   spendable = max(0,
 *     (saldoInizialeCC + incassiYTD)
 *     − daCopireAmount
 *     − bufferAmount
 *     − yearlyToolCost
 *     − unpaidCurrentYearTotal
 *     − paidCurrentYearTotal
 *     − reserveAmount
 *   )
 *
 * `paidCurrentYearTotal` neutralizza l'aumento spurio del netto spendibile
 * quando una rata viene segnata pagata (vedi computePaidCurrentYearTotal).
 *
 * Tutti gli input sono sanitizzati via `sanitizeMoney` per resilienza a NaN/null.
 * Il risultato è clampato a 0 (mai negativo).
 */
export function computeNetSpendable(input: NetSpendableInput): number {
  return Math.max(0, computeNetSpendableRaw(input));
}

/** Input per computeAccontiNextYearTotal — sottoinsieme di FiscalPeakBreakdown */
export interface AccontiNextYearInput {
  accontoTax1: number;
  accontoTax2: number;
  accontoInps1: number;
  accontoInps2: number;
}

/**
 * Totale degli acconti dell'anno successivo (solo anticipi forward-looking).
 *
 * NON include il saldo dell'anno corrente (saldoTax/saldoInps): quel saldo è
 * già accantonato dentro `computeNetSpendable` tramite `daCopireAmount`.
 * Va usato dal "Netto prudenziale" al posto di `fiscalPeak.yearTotal` per
 * evitare di sottrarre due volte le imposte di competenza dell'anno corrente.
 *
 * accontoTax2 contiene già l'eventuale rata unica imposta (vedi
 * calcAccontiAnnoSuccessivo): NON sommare accontoTaxSingle, sarebbe un doppione.
 */
export function computeAccontiNextYearTotal(input: AccontiNextYearInput): number {
  return sumMoney(
    sanitizeMoney(input.accontoTax1),
    sanitizeMoney(input.accontoTax2),
    sanitizeMoney(input.accontoInps1),
    sanitizeMoney(input.accontoInps2),
  );
}
