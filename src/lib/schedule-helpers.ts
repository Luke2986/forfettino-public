import { differenceInDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

// ── Tipi ──

export type RataType = "INPS_FISSO" | "INPS_VARIABILE" | "TAX" | "MISTA";

export type ScheduleDisplayStatus = "pagata" | "da_pagare" | "imminente" | "scaduta";

export interface BreakdownItem {
  label: string;
  value: number;
}

// ── Bucket → Label mapping (consolidato da UpcomingDeadlines + UnpaidSchedulesSummary) ──

const BUCKET_LABELS: Record<string, string> = {
  june: "Rata Giugno",
  november: "Rata Novembre",
  inps_q1: "Rata INPS Q1 (Feb)",
  inps_q2: "Rata INPS Q2 (Mag)",
  inps_q3: "Rata INPS Q3 (Ago)",
  inps_q4: "Rata INPS Q4 (Nov)",
  saldo_tax: "Saldo Imposta",
  saldo_inps: "Saldo INPS",
  acconto_tax_1: "I° Acconto Imposta",
  acconto_tax_2: "II° Acconto Imposta",
  acconto_inps_1: "I° Acconto INPS",
  acconto_inps_2: "II° Acconto INPS",
};

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Bucket il cui label segue il MESE della scadenza reale (saldo + acconto annuale).
// Normalmente giugno/novembre, ma le proroghe per-anno spostano la data (es. 2026:
// rata "june" prorogata al 20/07 → label "Rata Luglio"). Senza dueDate resta il
// fallback statico (BUCKET_LABELS) per backward-compat.
const MONTH_DERIVED_BUCKETS = new Set(["june", "november"]);

export function bucketToLabel(bucket: string, dueDate?: string | null): string {
  if (dueDate && MONTH_DERIVED_BUCKETS.has(bucket)) {
    // Parse date-only come local time per evitare day-shift UTC (vedi formatDateIT)
    const safe = dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`;
    const month = MONTHS_IT[new Date(safe).getMonth()];
    if (month) return `Rata ${month}`;
  }
  return BUCKET_LABELS[bucket] ?? "Scadenza Fiscale";
}

// ── Bucket → RataType mapping ──

const BUCKET_RATA_TYPE: Record<string, RataType> = {
  inps_q1: "INPS_FISSO",
  inps_q2: "INPS_FISSO",
  inps_q3: "INPS_FISSO",
  inps_q4: "INPS_FISSO",
  june: "MISTA",
  november: "MISTA",
  saldo_tax: "TAX",
  acconto_tax_1: "TAX",
  acconto_tax_2: "TAX",
  saldo_inps: "INPS_VARIABILE",
  acconto_inps_1: "INPS_VARIABILE",
  acconto_inps_2: "INPS_VARIABILE",
};

export function deriveRataType(bucket: string): RataType {
  const rataType = BUCKET_RATA_TYPE[bucket];
  if (!rataType) {
    console.warn(`[deriveRataType] Unknown bucket "${bucket}", defaulting to TAX`);
    return "TAX";
  }
  return rataType;
}

// ── Rata type → Label italiano ──

const RATA_TYPE_LABELS: Record<RataType, string> = {
  INPS_FISSO: "Fissa trimestrale",
  INPS_VARIABILE: "Variabile",
  TAX: "Tasse",
  MISTA: "Mista (INPS + Tasse)",
};

export function rataTypeLabel(type: RataType): string {
  return RATA_TYPE_LABELS[type];
}

// ── Days helpers ──

export function daysUntil(dueDate: string): number {
  // Parse date-only strings as local time to avoid UTC midnight off-by-one
  const safeDueDate = dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`;
  return differenceInDays(new Date(safeDueDate), new Date());
}

export function formatDateIT(dateStr: string): string {
  // Append T00:00:00 to date-only strings to force local-time parsing
  // and avoid UTC midnight → day-shift in positive-offset timezones (e.g. CET/CEST)
  const safeDateStr = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(safeDateStr);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Schedule display status ──

export function getScheduleStatus(schedule: TaxScheduleRow): ScheduleDisplayStatus {
  if (schedule.status === "paid") return "pagata";
  const days = daysUntil(schedule.due_date);
  if (days < 0) return "scaduta";
  if (days <= 30) return "imminente";
  return "da_pagare";
}

// ── Breakdown helpers ──

export function getRataBreakdown(schedule: TaxScheduleRow): BreakdownItem[] {
  const items: BreakdownItem[] = [];
  const rataType = deriveRataType(schedule.bucket);

  if (rataType === "INPS_FISSO") {
    // Rate fisse: minimale + maternita
    if (Number(schedule.inps_balance) > 0) {
      items.push({ label: "Minimale", value: Number(schedule.inps_balance) });
    }
    if (Number(schedule.inps_advance) > 0) {
      items.push({ label: "Maternità", value: Number(schedule.inps_advance) });
    }
  } else if (rataType === "MISTA") {
    // Rate miste (june/november): mostra tutti i componenti > 0
    if (Number(schedule.tax_balance) > 0) {
      items.push({ label: `Saldo Imposta ${schedule.reference_year}`, value: Number(schedule.tax_balance) });
    }
    if (Number(schedule.tax_advance) > 0) {
      items.push({ label: `Acconto Imposta ${schedule.reference_year + 1}`, value: Number(schedule.tax_advance) });
    }
    if (Number(schedule.inps_balance) > 0) {
      items.push({ label: `Saldo INPS ${schedule.reference_year}`, value: Number(schedule.inps_balance) });
    }
    if (Number(schedule.inps_advance) > 0) {
      items.push({ label: `Acconto INPS ${schedule.reference_year + 1}`, value: Number(schedule.inps_advance) });
    }
  } else if (rataType === "TAX") {
    if (Number(schedule.tax_balance) > 0) {
      items.push({ label: "Saldo Imposta", value: Number(schedule.tax_balance) });
    }
    if (Number(schedule.tax_advance) > 0) {
      items.push({ label: "Acconto Imposta", value: Number(schedule.tax_advance) });
    }
  } else {
    // INPS_VARIABILE
    if (Number(schedule.inps_balance) > 0) {
      items.push({ label: "Saldo INPS", value: Number(schedule.inps_balance) });
    }
    if (Number(schedule.inps_advance) > 0) {
      items.push({ label: "Acconto INPS", value: Number(schedule.inps_advance) });
    }
  }

  return items;
}

// ── INPS fixed rate counting ──

const INPS_FIXED_BUCKETS = ["inps_q1", "inps_q2", "inps_q3", "inps_q4"];

export function isInpsFixedBucket(bucket: string): boolean {
  return INPS_FIXED_BUCKETS.includes(bucket);
}

export function countInpsFixedRates(schedules: TaxScheduleRow[]): {
  total: number;
  paid: number;
} {
  const fixed = schedules.filter((s) => isInpsFixedBucket(s.bucket));
  return {
    total: fixed.length,
    paid: fixed.filter((s) => s.status === "paid").length,
  };
}
