/**
 * discrepancy.ts - Tassonomia dei motivi di scostamento + snapshot params engine.
 *
 * Quando il pagato reale esce dalla banda verde (vedi tolerance.ts) chiediamo
 * all'utente il motivo. IMPORTANT: non puo' diagnosticare il nostro engine — sa
 * solo di aver pagato un importo diverso. Quindi i chip sono in lingua-utente
 * (cause di REALTA' che conosce) e l'errore-motore lo DEDUCIAMO dal residuo:
 * "l'F24/commercialista diceva un altro numero" + "non lo so" = candidati bug.
 *
 * Categoria:
 *  - reality : Forfettino giusto, il mondo e' diverso (compensazioni, ravvedimenti)
 *  - engine  : Forfettino probabilmente sbagliato (da indagare con lo snapshot)
 *  - unknown : da triage manuale
 */

export type DiscrepancyReasonCode =
  | "credito_compensato"
  | "acconto_saldo_diverso"
  | "ravvedimento"
  | "reddito_diverso"
  | "importo_ufficiale_diverso"
  | "non_lo_so"
  | "altro";

export type DiscrepancyCategory = "reality" | "engine" | "unknown";

interface ReasonOption {
  code: DiscrepancyReasonCode;
  label: string;
  category: DiscrepancyCategory;
}

/**
 * Opzioni mostrate come chip nel modal, in ordine di probabilita'.
 * L'ordine mette per prime le cause di realta' (piu' frequenti) e isola in
 * fondo i candidati-bug e il fallback.
 */
export const REASON_OPTIONS: readonly ReasonOption[] = [
  { code: "credito_compensato", label: "Ho compensato un credito", category: "reality" },
  { code: "acconto_saldo_diverso", label: "Acconto/saldo diverso dal previsto", category: "reality" },
  { code: "ravvedimento", label: "Ravvedimento / interessi / sanzioni", category: "reality" },
  { code: "reddito_diverso", label: "Ho aggiornato il reddito", category: "reality" },
  { code: "importo_ufficiale_diverso", label: "L'F24 / il commercialista diceva un altro numero", category: "engine" },
  { code: "non_lo_so", label: "Non lo so", category: "unknown" },
  { code: "altro", label: "Altro motivo", category: "unknown" },
] as const;

const REASON_TO_CATEGORY: Record<DiscrepancyReasonCode, DiscrepancyCategory> =
  REASON_OPTIONS.reduce((acc, o) => {
    acc[o.code] = o.category;
    return acc;
  }, {} as Record<DiscrepancyReasonCode, DiscrepancyCategory>);

/** Deriva la categoria dal reason code. null se nessun motivo (banda verde). */
export function reasonToCategory(
  code: DiscrepancyReasonCode | null | undefined,
): DiscrepancyCategory | null {
  if (!code) return null;
  return REASON_TO_CATEGORY[code] ?? "unknown";
}

/**
 * Versione del motore fiscale al momento dello snapshot. Bumpare a ogni
 * modifica sostanziale di fiscal-engine.ts per poter segmentare i delta per
 * versione (un bug fixato in 2026.2 non deve sporcare l'analisi).
 */
export const FISCAL_ENGINE_VERSION = "2026.1";

/** Shape minima del settings fiscale necessaria allo snapshot. */
interface SettingsLike {
  profit_coefficient?: number | null;
  tax_rate?: number | null;
  inps_rate?: number | null;
  inps_management?: string | null;
  inps_type?: string | null;
  riduzione_35_attiva?: boolean | null;
  riduzione_50_attiva?: boolean | null;
  ateco_code?: string | null;
  anno_apertura_piva?: number | null;
}

/** Shape minima della riga tax_schedule necessaria allo snapshot. */
interface ScheduleLike {
  bucket: string;
  payment_year: number;
  reference_year: number;
  total_expected: number | string;
  tax_balance?: number | string | null;
  tax_advance?: number | string | null;
  inps_balance?: number | string | null;
  inps_advance?: number | string | null;
}

/**
 * Costruisce lo snapshot jsonb degli input che hanno prodotto la stima.
 * Serve a diagnosticare PERCHE' l'engine ha sbagliato: senza gli input,
 * 200 delta sono solo rumore. Calcolato lato TS (single source of truth
 * fiscale), persistito verbatim dalla RPC.
 */
export function buildEngineSnapshot(
  schedule: ScheduleLike,
  settings: SettingsLike | null | undefined,
): Record<string, unknown> {
  return {
    engine_version: FISCAL_ENGINE_VERSION,
    // Input utente (settings)
    profit_coefficient: settings?.profit_coefficient ?? null,
    tax_rate: settings?.tax_rate ?? null,
    inps_rate: settings?.inps_rate ?? null,
    inps_management: settings?.inps_management ?? null,
    inps_type: settings?.inps_type ?? null,
    riduzione_35_attiva: settings?.riduzione_35_attiva ?? null,
    riduzione_50_attiva: settings?.riduzione_50_attiva ?? null,
    ateco_code: settings?.ateco_code ?? null,
    anno_apertura_piva: settings?.anno_apertura_piva ?? null,
    // Output engine per-bucket (la stima contestata)
    bucket: schedule.bucket,
    payment_year: schedule.payment_year,
    reference_year: schedule.reference_year,
    total_expected: Number(schedule.total_expected),
    tax_balance: schedule.tax_balance != null ? Number(schedule.tax_balance) : null,
    tax_advance: schedule.tax_advance != null ? Number(schedule.tax_advance) : null,
    inps_balance: schedule.inps_balance != null ? Number(schedule.inps_balance) : null,
    inps_advance: schedule.inps_advance != null ? Number(schedule.inps_advance) : null,
  };
}
