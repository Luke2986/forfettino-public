/**
 * ateco-to-role-mapping.test.ts — Story 46.2
 * Test mapping codici ATECO forfettari → jobTitle Datapizza
 */
import { describe, it, expect } from "vitest";
import { mapAtecoToJobTitle } from "./ateco-to-role-mapping";

describe("mapAtecoToJobTitle", () => {
  it("maps known tech ATECO codes to jobTitle", () => {
    expect(mapAtecoToJobTitle("62.01.00")).toBe("software_developer");
    expect(mapAtecoToJobTitle("62.02.00")).toBe("it_consultant");
    expect(mapAtecoToJobTitle("62.09.09")).toBe("it_specialist");
  });

  it("maps design/creative ATECO codes", () => {
    expect(mapAtecoToJobTitle("74.10.21")).toBe("product_designer");
    expect(mapAtecoToJobTitle("73.11.01")).toBe("content_creator");
    expect(mapAtecoToJobTitle("73.11.02")).toBe("content_creator");
  });

  it("maps consulting/business ATECO codes", () => {
    expect(mapAtecoToJobTitle("70.22.09")).toBe("it_consultant");
    expect(mapAtecoToJobTitle("69.20.11")).toBe("business_analyst");
  });

  it("returns null for unmappable ATECO codes (artigiani, commercianti, etc.)", () => {
    expect(mapAtecoToJobTitle("43.21.01")).toBeNull(); // impianti elettrici
    expect(mapAtecoToJobTitle("47.11.02")).toBeNull(); // commercio dettaglio
    expect(mapAtecoToJobTitle("86.90.21")).toBeNull(); // fisioterapia
    expect(mapAtecoToJobTitle("")).toBeNull();
  });

  it("matches by prefix when exact code not found", () => {
    // 62.01.10 NOT in EXACT_MAP → falls back to prefix 62.01 → software_developer
    expect(mapAtecoToJobTitle("62.01.10")).toBe("software_developer");
    // 63.11.99 NOT in EXACT_MAP → falls back to prefix 63.11 → data_engineer
    expect(mapAtecoToJobTitle("63.11.99")).toBe("data_engineer");
    // 74.10.99 NOT in EXACT_MAP → falls back to prefix 74.10 → product_designer
    expect(mapAtecoToJobTitle("74.10.99")).toBe("product_designer");
  });

  it("handles whitespace in ATECO codes", () => {
    expect(mapAtecoToJobTitle("  62.01.00  ")).toBe("software_developer");
    expect(mapAtecoToJobTitle(" 74.10.21 ")).toBe("product_designer");
  });
});
