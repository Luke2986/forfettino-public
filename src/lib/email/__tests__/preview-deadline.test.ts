import { describe, it, expect } from "vitest";
import {
  buildPreviews,
  previewDaysUntil,
  PREVIEW_SCENARIOS,
  SCADENZA_PROROGA_2026,
} from "../../../../supabase/functions/_shared/email-templates/preview-deadline.ts";
import {
  formatDateIT,
  formatEuro,
  daysPhrase,
} from "../../../../supabase/functions/_shared/email-templates/deadline-reminder.ts";
import { getDifferimentoForfettario } from "@/lib/fiscal-engine";

// Garantisce che gli ESEMPI di anteprima siano FISCALMENTE corretti e numericamente
// coerenti: la data riflette la proroga reale 2026 (motore), e data ↔ giorni ↔ importo
// sono coerenti per costruzione. Se la mappa proroga cambia o qualcuno tocca una data
// senza il resto, questo test rompe (l'esempio mostrato deve essere perfetto).

describe("preview-deadline — data reale proroga 2026", () => {
  it("la scadenza usata è esattamente quella del motore (FORFETTARIO_PROROGA 2026)", () => {
    const proroga = getDifferimentoForfettario(2026);
    // Il motore applica la proroga: saldo + 1° acconto 2026 → 20 luglio 2026 (no maggiorazione).
    expect(proroga?.termine).toBe("2026-07-20");
    expect(SCADENZA_PROROGA_2026).toBe(proroga?.termine);
  });

  it("ogni scenario punta alla scadenza prorogata (NON al 30/06)", () => {
    PREVIEW_SCENARIOS.forEach((s) => {
      expect(s.input.dueDateISO).toBe("2026-07-20");
      expect(s.input.dueDateISO).not.toBe("2026-06-30");
    });
  });
});

describe("preview-deadline — coerenza data/giorni/importo", () => {
  const previews = buildPreviews();

  it("daysUntil di ogni scenario = gap reale fra giorno di invio e scadenza", () => {
    previews.forEach((p, i) => {
      const { sentOnISO, input } = PREVIEW_SCENARIOS[i];
      expect(p.daysUntil).toBe(previewDaysUntil(sentOnISO, input.dueDateISO));
    });
  });

  it("la frase giorni renderizzata corrisponde al daysUntil derivato (no incoerenze)", () => {
    previews.forEach((p, i) => {
      const { input } = PREVIEW_SCENARIOS[i];
      const phrase = daysPhrase(p.daysUntil);
      const dateIT = formatDateIT(input.dueDateISO);
      const amount = formatEuro(input.amountEuro);
      for (const out of [p.html, p.text]) {
        expect(out).toContain(dateIT); // la data scadenza corretta
        expect(out).toContain(amount); // l'importo corretto
        if (p.daysUntil === 0) {
          expect(out).toContain("oggi");
        } else {
          expect(out).toContain(phrase); // "manca 1 giorno" / "mancano N giorni"
        }
      }
    });
  });

  it("scenario di punta: Saldo Imposta 20 lug 2026 = esattamente 7 giorni, € 1.234,56", () => {
    const flagship = previews.find((p) => p.slug === "saldo-imposta-grande-7gg")!;
    expect(flagship.daysUntil).toBe(7);
    expect(flagship.subject).toBe("Scadenza Saldo Imposta il 20 lug 2026: € 1.234,56");
    expect(flagship.text).toContain("Scade il 20 lug 2026 (mancano 7 giorni).");
  });

  it("copertura AC #7: importo grande + piccolo, saldo imposta + INPS, casi 0/1/>1", () => {
    const slugs = previews.map((p) => p.slug);
    expect(slugs).toContain("saldo-imposta-grande-7gg"); // saldo imposta, importo grande, >1
    expect(slugs).toContain("acconto-inps-piccolo-1gg"); // INPS, importo piccolo, singolare
    expect(slugs).toContain("saldo-inps-oggi"); // INPS, oggi (0)
    const days = previews.map((p) => p.daysUntil).sort((a, b) => a - b);
    expect(days).toEqual([0, 1, 7]);
  });
});
