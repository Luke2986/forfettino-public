import { describe, it, expect } from "vitest";
import { parseEmailCampaign } from "@/lib/email-campaign-utm";
// Twin SERVER (_shared, mondo Deno) importato per path relativo — solo per il test anti-drift.
import { parseEmailCampaign as parseServerTwin } from "../../../supabase/functions/_shared/deadline-email-logic.ts";

// Twin client di parseEmailCampaign (_shared/deadline-email-logic.ts): stessa semantica.
describe("parseEmailCampaign (client) — utm_campaign → bucket/threshold", () => {
  it("bucket multi-underscore + threshold", () => {
    expect(parseEmailCampaign("scadenza_saldo_tax_7")).toEqual({ bucket: "saldo_tax", threshold: 7 });
    expect(parseEmailCampaign("scadenza_acconto_inps_1_3")).toEqual({ bucket: "acconto_inps_1", threshold: 3 });
  });

  it("threshold 0 / 30", () => {
    expect(parseEmailCampaign("scadenza_inps_q3_0")).toEqual({ bucket: "inps_q3", threshold: 0 });
    expect(parseEmailCampaign("scadenza_june_30")).toEqual({ bucket: "june", threshold: 30 });
  });

  it("malformato → null", () => {
    expect(parseEmailCampaign("scadenza_saldo_tax_x")).toBeNull();
    expect(parseEmailCampaign("altro_x_7")).toBeNull();
    expect(parseEmailCampaign("scadenza_saldo")).toBeNull();
    expect(parseEmailCampaign("")).toBeNull();
  });
});

// L1 review 84-6: i due parser sono duplicati VOLUTI (il `_shared` non è importabile nel bundle
// Vite). Testati separatamente, ma senza un guard erano soggetti a drift silenzioso. Questo test
// li ancora: stesso output su una batteria comune → se uno cambia, qui rompe.
describe("parseEmailCampaign — anti-drift twin client ⇄ server (L1)", () => {
  const CASES = [
    "scadenza_saldo_tax_7",
    "scadenza_inps_q3_0",
    "scadenza_acconto_inps_1_3",
    "scadenza_june_30",
    "scadenza_saldo_tax_x", // threshold non numerico → null
    "altro_saldo_tax_7", // prefisso errato → null
    "scadenza_saldo", // senza threshold → null
    "scadenza_", // solo prefisso → null
    "", // vuoto → null
  ];
  it.each(CASES)("client e server producono lo stesso output per '%s'", (input) => {
    expect(parseEmailCampaign(input)).toEqual(parseServerTwin(input));
  });
});
