import { describe, expect, it } from "vitest";
import { glossarioItems, glossarioSources } from "@/lib/glossario-page";

// Story 79.10 — validate the glossary dataset used by /glossario public page.
// GEO guarantees: capsule length, uniqueness, alphabetical order, definitional
// question form, citability (numeric facts / normative references in every capsule).

describe("glossarioItems (story 79.10)", () => {
  it("has at least 20 items", () => {
    expect(glossarioItems.length).toBeGreaterThanOrEqual(20);
  });

  it("every item has a unique id", () => {
    const ids = glossarioItems.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every term is unique (case-insensitive)", () => {
    const terms = glossarioItems.map((i) => i.term.trim().toLowerCase());
    const unique = new Set(terms);
    expect(unique.size).toBe(terms.length);
  });

  it("items are sorted alphabetically by term (case-insensitive)", () => {
    const sorted = [...glossarioItems].sort((a, b) =>
      a.term.toLowerCase().localeCompare(b.term.toLowerCase(), "it"),
    );
    expect(glossarioItems.map((i) => i.id)).toEqual(sorted.map((i) => i.id));
  });

  it("every question ends with a question mark and contains 'cos'è' or 'cosa'", () => {
    for (const item of glossarioItems) {
      expect(item.question.endsWith("?"), `question "${item.id}" missing ?`).toBe(true);
      const lower = item.question.toLowerCase();
      const hasDefinitional = lower.includes("cos'è") || lower.includes("cosa ");
      expect(
        hasDefinitional,
        `question "${item.id}" is not definitional (missing cos'è / cosa)`,
      ).toBe(true);
    }
  });

  it("every question has at least 5 words", () => {
    for (const item of glossarioItems) {
      const words = item.question.trim().split(/\s+/);
      expect(
        words.length,
        `question "${item.id}" has only ${words.length} words`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it("every answer capsule is between 120 and 160 characters", () => {
    for (const item of glossarioItems) {
      expect(
        item.answerCapsule.length,
        `capsule "${item.id}" has length ${item.answerCapsule.length}`,
      ).toBeGreaterThanOrEqual(120);
      expect(
        item.answerCapsule.length,
        `capsule "${item.id}" has length ${item.answerCapsule.length}`,
      ).toBeLessThanOrEqual(160);
    }
  });

  it("no capsule contains link markers or 'vedi sotto' hints", () => {
    const forbidden = [
      "[link]",
      "scopri di più",
      "scopri di piu",
      "clicca qui",
      "vedi sotto",
      "qui sotto",
      "leggi sotto",
    ];
    for (const item of glossarioItems) {
      const lower = item.answerCapsule.toLowerCase();
      for (const token of forbidden) {
        expect(
          lower.includes(token),
          `capsule "${item.id}" contains forbidden token "${token}"`,
        ).toBe(false);
      }
      // No markdown links
      expect(
        /\]\(/.test(item.answerCapsule),
        `capsule "${item.id}" contains markdown link`,
      ).toBe(false);
    }
  });

  it("every capsule contains at least one numeric fact or normative reference", () => {
    const pattern = /\d|legge|circolare|art\.|comma|DM/i;
    for (const item of glossarioItems) {
      expect(
        pattern.test(item.answerCapsule),
        `capsule "${item.id}" lacks numeric/normative anchor`,
      ).toBe(true);
    }
  });

  it("every answerDetail is non-empty and longer than the capsule", () => {
    for (const item of glossarioItems) {
      expect(item.answerDetail.trim().length).toBeGreaterThan(0);
      expect(
        item.answerDetail.length,
        `detail "${item.id}" shorter than capsule`,
      ).toBeGreaterThan(item.answerCapsule.length);
    }
  });
});

describe("glossarioSources (story 79.10)", () => {
  it("has between 5 and 10 sources", () => {
    expect(glossarioSources.length).toBeGreaterThanOrEqual(5);
    expect(glossarioSources.length).toBeLessThanOrEqual(10);
  });

  it("every source has a non-empty label and a valid https url", () => {
    for (const src of glossarioSources) {
      expect(src.label.trim().length).toBeGreaterThan(0);
      expect(src.url.startsWith("https://")).toBe(true);
    }
  });
});
