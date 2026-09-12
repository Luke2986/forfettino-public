import { describe, it, expect } from "vitest";
import { getSuggestions } from "./category-suggestions";

const COMMON_TAIL = [
  "Assistenza e supporto",
  "Gestione progetto",
  "Copywriting e contenuti",
  "Social media",
  "Sviluppo software",
  "Grafica e design",
  "Traduzioni",
];

describe("getSuggestions", () => {
  it("should return professionisti + common for null", () => {
    const result = getSuggestions(null);
    expect(result.slice(0, 3)).toEqual(["Consulenza", "Formazione", "Progettazione"]);
    expect(result.slice(3)).toEqual(COMMON_TAIL);
    expect(result.length).toBe(10);
  });

  it("should return professionisti + common for empty string", () => {
    expect(getSuggestions("").slice(0, 3)).toEqual(["Consulenza", "Formazione", "Progettazione"]);
  });

  it('should return professionisti + common for "Professionisti"', () => {
    const result = getSuggestions("Professionisti");
    expect(result.slice(0, 3)).toEqual(["Consulenza", "Formazione", "Progettazione"]);
    expect(result.length).toBe(10);
  });

  it("should match Professionisti case-insensitively and partially", () => {
    expect(getSuggestions("Liberi Professionisti").slice(0, 3)).toEqual([
      "Consulenza",
      "Formazione",
      "Progettazione",
    ]);
  });

  it('should return artigiani + common for "Artigiani"', () => {
    const result = getSuggestions("Artigiani");
    expect(result.slice(0, 3)).toEqual(["Produzione", "Riparazione", "Installazione"]);
    expect(result.slice(3)).toEqual(COMMON_TAIL);
    expect(result.length).toBe(10);
  });

  it("should match artigiani case-insensitively", () => {
    expect(getSuggestions("artigiani").slice(0, 3)).toEqual([
      "Produzione",
      "Riparazione",
      "Installazione",
    ]);
  });

  it('should return commercianti + common for "Commercianti"', () => {
    const result = getSuggestions("Commercianti");
    expect(result.slice(0, 3)).toEqual(["Vendita prodotti", "Vendita servizi", "Intermediazione"]);
    expect(result.slice(3)).toEqual(COMMON_TAIL);
    expect(result.length).toBe(10);
  });

  it("should match commercianti case-insensitively", () => {
    expect(getSuggestions("commercianti").slice(0, 3)).toEqual([
      "Vendita prodotti",
      "Vendita servizi",
      "Intermediazione",
    ]);
  });

  it("should fallback to professionisti for unknown category", () => {
    expect(getSuggestions("Sconosciuta").slice(0, 3)).toEqual([
      "Consulenza",
      "Formazione",
      "Progettazione",
    ]);
  });

  it("should return professionisti for whitespace-only string", () => {
    expect(getSuggestions("   ").slice(0, 3)).toEqual([
      "Consulenza",
      "Formazione",
      "Progettazione",
    ]);
  });

  it("should have no duplicates", () => {
    const result = getSuggestions(null);
    expect(new Set(result).size).toBe(result.length);
  });
});
