import { describe, expect, it } from "vitest";
import { faqPageItems, faqPageSources } from "@/lib/faq-page";

// Story 79.9 — validate the FAQ dataset used by /faq public page.
// These tests enforce GEO guarantees (capsule length, uniqueness, citability).

describe("faqPageItems (story 79.9)", () => {
  it("has between 15 and 18 items", () => {
    expect(faqPageItems.length).toBeGreaterThanOrEqual(15);
    expect(faqPageItems.length).toBeLessThanOrEqual(18);
  });

  it("every item has a unique id", () => {
    const ids = faqPageItems.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every question ends with a question mark", () => {
    for (const item of faqPageItems) {
      expect(item.question.endsWith("?")).toBe(true);
    }
  });

  it("every question has at least 8 words", () => {
    for (const item of faqPageItems) {
      const words = item.question.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("every answer capsule is between 120 and 160 characters", () => {
    for (const item of faqPageItems) {
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
    for (const item of faqPageItems) {
      const lower = item.answerCapsule.toLowerCase();
      for (const token of forbidden) {
        expect(
          lower.includes(token),
          `capsule "${item.id}" contains forbidden token "${token}"`,
        ).toBe(false);
      }
      // No markdown links
      expect(/\]\(/.test(item.answerCapsule)).toBe(false);
    }
  });

  it("every answerDetail is non-empty and longer than the capsule", () => {
    for (const item of faqPageItems) {
      expect(item.answerDetail.trim().length).toBeGreaterThan(0);
      expect(item.answerDetail.length).toBeGreaterThan(item.answerCapsule.length);
    }
  });

  it("every question text is unique (no duplicate phrasing)", () => {
    const questions = faqPageItems.map((i) => i.question.trim().toLowerCase());
    const unique = new Set(questions);
    expect(unique.size).toBe(questions.length);
  });

  it("total dataset word count stays within GEO target (1800-2600 words)", () => {
    const countWords = (text: string) =>
      text.trim().split(/\s+/).filter(Boolean).length;
    const total = faqPageItems.reduce(
      (sum, item) =>
        sum +
        countWords(item.question) +
        countWords(item.answerCapsule) +
        countWords(item.answerDetail),
      0,
    );
    expect(total, `dataset total words = ${total}`).toBeGreaterThanOrEqual(1800);
    expect(total, `dataset total words = ${total}`).toBeLessThanOrEqual(2600);
  });
});

describe("faqPageSources (story 79.9)", () => {
  it("has between 5 and 8 sources (AC #3)", () => {
    expect(faqPageSources.length).toBeGreaterThanOrEqual(5);
    expect(faqPageSources.length).toBeLessThanOrEqual(8);
  });

  it("every source has a non-empty label and a valid https url", () => {
    for (const src of faqPageSources) {
      expect(src.label.trim().length).toBeGreaterThan(0);
      expect(src.url.startsWith("https://")).toBe(true);
    }
  });
});
