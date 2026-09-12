import { describe, it, expect } from "vitest";
import { formatDateItalianLong, formatMonthYearItalian } from "@/lib/date-formatting";

describe("formatDateItalianLong", () => {
  it("formatta 2026-04-10 come 10 aprile 2026", () => {
    expect(formatDateItalianLong("2026-04-10")).toBe("10 aprile 2026");
  });

  it("formatta 2026-01-01 come 1 gennaio 2026", () => {
    expect(formatDateItalianLong("2026-01-01")).toBe("1 gennaio 2026");
  });

  it("formatta 2026-12-31 come 31 dicembre 2026", () => {
    expect(formatDateItalianLong("2026-12-31")).toBe("31 dicembre 2026");
  });

  it("non fa day-shift timezone (parse locale)", () => {
    // Bug classico: new Date("2026-01-01") → 31 dicembre 2025 in UTC-offset.
    // Con parseLocalDate T00:00:00 deve restare 1 gennaio 2026.
    expect(formatDateItalianLong("2026-01-01")).toBe("1 gennaio 2026");
    expect(formatDateItalianLong("2026-06-15")).toBe("15 giugno 2026");
  });

  it("accetta anche stringhe ISO con T", () => {
    expect(formatDateItalianLong("2026-04-10T12:30:00")).toBe("10 aprile 2026");
  });

  it("ritorna raw fallback su input invalido", () => {
    expect(formatDateItalianLong("")).toBe("");
    expect(formatDateItalianLong("not-a-date")).toBe("not-a-date");
  });

  it("formatta tutti i mesi correttamente", () => {
    const mesi = [
      ["2026-02-05", "5 febbraio 2026"],
      ["2026-03-05", "5 marzo 2026"],
      ["2026-05-05", "5 maggio 2026"],
      ["2026-07-05", "5 luglio 2026"],
      ["2026-08-05", "5 agosto 2026"],
      ["2026-09-05", "5 settembre 2026"],
      ["2026-10-05", "5 ottobre 2026"],
      ["2026-11-05", "5 novembre 2026"],
    ];
    for (const [input, expected] of mesi) {
      expect(formatDateItalianLong(input)).toBe(expected);
    }
  });
});

describe("formatMonthYearItalian", () => {
  it("formatta 2026-04 come aprile 2026", () => {
    expect(formatMonthYearItalian("2026-04")).toBe("aprile 2026");
  });

  it("accetta anche YYYY-MM-DD e usa solo mese/anno", () => {
    expect(formatMonthYearItalian("2026-04-10")).toBe("aprile 2026");
  });

  it("ritorna raw fallback su input invalido", () => {
    expect(formatMonthYearItalian("")).toBe("");
    expect(formatMonthYearItalian("invalid")).toBe("invalid");
  });
});
