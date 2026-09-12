import { describe, it, expect } from "vitest";
// Logica pura cross-runtime dell'EF 84-9 (import per path relativo, come posthog-server 84-6).
import {
  buildClickMetricsHogQL,
  parseClickMetricsResponse,
  isValidIso,
  CLICK_EVENT,
  SENT_EVENT,
} from "../../../../supabase/functions/_shared/posthog-query-logic.ts";

describe("isValidIso — whitelist anti-injection", () => {
  it("accetta data semplice YYYY-MM-DD", () => {
    expect(isValidIso("2026-06-27")).toBe(true);
  });
  it("accetta data+ora con Z", () => {
    expect(isValidIso("2026-06-27T09:00:00.000Z")).toBe(true);
  });
  it("accetta offset ±HH:MM", () => {
    expect(isValidIso("2026-06-27T09:00:00+02:00")).toBe(true);
  });
  it("rifiuta stringa con tentativo di injection", () => {
    expect(isValidIso("2026-06-27'); DROP TABLE events;--")).toBe(false);
  });
  it("rifiuta formato non-ISO", () => {
    expect(isValidIso("27/06/2026")).toBe(false);
    expect(isValidIso("ieri")).toBe(false);
  });
  it("rifiuta non-stringa / nullish", () => {
    expect(isValidIso(null)).toBe(false);
    expect(isValidIso(undefined)).toBe(false);
    expect(isValidIso(123 as unknown)).toBe(false);
  });
  it("rifiuta data impossibile", () => {
    expect(isValidIso("2026-13-40")).toBe(false);
  });
});

describe("buildClickMetricsHogQL", () => {
  it("since null → nessun filtro temporale", () => {
    const q = buildClickMetricsHogQL(null);
    expect(q).toContain(CLICK_EVENT);
    expect(q).toContain(SENT_EVENT);
    expect(q).not.toContain("timestamp >=");
  });

  it("since ISO valido → interpola parseDateTimeBestEffort", () => {
    const q = buildClickMetricsHogQL("2026-06-27T00:00:00Z");
    expect(q).toContain(
      "timestamp >= parseDateTimeBestEffort('2026-06-27T00:00:00Z')",
    );
  });

  it("since ISO con frazioni+Z (da toISOString) → interpolato senza errori", () => {
    const q = buildClickMetricsHogQL("2026-06-27T15:40:23.123Z");
    expect(q).toContain("parseDateTimeBestEffort('2026-06-27T15:40:23.123Z')");
  });

  it("since non-ISO (injection) → IGNORATO, nessuna interpolazione grezza", () => {
    const evil = "2026-06-27'); DROP TABLE events;--";
    const q = buildClickMetricsHogQL(evil);
    expect(q).not.toContain("DROP TABLE");
    expect(q).not.toContain("timestamp >=");
  });

  it("raggruppa per day/event/threshold", () => {
    const q = buildClickMetricsHogQL(null);
    expect(q).toContain("GROUP BY day, event, threshold");
  });
});

describe("parseClickMetricsResponse", () => {
  it("rows mock → clicks/sends/click_rate/by_threshold/trend", () => {
    const response = {
      results: [
        ["2026-06-25", SENT_EVENT, "7", 100],
        ["2026-06-25", CLICK_EVENT, "7", 20],
        ["2026-06-26", SENT_EVENT, "0", 50],
        ["2026-06-26", CLICK_EVENT, "0", 5],
      ],
    };
    const m = parseClickMetricsResponse(response);
    expect(m.clicks).toBe(25);
    expect(m.sends).toBe(150);
    expect(m.click_rate).toBeCloseTo(25 / 150);

    // by_threshold ordinato per soglia
    expect(m.by_threshold).toHaveLength(2);
    const t0 = m.by_threshold.find((t) => t.threshold === "0")!;
    const t7 = m.by_threshold.find((t) => t.threshold === "7")!;
    expect(t7).toMatchObject({ clicks: 20, sends: 100 });
    expect(t7.click_rate).toBeCloseTo(0.2);
    expect(t0).toMatchObject({ clicks: 5, sends: 50 });

    // trend per giorno
    expect(m.trend).toEqual([
      { day: "2026-06-25", clicks: 20, sends: 100 },
      { day: "2026-06-26", clicks: 5, sends: 50 },
    ]);
  });

  it("sends=0 → click_rate null (no divisione per zero)", () => {
    const m = parseClickMetricsResponse({
      results: [["2026-06-25", CLICK_EVENT, "7", 3]],
    });
    expect(m.clicks).toBe(3);
    expect(m.sends).toBe(0);
    expect(m.click_rate).toBeNull();
  });

  it("payload vuoto → zeri, mai throw", () => {
    expect(parseClickMetricsResponse({ results: [] })).toEqual({
      clicks: 0,
      sends: 0,
      click_rate: null,
      by_threshold: [],
      trend: [],
    });
    expect(parseClickMetricsResponse(null)).toEqual({
      clicks: 0,
      sends: 0,
      click_rate: null,
      by_threshold: [],
      trend: [],
    });
    expect(parseClickMetricsResponse(undefined)).toEqual({
      clicks: 0,
      sends: 0,
      click_rate: null,
      by_threshold: [],
      trend: [],
    });
  });

  it("accetta array di righe diretto (senza wrapper results)", () => {
    const m = parseClickMetricsResponse([
      [null, SENT_EVENT, null, 10],
      [null, CLICK_EVENT, null, 2],
    ]);
    expect(m.sends).toBe(10);
    expect(m.clicks).toBe(2);
    // threshold mancante → chiave 'na'
    expect(m.by_threshold[0].threshold).toBe("na");
  });

  it("ignora eventi estranei e righe malformate", () => {
    const m = parseClickMetricsResponse({
      results: [
        ["2026-06-25", "altro_evento", "7", 999],
        "non-una-riga",
        ["2026-06-25", SENT_EVENT, "7", 4],
      ],
    });
    expect(m.sends).toBe(4);
    expect(m.clicks).toBe(0);
  });
});
