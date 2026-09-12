/**
 * Test per src/lib/csv.ts (Story 84.9, Task 1.3).
 * Util CSV condivisi estratti da AdminEmailLog: escape, BOM, composizione header+righe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { escapeCsvField, downloadCsv, buildCsv } from "../csv";

describe("escapeCsvField", () => {
  it("non quota un valore semplice", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("quota quando contiene una virgola", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quota e raddoppia le doppie virgolette", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("quota quando contiene un newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("stringa vuota resta vuota", () => {
    expect(escapeCsvField("")).toBe("");
  });
});

describe("buildCsv", () => {
  it("compone header + righe con separatore virgola e newline", () => {
    const csv = buildCsv(
      ["Email", "Stato"],
      [
        ["a@test.com", "delivered"],
        ["b@test.com", "bounced"],
      ],
    );
    expect(csv).toBe(
      "Email,Stato\na@test.com,delivered\nb@test.com,bounced",
    );
  });

  it("applica l'escape alle celle con virgola/quote", () => {
    const csv = buildCsv(
      ["Nome", "Nota"],
      [["Rossi, Mario", 'dice "ok"']],
    );
    expect(csv).toBe('Nome,Nota\n"Rossi, Mario","dice ""ok"""');
  });

  it("solo header quando non ci sono righe", () => {
    expect(buildCsv(["A", "B"], [])).toBe("A,B");
  });
});

describe("downloadCsv", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let capturedContent: string[];
  let capturedTypes: string[];
  let anchorProps: Record<string, string>;

  beforeEach(() => {
    clickSpy = vi.fn();
    capturedContent = [];
    capturedTypes = [];
    anchorProps = {};

    const OrigBlob = globalThis.Blob;
    vi.spyOn(globalThis, "Blob" as never).mockImplementation(
      ((parts: BlobPart[], options?: BlobPropertyBag) => {
        capturedContent.push(parts.map(String).join(""));
        capturedTypes.push(options?.type ?? "");
        return new OrigBlob(parts, options);
      }) as never,
    );

    vi.spyOn(document, "createElement").mockReturnValue(
      new Proxy({} as HTMLAnchorElement, {
        set(_t, prop, value) {
          anchorProps[String(prop)] = value;
          return true;
        },
        get(_t, prop) {
          if (prop === "click") return clickSpy;
          return anchorProps[String(prop)];
        },
      }),
    );

    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("antepone il BOM UTF-8 (Excel)", () => {
    downloadCsv("test.csv", "Header1,Header2\nval1,val2");
    expect(capturedContent).toHaveLength(1);
    expect(capturedContent[0].charCodeAt(0)).toBe(0xfeff);
    expect(capturedContent[0]).toContain("Header1,Header2");
  });

  it("scarica con il filename corretto", () => {
    downloadCsv("email-scadenze-2026-06-27.csv", "A,B");
    expect(clickSpy).toHaveBeenCalled();
    expect(anchorProps.download).toBe("email-scadenze-2026-06-27.csv");
  });

  it("imposta il type text/csv con charset utf-8", () => {
    downloadCsv("test.csv", "A,B");
    expect(capturedTypes[0]).toBe("text/csv;charset=utf-8;");
  });

  it("revoca l'object URL dopo il download", () => {
    downloadCsv("test.csv", "A,B");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
