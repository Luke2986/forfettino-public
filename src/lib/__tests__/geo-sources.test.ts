import { describe, it, expect } from "vitest";
import { GEO_SOURCES, formatGeoSource, type GeoSource } from "@/lib/geo-sources";

describe("GEO_SOURCES", () => {
  const entries = Object.entries(GEO_SOURCES);

  it("contiene almeno 12 fonti canoniche", () => {
    expect(entries.length).toBeGreaterThanOrEqual(12);
  });

  it("ogni fonte ha tutti i campi non vuoti", () => {
    entries.forEach(([key, src]) => {
      expect(src.id, `${key}.id`).toBeTruthy();
      expect(src.institution, `${key}.institution`).toBeTruthy();
      expect(src.reference, `${key}.reference`).toBeTruthy();
      expect(src.title, `${key}.title`).toBeTruthy();
      expect(src.year, `${key}.year`).toBeGreaterThan(1900);
    });
  });

  it("ogni id e' unico e coincide con la chiave del record", () => {
    const ids = entries.map(([, src]) => src.id);
    expect(new Set(ids).size).toBe(ids.length);
    entries.forEach(([key, src]) => {
      expect(src.id, `key ${key}`).toBe(key);
    });
  });

  it("ogni reference contiene un anno a 4 cifre", () => {
    entries.forEach(([key, src]) => {
      expect(/\b\d{4}\b/.test(src.reference), `${key} senza anno`).toBe(true);
    });
  });

  it("include gli id canonici critici richiesti dai blog + landing", () => {
    // Fonti obbligatorie citate nella tabella AC #9 e da LANDING_SOURCE_IDS.
    // Se una di queste manca, la sezione Fonti della landing o almeno un blog
    // perde la sua fonte primaria.
    const required = [
      "l190-2014-disciplina",
      "l197-2022-soglia-85k",
      "l190-2014-allegato-4",
      "l190-2014-startup-5",
      "l190-2014-riduzione-35",
      "inps-circ-8-2026-gs",
      "inps-circ-14-2026-artcom",
      "dlgs-127-2015-fe",
      "dl-73-2021-iscro",
      "dpr-435-2001-versamenti",
      "ade-ris-73e-2021-bollo",
      "ade-circ-9e-2019",
    ];
    required.forEach((id) => {
      expect(GEO_SOURCES[id], `missing canonical source: ${id}`).toBeDefined();
    });
  });

  it("formatGeoSource produce il formato canonico con em dash U+2014", () => {
    const sample: GeoSource = GEO_SOURCES["l190-2014-disciplina"];
    const formatted = formatGeoSource(sample);
    expect(formatted).toContain(" \u2014 ");
    expect(formatted).toMatch(/^Governo Italiano, Legge 23 dicembre 2014.*Disciplina del regime forfettario$/);
    expect(formatted).not.toContain(" -- ");
  });
});
