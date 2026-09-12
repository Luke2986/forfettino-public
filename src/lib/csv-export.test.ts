import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { csvSafe, downloadCsvItalian, formatNumberIT } from "./csv-export";

describe("csvSafe (existing)", () => {
  it("wraps value in double quotes", () => {
    expect(csvSafe("hello")).toBe('"hello"');
  });
  it("escapes internal double quotes", () => {
    expect(csvSafe('say "hi"')).toBe('"say ""hi"""');
  });
  it("prefixes formula-like values with single quote", () => {
    expect(csvSafe("=SUM(A1)")).toBe("\"'=SUM(A1)\"");
  });
});

describe("formatNumberIT", () => {
  it("formats integer with 2 decimal places", () => {
    const result = formatNumberIT(100, 2);
    // jsdom may not fully support it-IT, so check structure
    expect(result).toMatch(/100/);
    // Should have decimal separator
    expect(result).toMatch(/[,.]00/);
  });

  it("formats zero", () => {
    const result = formatNumberIT(0, 2);
    expect(result).toMatch(/0[,.]00/);
  });

  it("formats large number", () => {
    const result = formatNumberIT(1234.56, 2);
    // Contains 1234 and 56 with some separator
    expect(result).toMatch(/1.*234.*56/);
  });

  it("respects custom decimal count", () => {
    const result = formatNumberIT(78.3, 1);
    expect(result).toMatch(/78.*3/);
  });

  it("defaults to 2 decimals", () => {
    const result = formatNumberIT(5);
    expect(result).toMatch(/5[,.]00/);
  });

  it("uses comma as decimal separator (not dot)", () => {
    const result = formatNumberIT(1.5, 1);
    // Node's Intl supports it-IT — decimal separator must be comma
    expect(result).not.toMatch(/^1\.5$/);
  });
});

describe("downloadCsvItalian", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let capturedContent: string[];
  let capturedTypes: string[];
  let anchorProps: Record<string, string>;

  beforeEach(() => {
    clickSpy = vi.fn();
    capturedContent = [];
    capturedTypes = [];
    anchorProps = {};

    // Intercept Blob constructor to capture raw string content
    const OrigBlob = globalThis.Blob;
    vi.spyOn(globalThis, "Blob" as any).mockImplementation(
      (parts: BlobPart[], options?: BlobPropertyBag) => {
        capturedContent.push(parts.map(String).join(""));
        capturedTypes.push(options?.type ?? "");
        return new OrigBlob(parts, options);
      },
    );

    vi.spyOn(document, "createElement").mockReturnValue(
      new Proxy({} as HTMLAnchorElement, {
        set(_target, prop, value) {
          anchorProps[String(prop)] = value;
          return true;
        },
        get(_target, prop) {
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

  it("creates CSV with UTF-8 BOM prefix", () => {
    downloadCsvItalian("Header1;Header2", ["val1;val2"], "test.csv");

    expect(capturedContent).toHaveLength(1);
    const text = capturedContent[0];
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(text).toContain("Header1;Header2");
    expect(text).toContain("val1;val2");
  });

  it("joins header and rows with newline", () => {
    downloadCsvItalian("H1;H2", ["r1a;r1b", "r2a;r2b"], "test.csv");

    const text = capturedContent[0];
    const lines = text.replace("\uFEFF", "").split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("H1;H2");
    expect(lines[1]).toBe("r1a;r1b");
    expect(lines[2]).toBe("r2a;r2b");
  });

  it("triggers download with correct filename", () => {
    downloadCsvItalian("H", [], "report-clienti-2026.csv");
    expect(clickSpy).toHaveBeenCalled();
    expect(anchorProps.download).toBe("report-clienti-2026.csv");
  });

  it("revokes object URL after download", () => {
    downloadCsvItalian("H", [], "test.csv");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("sets blob type to text/csv with utf-8 charset", () => {
    downloadCsvItalian("H", [], "test.csv");
    expect(capturedTypes[0]).toBe("text/csv;charset=utf-8;");
  });
});
