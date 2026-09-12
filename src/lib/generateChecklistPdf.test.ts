import { describe, it, expect, vi, beforeEach } from "vitest";
import { checklistItems } from "@/data/protezione-content";
import type { ChecklistState } from "./generateChecklistPdf";

// ── Mock jsPDF ──
const mockSave = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockLine = vi.fn();
const mockAddPage = vi.fn();
const mockSplitTextToSize = vi.fn((_text: string, _maxWidth: number) => ["line1"]);

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    save: mockSave,
    text: mockText,
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setTextColor: mockSetTextColor,
    setDrawColor: mockSetDrawColor,
    line: mockLine,
    addPage: mockAddPage,
    splitTextToSize: mockSplitTextToSize,
  })),
}));

describe("generateChecklistPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-03-02T12:00:00"));
  });

  const allNonSo: Record<string, ChecklistState> = Object.fromEntries(
    checklistItems.map((item) => [item.id, "non-so" as ChecklistState]),
  );

  it("chiama doc.save con filename contenente la data locale", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);
    // toLocalISODate usa getFullYear/getMonth/getDate — NO toISOString (timezone safe)
    expect(mockSave).toHaveBeenCalledWith("checklist-protezione-2026-03-02.pdf");
  });

  it("filename usa data locale anche a tarda sera (timezone safety)", async () => {
    // At 23:30 locale, il filename deve comunque riflettere il giorno locale
    vi.setSystemTime(new Date("2026-03-02T23:30:00"));
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);
    expect(mockSave).toHaveBeenCalledWith("checklist-protezione-2026-03-02.pdf");
  });

  it("scrive il titolo FORFETTINO", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);
    expect(mockText).toHaveBeenCalledWith(
      "FORFETTINO",
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "center" }),
    );
  });

  it("scrive tutte e 7 le voci", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);

    for (const item of checklistItems) {
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining(item.label),
        expect.any(Number),
        expect.any(Number),
      );
    }
  });

  it("scrive il simbolo corretto per ogni stato", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    const mixed: Record<string, ChecklistState> = {
      ...allNonSo,
      infortuni: "ho",
      rc: "non-ho",
    };
    await generateChecklistPdf(checklistItems, mixed);

    // "✓ Infortuni/Malattia" per "ho"
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining("✓ Infortuni/Malattia"),
      expect.any(Number),
      expect.any(Number),
    );
    // "✗ RC Professionale" per "non-ho"
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining("✗ RC Professionale"),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("wrappa descrizioni e mini-note con splitTextToSize (overflow protection)", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);

    // 7 descriptions + 7 mini-notes + 1 disclaimer = 15 calls
    expect(mockSplitTextToSize).toHaveBeenCalledTimes(15);

    // Verify a description is wrapped
    expect(mockSplitTextToSize).toHaveBeenCalledWith(
      checklistItems[0].description,
      expect.any(Number),
    );
  });

  it("scrive il disclaimer nel PDF", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);

    expect(mockSplitTextToSize).toHaveBeenCalledWith(
      expect.stringContaining("Forfettino ti aiuta a orientarti"),
      expect.any(Number),
    );
  });

  it("scrive il footer", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);

    expect(mockText).toHaveBeenCalledWith(
      "Generato da Forfettino.it — Il tuo copilota fiscale",
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "center" }),
    );
  });

  it("scrive la CTA Guida Completa", async () => {
    const { generateChecklistPdf } = await import("./generateChecklistPdf");
    await generateChecklistPdf(checklistItems, allNonSo);

    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining("Scarica la Guida Completa alla Protezione Freelancer"),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "center" }),
    );
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining("Forfettino.it/guide-per-te"),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "center" }),
    );
  });
});
