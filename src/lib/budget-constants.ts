/**
 * Story 42.1 — Allocazione Netto Spendibile
 * Costanti, tipi e default per le 5 categorie di allocazione budget.
 */

/** Chiavi delle 5 categorie (ordine fisso, usato ovunque) */
export const BUDGET_CATEGORIES = [
  "necessita",
  "investimenti",
  "risparmio",
  "formazione",
  "svago",
] as const;

export type BudgetCategoryKey = (typeof BUDGET_CATEGORIES)[number];

/** Configurazione allocazione: mappa categoria → percentuale (0–100) */
export type BudgetAllocation = Record<BudgetCategoryKey, number>;

/** Percentuali default (metodo Eker adattato) */
export const DEFAULT_ALLOCATION: BudgetAllocation = {
  necessita: 60,
  investimenti: 10,
  risparmio: 10,
  formazione: 10,
  svago: 10,
};

/** Nomi italiani per visualizzazione */
export const CATEGORY_LABELS: Record<BudgetCategoryKey, string> = {
  necessita: "Necessità",
  investimenti: "Investimenti",
  risparmio: "Risparmio",
  formazione: "Formazione",
  svago: "Svago",
};

/** Nomi estesi per la lista allocazione */
export const CATEGORY_DISPLAY_LABELS: Record<BudgetCategoryKey, string> = {
  necessita: "Necessità",
  investimenti: "Investimenti — Libertà Finanziaria",
  risparmio: "Risparmi a Lungo Termine",
  formazione: "Formazione/Educazione",
  svago: "Divertimento",
};

/** Descrizioni brevi per ogni categoria */
export const CATEGORY_DESCRIPTIONS: Record<BudgetCategoryKey, string> = {
  necessita: "Spese essenziali come affitto/mutuo, bollette, spesa alimentare, trasporti, ecc.",
  investimenti: "Soldi destinati esclusivamente a creare rendite passive (es. azioni, immobili).",
  risparmio: "Fondo per emergenze o grandi acquisti futuri.",
  formazione: "Per la crescita personale, corsi, libri, seminari, ecc.",
  svago: "Spese per lo svago e il benessere mentale (cene, hobby, ecc.).",
};

/** Colori Tailwind per barra segmentata e dot (da UX spec ANS-2) */
export const CATEGORY_BAR_COLORS: Record<BudgetCategoryKey, string> = {
  necessita: "bg-slate-700",
  investimenti: "bg-blue-500",
  risparmio: "bg-emerald-500",
  formazione: "bg-amber-500",
  svago: "bg-rose-400",
};

/** Colori dot per la lista categorie (stessi della barra) */
export const CATEGORY_DOT_COLORS = CATEGORY_BAR_COLORS;

/** Verifica che un oggetto sia una BudgetAllocation valida */
export function isValidBudgetAllocation(obj: unknown): obj is BudgetAllocation {
  if (!obj || typeof obj !== "object") return false;
  const record = obj as Record<string, unknown>;
  return BUDGET_CATEGORIES.every(
    (key) => typeof record[key] === "number" && record[key] >= 0 && record[key] <= 100
  );
}

/** Somma delle percentuali di una configurazione */
export function allocationTotal(config: BudgetAllocation): number {
  return BUDGET_CATEGORIES.reduce((sum, key) => sum + config[key], 0);
}
