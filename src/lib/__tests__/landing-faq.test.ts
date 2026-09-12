import { describe, it, expect } from "vitest";
import { landingFaqItems } from "@/lib/landing-faq";

/**
 * Test unit per `landingFaqItems` — Epic 79.3 review follow-up.
 *
 * Garantisce il contratto del modulo single source of truth consumato sia
 * dall'Accordion FAQ in LandingBelowFold sia dal FAQPage JSON-LD in Landing.tsx.
 */

// Ricalcola frasi come fa il validator verify-landing-geo-capsules.mjs
// (normalizza decimali, D.Lgs., art., n., comma, L. per evitare falsi split).
function countSentences(text: string): number {
  let cleaned = text;
  cleaned = cleaned.replace(/\d+[.,]\d+/g, "X");
  cleaned = cleaned.replace(/D\.Lgs\./g, "X");
  cleaned = cleaned.replace(/art\.\s*\d+/gi, "X");
  cleaned = cleaned.replace(/n\.\s*\d+/gi, "X");
  cleaned = cleaned.replace(/comma\s*\d+/gi, "X");
  cleaned = cleaned.replace(/L\.\s*\d+/g, "X");
  const matches = cleaned.match(/[.!?]+/g) || [];
  return matches.length;
}

const FACTUAL_SIGNAL = /\d|%|EUR|INPS|ATECO|forfett|aliquot|Legge|imposta|IRPEF|commercialista|gratis|contribut/i;

describe("landingFaqItems", () => {
  it("ha almeno 11 item (AC Epic 79.3 #5 — baseline, ulteriormente espanso in Epic 79.5+)", () => {
    expect(landingFaqItems.length).toBeGreaterThanOrEqual(11);
  });

  it("ogni item ha question e answer non vuoti", () => {
    landingFaqItems.forEach((item, i) => {
      expect(item.question.trim().length, `item ${i} question`).toBeGreaterThan(0);
      expect(item.answer.trim().length, `item ${i} answer`).toBeGreaterThan(20);
    });
  });

  it("ogni risposta ha al massimo 4 frasi (AC #5)", () => {
    landingFaqItems.forEach((item, i) => {
      const sentences = countSentences(item.answer);
      expect(sentences, `"${item.question}" (${i})`).toBeLessThanOrEqual(4);
    });
  });

  it("ogni risposta contiene almeno un segnale fattuale", () => {
    landingFaqItems.forEach((item, i) => {
      expect(
        FACTUAL_SIGNAL.test(item.answer),
        `"${item.question}" (${i}) senza segnale fattuale`,
      ).toBe(true);
    });
  });

  it("nessuna risposta contiene markup vietato (HTML tags, bold, link)", () => {
    const forbidden = /<[a-z]+|<\/[a-z]+|\*\*|`|https?:\/\//i;
    landingFaqItems.forEach((item, i) => {
      expect(forbidden.test(item.answer), `item ${i} markup vietato`).toBe(false);
    });
  });

  it("nessuna domanda duplicata (drift-proof)", () => {
    const questions = landingFaqItems.map((i) => i.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});
