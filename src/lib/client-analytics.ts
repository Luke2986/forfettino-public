/**
 * Client Analytics — funzioni pure per analytics fatturato per cliente.
 * Zero dipendenze React/Supabase — testabile in isolamento.
 */

export interface ClientRevenue {
  clientId: string | null;
  clientName: string;
  totalGross: number;
  totalNet: number;
  receiptCount: number;
  firstReceiptDate: string;
  lastReceiptDate: string;
  percentage: number;
}

export type ConcentrationLevel =
  | "diversificato"
  | "moderato"
  | "concentrato"
  | "molto_concentrato";

/**
 * Herfindahl-Hirschman Index — somma dei quadrati delle quote % di fatturato.
 * Range: 0 (perfetta diversificazione) – 10000 (monopolio).
 * Accetta qualsiasi array con campo `percentage` (clienti, servizi, ecc.).
 */
export function calculateHHI(items: readonly { percentage: number }[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, c) => sum + c.percentage * c.percentage, 0);
}

/**
 * Classifica il livello di concentrazione in base all'HHI.
 */
export function classifyConcentration(hhi: number): ConcentrationLevel {
  if (hhi < 1500) return "diversificato";
  if (hhi < 2500) return "moderato";
  if (hhi < 4500) return "concentrato";
  return "molto_concentrato";
}

/**
 * Identifica clienti senza incassi da almeno `thresholdMonths` mesi.
 */
export function identifyDormantClients(
  clients: ClientRevenue[],
  thresholdMonths: number,
): ClientRevenue[] {
  if (clients.length === 0) return [];

  const now = new Date();
  // Ultimo giorno del mese target per evitare overflow (es. 31 mar - 1 mese = 28 feb, non 3 mar)
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth() - thresholdMonths;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(now.getDate(), lastDayOfTargetMonth);
  const cutoff = new Date(targetYear, targetMonth, clampedDay);

  return clients.filter((c) => {
    const lastDate = new Date(c.lastReceiptDate + "T00:00:00");
    return lastDate < cutoff;
  });
}
