/**
 * preview-deadline.ts — Script di anteprima (Deno) per il template scadenza.
 *
 * Renderizza ≥2 scenari di esempio (importo grande/piccolo, bucket INPS / saldo imposta)
 * usando lo STESSO renderer della EF di invio (84-3) → single source of truth, zero HTML
 * duplicato (anti-pattern epic #6). Scrive HTML + text in `tmp/email-preview/` (gitignored).
 *
 * USO (Deno):
 *   deno run --allow-write --allow-read \
 *     supabase/functions/_shared/email-templates/preview-deadline.ts
 *
 * Poi apri i `.html` su desktop, mobile (responsive) e un client/preview "dark" (AC #7).
 *
 * DATE REALI (importante): gli scenari sono ancorati alla scadenza REALE forfettari 2026 =
 * **20 luglio 2026** (PROROGA del saldo + 1° acconto, vedi `FORFETTARIO_PROROGA` in
 * `src/lib/fiscal-engine.ts`: 2026 → termine 20/07, differimento 20/08 +0,80%). NON 30/06.
 * In produzione la data la passa 84-3 leggendo `tax_schedule.due_date` (già prorogata dal
 * motore) — qui la replichiamo per avere un esempio fiscalmente corretto.
 *
 * COERENZA DEI NUMERI: `daysUntil` NON è hardcodato. Viene DERIVATO da `dueDateISO` rispetto
 * al giorno di invio `sentOnISO` con diff timezone-safe (stessa logica della produzione).
 * Così data, importo e "giorni mancanti" sono coerenti per costruzione.
 *
 * NOTA: la logica I/O Deno è isolata dietro `import.meta.main`, così le funzioni pure
 * (`PREVIEW_SCENARIOS`, `buildPreviews`, `previewDaysUntil`) restano importabili da Node
 * (test Vitest / generazione file). Nessuna chiamata `Deno.*` a top-level.
 */

import {
  renderDeadlineReminderEmail,
  type DeadlineEmailInput,
  type RenderedEmail,
} from "./deadline-reminder.ts";

/** Scadenza reale forfettari 2026 dopo proroga (D.L. 86/2026). Vedi FORFETTARIO_PROROGA. */
export const SCADENZA_PROROGA_2026 = "2026-07-20";

/**
 * Giorni tra due date "YYYY-MM-DD" (date-only, timezone-safe).
 * Replica la logica di `daysUntilFromDate` (src/lib/deadline-notifications.ts):
 * append T00:00:00 per parse local-time, diff arrotondata. 0 = oggi, >0 = futuro.
 */
export function previewDaysUntil(fromISO: string, dueISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const due = new Date(`${dueISO}T00:00:00`);
  return Math.round((due.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

const SHARED_URLS = {
  ctaUrl:
    "https://forfettino.it/scadenziario?utm_source=email&utm_medium=transactional&utm_campaign=scadenza_saldo_tax_7",
  manageUrl: "https://forfettino.it/impostazioni",
  unsubscribeUrl:
    "https://forfettino.it/functions/v1/unsubscribe-scadenze?token=PREVIEW_TOKEN",
  privacyUrl: "https://forfettino.it/privacy-policy",
};

/** Input scenario SENZA `daysUntil` (derivato) + `sentOnISO` = giorno di invio del reminder. */
type PreviewScenario = {
  slug: string;
  sentOnISO: string;
  input: Omit<DeadlineEmailInput, "daysUntil">;
};

// Tutti e 3 gli scenari puntano alla STESSA scadenza reale (20 lug 2026), mostrata alle
// diverse soglie di reminder (T-7 / T-1 / T-0). Saldo + acconti forfettari 2026 cadono insieme.
export const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    // Importo grande + saldo imposta + reminder a 7 giorni.
    slug: "saldo-imposta-grande-7gg",
    sentOnISO: "2026-07-13",
    input: {
      recipientName: "Marco",
      bucketLabel: "Saldo Imposta",
      amountEuro: 1234.56,
      dueDateISO: SCADENZA_PROROGA_2026,
      ...SHARED_URLS,
    },
  },
  {
    // Importo piccolo + bucket INPS (acconto variabile, anch'esso prorogato) + reminder a 1 giorno.
    slug: "acconto-inps-piccolo-1gg",
    sentOnISO: "2026-07-19",
    input: {
      bucketLabel: "I° Acconto INPS",
      amountEuro: 87.5,
      dueDateISO: SCADENZA_PROROGA_2026,
      ...SHARED_URLS,
    },
  },
  {
    // Caso "scade oggi" (reminder del giorno stesso) + bucket INPS variabile.
    slug: "saldo-inps-oggi",
    sentOnISO: SCADENZA_PROROGA_2026,
    input: {
      recipientName: "Giulia",
      bucketLabel: "Saldo INPS",
      amountEuro: 642.0,
      dueDateISO: SCADENZA_PROROGA_2026,
      ...SHARED_URLS,
    },
  },
];

export interface PreviewResult extends RenderedEmail {
  slug: string;
  /** `daysUntil` derivato — esposto per i test di coerenza. */
  daysUntil: number;
}

/**
 * Renderizza tutti gli scenari di anteprima. Funzione pura, runtime-agnostica.
 * `daysUntil` è SEMPRE derivato da `dueDateISO` vs `sentOnISO` → esempi coerenti.
 */
export function buildPreviews(): PreviewResult[] {
  return PREVIEW_SCENARIOS.map((s) => {
    const daysUntil = previewDaysUntil(s.sentOnISO, s.input.dueDateISO);
    return {
      slug: s.slug,
      daysUntil,
      ...renderDeadlineReminderEmail({ ...s.input, daysUntil }),
    };
  });
}

// ── Entry point Deno (eseguito solo con `deno run ...`) ───────────────────────
// @ts-ignore: `import.meta.main` e `Deno` esistono solo nel runtime Deno.
if (import.meta.main) {
  const outDir = "tmp/email-preview";
  // @ts-ignore: Deno global
  await Deno.mkdir(outDir, { recursive: true });
  for (const p of buildPreviews()) {
    // @ts-ignore: Deno global
    await Deno.writeTextFile(`${outDir}/${p.slug}.html`, p.html);
    // @ts-ignore: Deno global
    await Deno.writeTextFile(`${outDir}/${p.slug}.txt`, p.text);
    console.log(`✓ ${p.slug} (${p.daysUntil}gg) — subject: ${p.subject}`);
  }
  console.log(`\nAnteprime scritte in ${outDir}/ — aprire i .html su desktop + mobile + dark.`);
}
