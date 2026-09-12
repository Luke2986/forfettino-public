/**
 * Test per fiscal-engine.ts — Funzioni Pure del Motore Fiscale
 * Story 1.2 — Gestione Separata
 * Story 1.3 — INPS Artigiani con Minimale e Variabile
 * Story 1.4 — INPS Commercianti con Minimale e Variabile + Dispatcher calcINPS
 * Story 1.5 — Deducibilità INPS e Calcolo Imposta Sostitutiva Multi-Gestione
 * Story 1.6 — Generazione Schedule Events Tipizzati per Tutte le Gestioni
 * Story 1.7 — Pipeline Componibile Completo con Ricalcolo e Spendibile
 *
 * Copertura:
 * - calcImponibile: reddito imponibile da ricavi lordi
 * - calcImpostaSostitutiva: imposta sostitutiva 5% e 15%
 * - calcINPSSeparata: contributo INPS Gestione Separata
 * - calcTotaleSeparata: pipeline completa Separata
 * - calcMinimaleArtigiani: minimale annuo con/senza riduzione 35%
 * - calcRateFisseArtigiani: split 4 rate trimestrali
 * - calcVariabileArtigiani: contributi su eccedenza con doppia fascia
 * - calcINPSArtigiani: pipeline completa Artigiani
 * - calcMinimaleCommercianti: minimale annuo Commercianti con/senza riduzione 35%
 * - calcRateFisseCommercianti: split 4 rate trimestrali Commercianti
 * - calcVariabileCommercianti: contributi su eccedenza con doppia fascia Commercianti
 * - calcINPSCommercianti: pipeline completa Commercianti
 * - calcINPS: dispatcher unico per tutte le gestioni
 * - calcImpostaConDeducibilita: imposta con deducibilità INPS
 * - calcTotaleMultiGestione: pipeline completo multi-gestione con deducibilità
 * - getScadenzeFiscali: date scadenza per anno fiscale
 * - generateScheduleEvents: generazione eventi tipizzati per tutte le gestioni
 * - calcAccontiAnnoSuccessivo: acconti cross-anno e primo anno di attività
 * - Invarianti: somma componenti = totale
 * - Edge case: incasso 0, sotto minimale, doppia fascia, massimale cap, INPS > imponibile, ricavi negativi
 * - Confronto: Artigiani vs Commercianti, 3 gestioni
 */

import { describe, it, expect } from "vitest";
import {
  calcImponibile,
  calcImpostaSostitutiva,
  calcINPSSeparata,
  calcTotaleSeparata,
  calcMinimaleArtigiani,
  calcRateFisseArtigiani,
  calcVariabileArtigiani,
  calcINPSArtigiani,
  calcMinimaleCommercianti,
  calcRateFisseCommercianti,
  calcVariabileCommercianti,
  calcINPSCommercianti,
  calcINPS,
  calcImpostaConDeducibilita,
  calcTotaleMultiGestione,
  getScadenzeFiscali,
  getDifferimentoForfettario,
  applyMaggiorazioneDifferimento,
  getPaymentWindows,
  classifyPaymentWindow,
  nextWorkingDay,
  generateScheduleEvents,
  calcPipelineCompleto,
  calcAccontiAnnoSuccessivo,
  computeAccontiNextYearTotal,
  type FiscalRulesParams,
  type ScheduleEvent,
  type PipelineInput,
  type PipelineResult,
  type BreakdownVoce,
  type AccontiInput,
  type AccontiResult,
} from "./fiscal-engine";
import { checkBreakdownEquals, sumMoney, subtractMoney } from "./money";

// Parametri INPS 2026 ufficiali (da fiscal_rules — Circolari INPS n. 8 e n. 14/2026)
const params2026: FiscalRulesParams = {
  // Separata
  fiscal_year: 2026,
  inps_rate_separata: 26.07,
  massimale_separata: 122295.0,
  aliquota_sostitutiva_5: 5.0,
  aliquota_sostitutiva_15: 15.0,
  // Artigiani
  inps_rate_artigiani: 24.0,
  inps_rate_artigiani_alta: 25.0,
  minimale_artigiani: 4521.36,
  massimale_artigiani: 122295.0,
  reddito_minimale: 18808.0,
  soglia_reddito_prima_fascia: 56224.0,
  maternita_annuale: 7.44,
  // Commercianti
  inps_rate_commercianti: 24.48,
  inps_rate_commercianti_alta: 25.48,
  minimale_commercianti: 4611.64,
  massimale_commercianti: 122295.0,
};

describe("calcImponibile", () => {
  it("calcola imponibile con coefficiente 78%", () => {
    const result = calcImponibile(30000, 78);
    expect(result).toBe(23400.0);
  });

  it("calcola imponibile con coefficiente 67%", () => {
    const result = calcImponibile(50000, 67);
    expect(result).toBe(33500.0);
  });

  it("restituisce 0 per ricavi 0", () => {
    const result = calcImponibile(0, 78);
    expect(result).toBe(0);
  });
});

describe("calcImpostaSostitutiva", () => {
  it("calcola imposta sostitutiva 15% con ricavi 30.000 e coeff 78%", () => {
    // 30000 × 78% = 23400, 23400 × 15% = 3510
    const result = calcImpostaSostitutiva(30000, 78, 15);
    expect(result).toBe(3510.0);
  });

  it("calcola imposta sostitutiva 5% con ricavi 10.000 e coeff 78%", () => {
    // 10000 × 78% = 7800, 7800 × 5% = 390
    const result = calcImpostaSostitutiva(10000, 78, 5);
    expect(result).toBe(390.0);
  });

  it("calcola imposta sostitutiva 15% con coeff 67%", () => {
    // 50000 × 67% = 33500, 33500 × 15% = 5025
    const result = calcImpostaSostitutiva(50000, 67, 15);
    expect(result).toBe(5025.0);
  });

  it("restituisce 0 per ricavi 0", () => {
    const result = calcImpostaSostitutiva(0, 78, 15);
    expect(result).toBe(0);
  });
});

describe("calcINPSSeparata", () => {
  it("calcola INPS Separata con aliquota 26.07% su imponibile 23.400", () => {
    // 23400 × 26.07% = 6100.38
    // Verifica via centesimi: 2340000 * 26.07 / 100 = 610038.0 → 6100.38
    const result = calcINPSSeparata(23400, params2026.inps_rate_separata);
    expect(result).toBe(6100.38);
  });

  it("calcola INPS Separata con aliquota 26.07% su imponibile 7.800", () => {
    // 7800 × 26.07% = 2033.46
    // Verifica: 780000 * 26.07 / 100 = 203346.0 → 2033.46
    const result = calcINPSSeparata(7800, params2026.inps_rate_separata);
    expect(result).toBe(2033.46);
  });

  it("calcola INPS Separata con aliquota 26.07% su imponibile 33.500", () => {
    // 33500 × 26.07% = 8733.45
    // Verifica: 3350000 * 26.07 / 100 = 873345.0 → 8733.45
    const result = calcINPSSeparata(33500, params2026.inps_rate_separata);
    expect(result).toBe(8733.45);
  });

  it("restituisce 0 per imponibile 0", () => {
    const result = calcINPSSeparata(0, params2026.inps_rate_separata);
    expect(result).toBe(0);
  });

  it("applica il massimale quando imponibile lo supera", () => {
    // imponibile 156000 > massimale 122295 → calcola su 122295
    // 12229500 × 26.07 / 100 = 3188231 centesimi → 31882.31
    const result = calcINPSSeparata(156000, params2026.inps_rate_separata, 122295);
    expect(result).toBe(31882.31);
  });

  it("non applica il massimale quando imponibile è sotto", () => {
    // imponibile 23400 < massimale 122295 → calcola su 23400 (invariato)
    const result = calcINPSSeparata(23400, params2026.inps_rate_separata, 122295);
    expect(result).toBe(6100.38);
  });
});

describe("calcTotaleSeparata", () => {
  it("calcola pipeline completa Separata con aliquota 15%", () => {
    const result = calcTotaleSeparata(30000, 78, params2026, 15);

    expect(result.imponibile).toBe(23400.0);
    expect(result.imposta).toBe(3510.0);
    expect(result.inps).toBe(6100.38);
    expect(result.totaleAccantonamento).toBe(9610.38);
  });

  it("calcola pipeline completa Separata con aliquota 5%", () => {
    const result = calcTotaleSeparata(10000, 78, params2026, 5);

    expect(result.imponibile).toBe(7800.0);
    expect(result.imposta).toBe(390.0);
    expect(result.inps).toBe(2033.46);
    expect(result.totaleAccantonamento).toBe(2423.46);
  });

  it("soddisfa invariante: imposta + inps = totaleAccantonamento", () => {
    const result = calcTotaleSeparata(30000, 78, params2026, 15);

    const isValid = checkBreakdownEquals(result.totaleAccantonamento, [
      result.imposta,
      result.inps,
    ]);
    expect(isValid).toBe(true);
  });

  it("soddisfa invariante anche con importi dispari", () => {
    // Ricavi con centesimi dispari per stressare l'arrotondamento
    const result = calcTotaleSeparata(12345.67, 78, params2026, 15);

    const isValid = checkBreakdownEquals(result.totaleAccantonamento, [
      result.imposta,
      result.inps,
    ]);
    expect(isValid).toBe(true);
  });

  it("calcola pipeline completa Separata con coeff 67% (e-commerce)", () => {
    // 50000 × 67% = 33500, imposta 15% = 5025, INPS 26.07% = 8733.45
    const result = calcTotaleSeparata(50000, 67, params2026, 15);

    expect(result.imponibile).toBe(33500.0);
    expect(result.imposta).toBe(5025.0);
    expect(result.inps).toBe(8733.45);
    expect(result.totaleAccantonamento).toBe(13758.45);
  });

  it("restituisce tutti zeri per ricavi 0", () => {
    const result = calcTotaleSeparata(0, 78, params2026, 15);

    expect(result.imponibile).toBe(0);
    expect(result.imposta).toBe(0);
    expect(result.inps).toBe(0);
    expect(result.totaleAccantonamento).toBe(0);
  });
});

// ========== Story 1.3 — INPS Artigiani ==========

describe("calcMinimaleArtigiani", () => {
  it("restituisce il minimale annuo senza riduzione", () => {
    const result = calcMinimaleArtigiani(params2026, false);
    expect(result).toBe(4521.36);
  });

  it("applica riduzione 35% al minimale", () => {
    // 4521.36 × 65% = 2938.88
    const result = calcMinimaleArtigiani(params2026, true);
    expect(result).toBe(2938.88);
  });

  it("applica riduzione 50% al minimale — IVS only, maternità intatta", () => {
    // IVS = 4521.36 - 7.44 = 4513.92, ridotto = 4513.92 × 50% = 2256.96, + maternità 7.44 = 2264.40
    const result = calcMinimaleArtigiani(params2026, false, true);
    expect(result).toBe(2264.40);
  });

  it("mutual exclusivity: rid35+rid50 → rid50 prevale", () => {
    const soloRid50 = calcMinimaleArtigiani(params2026, false, true);
    const entrambe = calcMinimaleArtigiani(params2026, true, true);
    expect(entrambe).toBe(soloRid50);
  });
});

describe("calcRateFisseArtigiani", () => {
  it("divide il minimale in 4 rate trimestrali", () => {
    const rate = calcRateFisseArtigiani(4521.36);
    expect(rate).toHaveLength(4);
    expect(rate[0]).toBe(1130.34);
    expect(rate[1]).toBe(1130.34);
    expect(rate[2]).toBe(1130.34);
    expect(rate[3]).toBe(1130.34);
  });

  it("soddisfa invariante: somma rate = minimale", () => {
    const rate = calcRateFisseArtigiani(4521.36);
    const isValid = checkBreakdownEquals(4521.36, rate);
    expect(isValid).toBe(true);
  });

  it("gestisce minimale ridotto con invariante", () => {
    const rate = calcRateFisseArtigiani(2938.88);
    expect(rate).toHaveLength(4);
    const isValid = checkBreakdownEquals(2938.88, rate);
    expect(isValid).toBe(true);
  });
});

describe("calcVariabileArtigiani", () => {
  it("restituisce 0 se imponibile sotto reddito minimale", () => {
    // 7800 < 18808 → nessuna eccedenza
    const result = calcVariabileArtigiani(7800, params2026, false);
    expect(result).toBe(0);
  });

  it("calcola variabile su eccedenza con aliquota base", () => {
    // imponibile 23400, eccedenza = 23400 - 18808 = 4592
    // 4592 × 24% = 1102.08
    const result = calcVariabileArtigiani(23400, params2026, false);
    expect(result).toBe(1102.08);
  });

  it("calcola variabile con doppia fascia", () => {
    // imponibile 78000
    // fascia1 = 56224 - 18808 = 37416 × 24% = 8979.84
    // fascia2 = 78000 - 56224 = 21776 × 25% = 5444.00
    // totale = 14423.84
    const result = calcVariabileArtigiani(78000, params2026, false);
    expect(result).toBe(14423.84);
  });

  it("applica riduzione 35% al variabile", () => {
    // variabile base = 1102.08, ridotto = 1102.08 × 65% = 716.35
    const result = calcVariabileArtigiani(23400, params2026, true);
    expect(result).toBe(716.35);
  });

  it("applica riduzione 35% con doppia fascia", () => {
    // imponibile 78000, variabile base = 14423.84
    // ridotto = 14423.84 × 65% = 9375.50
    // centesimi: Math.round(1442384 * 65 / 100) = 937550 → 9375.50
    const result = calcVariabileArtigiani(78000, params2026, true);
    expect(result).toBe(9375.50);
  });

  it("applica il massimale quando imponibile lo supera", () => {
    // imponibile 130000 > massimale 122295 → calcola su 122295
    // eccedenza = 122295 - 18808 = 103487
    // fascia1 = min(103487, 37416) = 37416 × 24% = 8979.84
    // fascia2 = 122295 - 56224 = 66071 × 25% = 16517.75
    // variabile = 8979.84 + 16517.75 = 25497.59
    const result = calcVariabileArtigiani(130000, params2026, false);
    expect(result).toBe(25497.59);
  });

  it("non applica il massimale quando imponibile è sotto", () => {
    // imponibile 78000 < massimale 122295 → invariato rispetto al test doppia fascia
    const result = calcVariabileArtigiani(78000, params2026, false);
    expect(result).toBe(14423.84);
  });

  it("applica riduzione 50% al variabile", () => {
    // variabile base = 1102.08, ridotto = 1102.08 × 50% = 551.04
    const result = calcVariabileArtigiani(23400, params2026, false, true);
    expect(result).toBe(551.04);
  });

  it("applica riduzione 50% con doppia fascia", () => {
    // variabile base = 14423.84, ridotto = 14423.84 × 50% = 7211.92
    const result = calcVariabileArtigiani(78000, params2026, false, true);
    expect(result).toBe(7211.92);
  });
});

describe("calcINPSArtigiani", () => {
  it("calcola pipeline sopra minimale, senza riduzione", () => {
    // imponibile 23400, fisso 4521.36, variabile 1102.08, totale 5623.44
    const result = calcINPSArtigiani(23400, params2026, false);

    expect(result.minimaleAnnuo).toBe(4521.36);
    expect(result.rateFisse).toHaveLength(4);
    expect(result.variabile).toBe(1102.08);
    expect(result.totale).toBe(5623.44);
    expect(result.riduzione35Applicata).toBe(false);
  });

  it("calcola pipeline sotto minimale (solo fisso)", () => {
    // imponibile 7800, fisso 4521.36, variabile 0, totale 4521.36
    const result = calcINPSArtigiani(7800, params2026, false);

    expect(result.minimaleAnnuo).toBe(4521.36);
    expect(result.variabile).toBe(0);
    expect(result.totale).toBe(4521.36);
  });

  it("calcola pipeline con riduzione 35%", () => {
    // imponibile 23400, fisso ridotto 2938.88, variabile ridotto 716.35, totale 3655.23
    const result = calcINPSArtigiani(23400, params2026, true);

    expect(result.minimaleAnnuo).toBe(2938.88);
    expect(result.variabile).toBe(716.35);
    expect(result.totale).toBe(3655.23);
    expect(result.riduzione35Applicata).toBe(true);
  });

  it("calcola pipeline con doppia fascia", () => {
    // imponibile 78000, fisso 4521.36, variabile 14423.84, totale 18945.20
    const result = calcINPSArtigiani(78000, params2026, false);

    expect(result.minimaleAnnuo).toBe(4521.36);
    expect(result.variabile).toBe(14423.84);
    expect(result.totale).toBe(18945.20);
  });

  it("soddisfa invariante: minimale + variabile = totale", () => {
    const result = calcINPSArtigiani(23400, params2026, false);
    const isValid = checkBreakdownEquals(result.totale, [
      result.minimaleAnnuo,
      result.variabile,
    ]);
    expect(isValid).toBe(true);
  });

  it("soddisfa invariante somma rate = minimale", () => {
    const result = calcINPSArtigiani(23400, params2026, false);
    const isValid = checkBreakdownEquals(result.minimaleAnnuo, result.rateFisse);
    expect(isValid).toBe(true);
  });

  it("restituisce solo fisso per imponibile 0", () => {
    // minimale dovuto per intero anche con fatturato 0
    const result = calcINPSArtigiani(0, params2026, false);

    expect(result.minimaleAnnuo).toBe(4521.36);
    expect(result.variabile).toBe(0);
    expect(result.totale).toBe(4521.36);
  });

  it("calcola pipeline con riduzione 50%", () => {
    // minimale rid50 = 2264.40, variabile rid50 = 551.04, totale = 2815.44
    const result = calcINPSArtigiani(23400, params2026, false, true);

    expect(result.minimaleAnnuo).toBe(2264.40);
    expect(result.variabile).toBe(551.04);
    expect(result.totale).toBe(2815.44);
    expect(result.riduzione35Applicata).toBe(false);
    expect(result.riduzione50Applicata).toBe(true);
  });
});

// ========== Story 1.4 — INPS Commercianti ==========

describe("calcMinimaleCommercianti", () => {
  it("restituisce il minimale annuo senza riduzione", () => {
    const result = calcMinimaleCommercianti(params2026, false);
    expect(result).toBe(4611.64);
  });

  it("applica riduzione 35% al minimale", () => {
    // 4611.64 × 65% = ?
    // toCents(4611.64) = 461164, Math.round(461164 * 65 / 100) = Math.round(299757) = 299757 → 2997.57
    const result = calcMinimaleCommercianti(params2026, true);
    expect(result).toBe(2997.57);
  });

  it("applica riduzione 50% al minimale — IVS only, maternità intatta", () => {
    // IVS = 4611.64 - 7.44 = 4604.20, ridotto = 4604.20 × 50% = 2302.10, + maternità 7.44 = 2309.54
    const result = calcMinimaleCommercianti(params2026, false, true);
    expect(result).toBe(2309.54);
  });

  it("mutual exclusivity: rid35+rid50 → rid50 prevale", () => {
    const soloRid50 = calcMinimaleCommercianti(params2026, false, true);
    const entrambe = calcMinimaleCommercianti(params2026, true, true);
    expect(entrambe).toBe(soloRid50);
  });
});

describe("calcRateFisseCommercianti", () => {
  it("divide il minimale in 4 rate trimestrali", () => {
    // splitWithRemainder(4611.64, [25,25,25,25])
    // totalCents = 461164, each = Math.round(461164*25/100) = 115291 → 1152.91
    // last = 461164 - 3*115291 = 461164 - 345873 = 115291 → 1152.91
    const rate = calcRateFisseCommercianti(4611.64);
    expect(rate).toHaveLength(4);
    expect(rate[0]).toBe(1152.91);
    expect(rate[1]).toBe(1152.91);
    expect(rate[2]).toBe(1152.91);
    expect(rate[3]).toBe(1152.91);
  });

  it("soddisfa invariante: somma rate = minimale", () => {
    const rate = calcRateFisseCommercianti(4611.64);
    const isValid = checkBreakdownEquals(4611.64, rate);
    expect(isValid).toBe(true);
  });

  it("gestisce minimale ridotto con invariante", () => {
    const rate = calcRateFisseCommercianti(2997.57);
    expect(rate).toHaveLength(4);
    const isValid = checkBreakdownEquals(2997.57, rate);
    expect(isValid).toBe(true);
  });
});

describe("calcVariabileCommercianti", () => {
  it("restituisce 0 se imponibile sotto reddito minimale", () => {
    // 7800 < 18808 → nessuna eccedenza
    const result = calcVariabileCommercianti(7800, params2026, false);
    expect(result).toBe(0);
  });

  it("calcola variabile su eccedenza con aliquota base 24.48%", () => {
    // imponibile 23400, eccedenza = 23400 - 18808 = 4592
    // 4592 × 24.48%: toCents(4592)=459200, Math.round(459200*24.48/100)=Math.round(112412.16)=112412 → 1124.12
    const result = calcVariabileCommercianti(23400, params2026, false);
    expect(result).toBe(1124.12);
  });

  it("calcola variabile con doppia fascia", () => {
    // imponibile 78000
    // fascia1 = min(78000-18808, 56224-18808) = min(59192, 37416) = 37416
    // varFascia1 = 37416 × 24.48%: toCents(37416)=3741600, Math.round(3741600*24.48/100)=Math.round(915943.68)=915944 → 9159.44
    // fascia2 = 78000 - 56224 = 21776
    // varFascia2 = 21776 × 25.48%: toCents(21776)=2177600, Math.round(2177600*25.48/100)=Math.round(554852.48)=554852 → 5548.52
    // totale = 9159.44 + 5548.52 = 14707.96
    const result = calcVariabileCommercianti(78000, params2026, false);
    expect(result).toBe(14707.96);
  });

  it("applica riduzione 35% al variabile", () => {
    // variabile base = 1124.12, ridotto = 1124.12 × 65%
    // toCents(1124.12)=112412, Math.round(112412*65/100)=Math.round(73067.8)=73068 → 730.68
    const result = calcVariabileCommercianti(23400, params2026, true);
    expect(result).toBe(730.68);
  });

  it("applica il massimale quando imponibile lo supera", () => {
    // imponibile 130000 > massimale 122295 → calcola su 122295
    // eccedenza = 122295 - 18808 = 103487
    // fascia1 = min(103487, 37416) = 37416 × 24.48%: → 9159.44
    // fascia2 = 122295 - 56224 = 66071 × 25.48%
    // toCents(66071)=6607100, 6607100*25.48=168348908, /100=1683489.08, round=1683489 → 16834.89
    // variabile = sumMoney(9159.44, 16834.89) = 25994.33
    const result = calcVariabileCommercianti(130000, params2026, false);
    expect(result).toBe(25994.33);
  });

  it("non applica il massimale quando imponibile è sotto", () => {
    // imponibile 78000 < massimale 122295 → invariato rispetto al test doppia fascia
    const result = calcVariabileCommercianti(78000, params2026, false);
    expect(result).toBe(14707.96);
  });

  it("applica riduzione 35% con doppia fascia", () => {
    // imponibile 78000, variabile base = 14707.96
    // ridotto = multiplyByPercent(14707.96, 65)
    // toCents(14707.96)=1470796, Math.round(1470796*65/100)=Math.round(956017.4)=956017 → 9560.17
    const result = calcVariabileCommercianti(78000, params2026, true);
    expect(result).toBe(9560.17);
  });

  it("applica riduzione 50% al variabile", () => {
    // variabile base = 1124.12, ridotto = 1124.12 × 50% = 562.06
    const result = calcVariabileCommercianti(23400, params2026, false, true);
    expect(result).toBe(562.06);
  });

  it("applica riduzione 50% con doppia fascia", () => {
    // imponibile 78000, variabile base = 14707.96
    // ridotto = multiplyByPercent(14707.96, 50)
    // toCents(14707.96)=1470796, Math.round(1470796*50/100)=735398 → 7353.98
    const result = calcVariabileCommercianti(78000, params2026, false, true);
    expect(result).toBe(7353.98);
  });
});

describe("calcINPSCommercianti", () => {
  it("calcola pipeline sopra minimale, senza riduzione", () => {
    // imponibile 23400, fisso 4611.64, variabile 1124.12, totale 5735.76
    const result = calcINPSCommercianti(23400, params2026, false);

    expect(result.minimaleAnnuo).toBe(4611.64);
    expect(result.rateFisse).toHaveLength(4);
    expect(result.variabile).toBe(1124.12);
    expect(result.totale).toBe(5735.76);
    expect(result.riduzione35Applicata).toBe(false);
  });

  it("calcola pipeline sotto minimale (solo fisso)", () => {
    // imponibile 7800, fisso 4611.64, variabile 0, totale 4611.64
    const result = calcINPSCommercianti(7800, params2026, false);

    expect(result.minimaleAnnuo).toBe(4611.64);
    expect(result.variabile).toBe(0);
    expect(result.totale).toBe(4611.64);
  });

  it("calcola pipeline con riduzione 35%", () => {
    // fisso ridotto 2997.57, variabile ridotto 730.68, totale = 2997.57 + 730.68 = 3728.25
    const result = calcINPSCommercianti(23400, params2026, true);

    expect(result.minimaleAnnuo).toBe(2997.57);
    expect(result.variabile).toBe(730.68);
    expect(result.totale).toBe(3728.25);
    expect(result.riduzione35Applicata).toBe(true);
  });

  it("calcola pipeline con doppia fascia", () => {
    // imponibile 78000, fisso 4611.64, variabile 14707.96, totale 19319.60
    const result = calcINPSCommercianti(78000, params2026, false);

    expect(result.minimaleAnnuo).toBe(4611.64);
    expect(result.variabile).toBe(14707.96);
    expect(result.totale).toBe(19319.60);
  });

  it("soddisfa invariante: minimale + variabile = totale", () => {
    const result = calcINPSCommercianti(23400, params2026, false);
    const isValid = checkBreakdownEquals(result.totale, [
      result.minimaleAnnuo,
      result.variabile,
    ]);
    expect(isValid).toBe(true);
  });

  it("soddisfa invariante somma rate = minimale", () => {
    const result = calcINPSCommercianti(23400, params2026, false);
    const isValid = checkBreakdownEquals(result.minimaleAnnuo, result.rateFisse);
    expect(isValid).toBe(true);
  });

  it("restituisce solo fisso per imponibile 0", () => {
    const result = calcINPSCommercianti(0, params2026, false);

    expect(result.minimaleAnnuo).toBe(4611.64);
    expect(result.variabile).toBe(0);
    expect(result.totale).toBe(4611.64);
  });

  it("confronto: Commercianti > Artigiani per stesso reddito", () => {
    const art = calcINPSArtigiani(23400, params2026, false);
    const comm = calcINPSCommercianti(23400, params2026, false);

    // Aliquote Commercianti (+0.48pp) → importi più alti
    expect(comm.minimaleAnnuo).toBeGreaterThan(art.minimaleAnnuo);
    expect(comm.variabile).toBeGreaterThan(art.variabile);
    expect(comm.totale).toBeGreaterThan(art.totale);

    // Verifica delta specifici
    // minimale: 4611.64 - 4521.36 = 90.28
    expect(comm.minimaleAnnuo - art.minimaleAnnuo).toBeCloseTo(90.28, 2);
    // variabile: 1124.12 - 1102.08 = 22.04
    expect(comm.variabile - art.variabile).toBeCloseTo(22.04, 2);
    // totale: 5735.76 - 5623.44 = 112.32
    expect(comm.totale - art.totale).toBeCloseTo(112.32, 2);
  });

  it("calcola pipeline con riduzione 50%", () => {
    // minimale rid50 = 2309.54, variabile rid50 = 562.06, totale = 2871.60
    const result = calcINPSCommercianti(23400, params2026, false, true);

    expect(result.minimaleAnnuo).toBe(2309.54);
    expect(result.variabile).toBe(562.06);
    expect(result.totale).toBe(2871.60);
    expect(result.riduzione35Applicata).toBe(false);
    expect(result.riduzione50Applicata).toBe(true);
  });
});

// ========== Story 1.4 — Dispatcher calcINPS ==========

describe("calcINPS", () => {
  it("dispatcha correttamente su Separata", () => {
    const result = calcINPS("separata", 23400, params2026);

    expect(result.gestione).toBe("separata");
    if (result.gestione === "separata") {
      // Deve essere uguale a calcINPSSeparata diretta
      const direct = calcINPSSeparata(23400, params2026.inps_rate_separata, params2026.massimale_separata);
      expect(result.inps).toBe(direct);
    }
  });

  it("dispatcha correttamente su Artigiani", () => {
    const result = calcINPS("artigiani", 23400, params2026, false);

    expect(result.gestione).toBe("artigiani");
    if (result.gestione === "artigiani") {
      const direct = calcINPSArtigiani(23400, params2026, false);
      expect(result.result).toEqual(direct);
    }
  });

  it("dispatcha correttamente su Commercianti", () => {
    const result = calcINPS("commercianti", 23400, params2026, false);

    expect(result.gestione).toBe("commercianti");
    if (result.gestione === "commercianti") {
      const direct = calcINPSCommercianti(23400, params2026, false);
      expect(result.result).toEqual(direct);
    }
  });

  it("riduzione35Attiva ha default false", () => {
    // Senza passare riduzione35Attiva, il risultato deve essere senza riduzione
    const result = calcINPS("commercianti", 23400, params2026);

    if (result.gestione === "commercianti") {
      expect(result.result.riduzione35Applicata).toBe(false);
      expect(result.result.totale).toBe(5735.76);
    }
  });

  it("riduzione35Attiva è ignorata per Separata", () => {
    // Separata NON supporta la riduzione 35% — il risultato deve essere identico
    const senzaRiduzione = calcINPS("separata", 23400, params2026, false);
    const conRiduzione = calcINPS("separata", 23400, params2026, true);

    expect(senzaRiduzione.gestione).toBe("separata");
    expect(conRiduzione.gestione).toBe("separata");
    if (senzaRiduzione.gestione === "separata" && conRiduzione.gestione === "separata") {
      expect(conRiduzione.inps).toBe(senzaRiduzione.inps);
    }
  });

  it("riduzione50Attiva ha default false", () => {
    const result = calcINPS("artigiani", 23400, params2026);
    if (result.gestione === "artigiani") {
      expect(result.result.riduzione50Applicata).toBe(false);
      expect(result.result.totale).toBe(5623.44);
    }
  });

  it("riduzione50Attiva è ignorata per Separata", () => {
    const senza = calcINPS("separata", 23400, params2026, false, false);
    const con = calcINPS("separata", 23400, params2026, false, true);

    if (senza.gestione === "separata" && con.gestione === "separata") {
      expect(con.inps).toBe(senza.inps);
    }
  });
});

// ========== Story 1.5 — Deducibilità INPS e Imposta Sostitutiva Multi-Gestione ==========

describe("calcImpostaConDeducibilita", () => {
  it("riduce la base imponibile con deducibilità INPS", () => {
    // Scenario 1: Separata, ricavi 30000, coeff 78%, INPS 6100.38, aliquota 15%
    // imponibileLordo = 30000 × 78% = 23400
    // imponibileNetto = 23400 - 6100.38 = 17299.62
    // imposta = 17299.62 × 15% = 2594.94
    const result = calcImpostaConDeducibilita(30000, 78, 6100.38, 15);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiDeducibili).toBe(6100.38);
    expect(result.imponibileNetto).toBe(17299.62);
    expect(result.imposta).toBe(2594.94);
  });

  it("contributiINPS = 0 → risultato identico a senza deducibilità", () => {
    // Senza contributi, imponibileNetto = imponibileLordo
    // 30000 × 78% = 23400, 23400 × 15% = 3510
    const result = calcImpostaConDeducibilita(30000, 78, 0, 15);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiDeducibili).toBe(0);
    expect(result.imponibileNetto).toBe(23400);
    expect(result.imposta).toBe(3510);
  });

  it("contributiINPS > imponibile → imponibileNetto = 0, imposta = 0", () => {
    // Artigiani sotto minimale: ricavi 5000, coeff 78%, imponibile 3900, INPS 4521.36
    // imponibileNetto = max(0, 3900 - 4521.36) = 0
    const result = calcImpostaConDeducibilita(5000, 78, 4521.36, 15);

    expect(result.imponibileLordo).toBe(3900);
    expect(result.contributiDeducibili).toBe(4521.36);
    expect(result.imponibileNetto).toBe(0);
    expect(result.imposta).toBe(0);
  });

  it("soddisfa invariante imponibileNetto = max(0, imponibileLordo - contributiDeducibili)", () => {
    // Caso normale: contributi < imponibile
    const result = calcImpostaConDeducibilita(30000, 78, 6100.38, 15);
    expect(result.imponibileNetto).toBe(
      Math.max(0, result.imponibileLordo - result.contributiDeducibili)
    );
    // Verifica breakdown coerente quando non cappato
    const isValid = checkBreakdownEquals(result.imponibileLordo, [
      result.contributiDeducibili,
      result.imponibileNetto,
    ]);
    expect(isValid).toBe(true);
  });

  it("invariante vale anche quando contributi > imponibile (cap a 0)", () => {
    // Caso edge: contributi > imponibile → imponibileNetto cappato a 0
    const result = calcImpostaConDeducibilita(5000, 78, 4521.36, 15);
    expect(result.imponibileNetto).toBe(
      Math.max(0, result.imponibileLordo - result.contributiDeducibili)
    );
    // In questo caso la somma contributi + netto > lordo (cap attivo)
    expect(result.imponibileNetto).toBe(0);
    expect(result.contributiDeducibili).toBeGreaterThan(result.imponibileLordo);
  });

  it("aritmetica centesimi con importi dispari", () => {
    // ricavi 12345.67, coeff 78%
    // imponibileLordo = multiplyByPercent(12345.67, 78)
    // toCents(12345.67)=1234567, Math.round(1234567*78/100)=Math.round(962962.26)=962962 → 9629.62
    // INPS = 2500.33
    // imponibileNetto = subtractMoney(9629.62, 2500.33) = toCents: 962962-250033=712929 → 7129.29
    // imposta = multiplyByPercent(7129.29, 15) = toCents(7129.29)=712929, Math.round(712929*15/100)=Math.round(106939.35)=106939 → 1069.39
    const result = calcImpostaConDeducibilita(12345.67, 78, 2500.33, 15);

    expect(result.imponibileLordo).toBe(9629.62);
    expect(result.imponibileNetto).toBe(7129.29);
    expect(result.imposta).toBe(1069.39);
  });
});

describe("calcTotaleMultiGestione", () => {
  it("Separata — calcola imposta con deducibilità INPS", () => {
    // Scenario 1: ricavi 30000, coeff 78%, aliquota 15%
    // INPS Separata = 6100.38, imponibileNetto = 17299.62, imposta = 2594.94
    // totaleAccantonamento = 2594.94 + 6100.38 = 8695.32
    const result = calcTotaleMultiGestione(30000, 78, "separata", params2026, 15);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiINPS).toBe(6100.38);
    expect(result.imponibileNetto).toBe(17299.62);
    expect(result.imposta).toBe(2594.94);
    expect(result.totaleAccantonamento).toBe(8695.32);
    expect(result.dettaglioINPS.gestione).toBe("separata");
  });

  it("Artigiani — calcola imposta con deducibilità (minimale + variabile)", () => {
    // Scenario 2: ricavi 30000, coeff 78%, aliquota 15%, NO riduzione
    // INPS Artigiani totale = 5623.44, imponibileNetto = 17776.56, imposta = 2666.48
    // totaleAccantonamento = 2666.48 + 5623.44 = 8289.92
    const result = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, false);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiINPS).toBe(5623.44);
    expect(result.imponibileNetto).toBe(17776.56);
    expect(result.imposta).toBe(2666.48);
    expect(result.totaleAccantonamento).toBe(8289.92);
    expect(result.dettaglioINPS.gestione).toBe("artigiani");
  });

  it("Commercianti — calcola imposta con deducibilità (minimale + variabile)", () => {
    // Scenario 3: ricavi 30000, coeff 78%, aliquota 15%, NO riduzione
    // INPS Commercianti totale = 5735.76, imponibileNetto = 17664.24, imposta = 2649.64
    // totaleAccantonamento = 2649.64 + 5735.76 = 8385.40
    const result = calcTotaleMultiGestione(30000, 78, "commercianti", params2026, 15, false);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiINPS).toBe(5735.76);
    expect(result.imponibileNetto).toBe(17664.24);
    expect(result.imposta).toBe(2649.64);
    expect(result.totaleAccantonamento).toBe(8385.40);
    expect(result.dettaglioINPS.gestione).toBe("commercianti");
  });

  it("confronto 3 gestioni per stessi ricavi — Separata ha totale più alto", () => {
    // Scenario 4: stessi ricavi, confronto
    const sep = calcTotaleMultiGestione(30000, 78, "separata", params2026, 15);
    const art = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, false);
    const comm = calcTotaleMultiGestione(30000, 78, "commercianti", params2026, 15, false);

    // Separata ha INPS più alto → più deducibilità → imposta più bassa
    expect(sep.imposta).toBeLessThan(art.imposta);
    expect(sep.imposta).toBeLessThan(comm.imposta);

    // Ma totale accantonamento Separata è il più alto
    expect(sep.totaleAccantonamento).toBeGreaterThan(art.totaleAccantonamento);
    expect(sep.totaleAccantonamento).toBeGreaterThan(comm.totaleAccantonamento);

    // Commercianti ha INPS maggiore di Artigiani → più deducibilità → imposta più bassa
    expect(comm.imposta).toBeLessThan(art.imposta);
  });

  it("invariante imposta + INPS = totaleAccantonamento per Separata", () => {
    const result = calcTotaleMultiGestione(30000, 78, "separata", params2026, 15);
    const isValid = checkBreakdownEquals(result.totaleAccantonamento, [
      result.imposta,
      result.contributiINPS,
    ]);
    expect(isValid).toBe(true);
  });

  it("invariante imposta + INPS = totaleAccantonamento per Artigiani", () => {
    const result = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, false);
    const isValid = checkBreakdownEquals(result.totaleAccantonamento, [
      result.imposta,
      result.contributiINPS,
    ]);
    expect(isValid).toBe(true);
  });

  it("invariante imposta + INPS = totaleAccantonamento per Commercianti", () => {
    const result = calcTotaleMultiGestione(30000, 78, "commercianti", params2026, 15, false);
    const isValid = checkBreakdownEquals(result.totaleAccantonamento, [
      result.imposta,
      result.contributiINPS,
    ]);
    expect(isValid).toBe(true);
  });

  it("Artigiani sotto minimale (INPS > imponibile) → imposta = 0", () => {
    // Scenario 5: ricavi 5000, coeff 78%, imponibile 3900
    // INPS Artigiani = minimale 4521.36 (> 3900) → imponibileNetto = 0, imposta = 0
    const result = calcTotaleMultiGestione(5000, 78, "artigiani", params2026, 15, false);

    expect(result.imponibileLordo).toBe(3900);
    expect(result.contributiINPS).toBe(4521.36);
    expect(result.imponibileNetto).toBe(0);
    expect(result.imposta).toBe(0);
    expect(result.totaleAccantonamento).toBe(4521.36);
  });

  it("Artigiani con riduzione 35% — INPS ridotto → meno deducibilità → imposta più alta", () => {
    // Scenario 6: ricavi 30000, coeff 78%, aliquota 15%, riduzione35
    // INPS Artigiani ridotto = 3655.23, imponibileNetto = 19744.77, imposta = 2961.72
    // totaleAccantonamento = 2961.72 + 3655.23 = 6616.95
    const result = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, true);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiINPS).toBe(3655.23);
    expect(result.imponibileNetto).toBe(19744.77);
    expect(result.imposta).toBe(2961.72);
    expect(result.totaleAccantonamento).toBe(6616.95);

    // Confronto con senza riduzione: imposta più alta ma totale più basso
    const senzaRid = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, false);
    expect(result.imposta).toBeGreaterThan(senzaRid.imposta);
    expect(result.totaleAccantonamento).toBeLessThan(senzaRid.totaleAccantonamento);
  });

  it("Separata con ricavi 0 → tutto zero", () => {
    const result = calcTotaleMultiGestione(0, 78, "separata", params2026, 15);

    expect(result.imponibileLordo).toBe(0);
    expect(result.contributiINPS).toBe(0);
    expect(result.imponibileNetto).toBe(0);
    expect(result.imposta).toBe(0);
    expect(result.totaleAccantonamento).toBe(0);
  });

  it("Artigiani con ricavi 0 → solo minimale, imposta 0", () => {
    // Artigiani: minimale dovuto per intero anche con fatturato 0
    // imponibile = 0, INPS = minimale 4521.36, imponibileNetto = 0, imposta = 0
    const result = calcTotaleMultiGestione(0, 78, "artigiani", params2026, 15, false);

    expect(result.imponibileLordo).toBe(0);
    expect(result.contributiINPS).toBe(4521.36);
    expect(result.imponibileNetto).toBe(0);
    expect(result.imposta).toBe(0);
    expect(result.totaleAccantonamento).toBe(4521.36);
  });

  it("Commercianti con ricavi 0 → solo minimale, imposta 0", () => {
    const result = calcTotaleMultiGestione(0, 78, "commercianti", params2026, 15, false);

    expect(result.imponibileLordo).toBe(0);
    expect(result.contributiINPS).toBe(4611.64);
    expect(result.imponibileNetto).toBe(0);
    expect(result.imposta).toBe(0);
    expect(result.totaleAccantonamento).toBe(4611.64);
  });

  it("Separata con aliquota 5% agevolata", () => {
    // ricavi 30000, coeff 78%, aliquota 5%
    // INPS = 6100.38, imponibileNetto = 17299.62
    // imposta = multiplyByPercent(17299.62, 5)
    // toCents(17299.62)=1729962, Math.round(1729962*5/100)=Math.round(86498.1)=86498 → 864.98
    // totaleAccantonamento = 864.98 + 6100.38 = 6965.36
    const result = calcTotaleMultiGestione(30000, 78, "separata", params2026, 5);

    expect(result.imposta).toBe(864.98);
    expect(result.totaleAccantonamento).toBe(6965.36);
  });

  it("Artigiani con riduzione 50% — INPS ridotto, imposta più alta per meno deducibilità", () => {
    // INPS Artigiani rid50: minimale 2264.40 + variabile 551.04 = 2815.44
    // imponibileNetto = 23400 - 2815.44 = 20584.56
    // imposta = 20584.56 × 15% = 3087.68
    // totaleAccantonamento = 3087.68 + 2815.44 = 5903.12
    const result = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, false, true);

    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiINPS).toBe(2815.44);
    expect(result.imponibileNetto).toBe(20584.56);
    expect(result.imposta).toBe(3087.68);
    expect(result.totaleAccantonamento).toBe(5903.12);

    // Verifica flag riduzione50Applicata nel dettaglio
    if (result.dettaglioINPS.gestione === "artigiani") {
      expect(result.dettaglioINPS.result.riduzione50Applicata).toBe(true);
      expect(result.dettaglioINPS.result.riduzione35Applicata).toBe(false);
    }

    // Confronto: rid50 ha INPS più basso di rid35, ma imposta più alta
    const rid35 = calcTotaleMultiGestione(30000, 78, "artigiani", params2026, 15, true);
    expect(result.contributiINPS).toBeLessThan(rid35.contributiINPS);
    expect(result.totaleAccantonamento).toBeLessThan(rid35.totaleAccantonamento);
  });

  it("Commercianti con riduzione 50%", () => {
    // INPS Comm rid50: minimale 2309.54 + variabile 562.06 = 2871.60
    // imponibileNetto = 23400 - 2871.60 = 20528.40
    // imposta = 20528.40 × 15% = 3079.26
    // totaleAccantonamento = 3079.26 + 2871.60 = 5950.86
    const result = calcTotaleMultiGestione(30000, 78, "commercianti", params2026, 15, false, true);

    expect(result.contributiINPS).toBe(2871.60);
    expect(result.imponibileNetto).toBe(20528.40);
    expect(result.imposta).toBe(3079.26);
    expect(result.totaleAccantonamento).toBe(5950.86);

    // Verifica flag riduzione50Applicata nel dettaglio
    if (result.dettaglioINPS.gestione === "commercianti") {
      expect(result.dettaglioINPS.result.riduzione50Applicata).toBe(true);
      expect(result.dettaglioINPS.result.riduzione35Applicata).toBe(false);
    }
  });
});

// ========== Story 1.6 — Generazione Schedule Events Tipizzati ==========

describe("getScadenzeFiscali", () => {
  it("genera le date corrette per anno 2026 (proroga forfettari 20/07, Q2 18/05 sabato, Q3 20/08 pausa feriale)", () => {
    const date = getScadenzeFiscali(2026);

    expect(date.inpsFissoQ1).toBe("2026-02-16"); // lunedi'
    expect(date.inpsFissoQ2).toBe("2026-05-18"); // override: 16/05 sabato
    expect(date.inpsVariabile1).toBe("2026-07-20"); // proroga forfettari/ISA 2026: 30/06 → 20/07
    expect(date.inpsFissoQ3).toBe("2026-08-20"); // base: sempre 20/08 (sosp. feriale, NON prorogata)
    expect(date.inpsFissoQ4).toBe("2026-11-16"); // lunedi' — rata fissa minimale (invariata)
    expect(date.inpsVariabile2).toBe("2026-11-30"); // 2°acconto: NON interessato dalla proroga
    expect(date.taxGiugno).toBe("2026-07-20"); // proroga forfettari/ISA 2026 (decreto maggio 2026)
    expect(date.taxNovembre).toBe("2026-11-30");
  });

  it("genera le date corrette per anno 2025 (Q1 17/02 domenica, Q4 17/11 domenica)", () => {
    const date = getScadenzeFiscali(2025);

    expect(date.inpsFissoQ1).toBe("2025-02-17"); // 16/02 domenica → lun 17 (Fix F4)
    expect(date.inpsFissoQ2).toBe("2025-05-16"); // venerdi' - OK
    expect(date.inpsVariabile1).toBe("2025-06-30"); // nessuna proroga in mappa → termine ordinario 30/06 (lun)
    expect(date.inpsFissoQ3).toBe("2025-08-20"); // base: sempre 20/08 (mer)
    expect(date.inpsFissoQ4).toBe("2025-11-17"); // 16/11 domenica → lun 17 (Fix F4)
    expect(date.taxGiugno).toBe("2025-06-30"); // nessuna proroga → 30/06
    expect(date.taxNovembre).toBe("2025-12-01"); // 30/11 domenica → lun 01/12 (Fix F4)
  });

  it("genera le date corrette per anno 2027 (Q2 17/05 domenica, nessuna proroga)", () => {
    const date = getScadenzeFiscali(2027);

    expect(date.inpsFissoQ1).toBe("2027-02-16"); // martedi' - OK
    expect(date.inpsFissoQ2).toBe("2027-05-17"); // override: 16/05 domenica
    expect(date.inpsVariabile1).toBe("2027-06-30"); // nessuna proroga → 30/06 (mer)
    expect(date.inpsFissoQ3).toBe("2027-08-20"); // base: sempre 20/08
    expect(date.inpsFissoQ4).toBe("2027-11-16"); // martedi' - OK
    expect(date.taxGiugno).toBe("2027-06-30"); // nessuna proroga in mappa → termine ordinario
  });

  it("Fix F4: slittamento algoritmico anche per anni futuri non hardcoded (2030)", () => {
    const date = getScadenzeFiscali(2030);
    expect(date.inpsFissoQ1).toBe("2030-02-18"); // 16/02 sabato → lun 18
    expect(date.inpsFissoQ2).toBe("2030-05-16"); // giovedi' - OK
    expect(date.inpsFissoQ3).toBe("2030-08-20"); // martedi' - OK (sempre 20/08)
    expect(date.inpsFissoQ4).toBe("2030-11-18"); // 16/11 sabato → lun 18
    expect(date.taxGiugno).toBe("2030-07-01"); // 30/06 domenica → lun 01/07
    expect(date.taxNovembre).toBe("2030-12-02"); // 30/11 sabato → lun 02/12
  });
});

describe("getDifferimentoForfettario", () => {
  it("2026 — restituisce la finestra di differimento forfettari/ISA (20/07 → 20/08, +0,80%)", () => {
    const diff = getDifferimentoForfettario(2026);
    expect(diff).not.toBeNull();
    expect(diff!.termine).toBe("2026-07-20");
    expect(diff!.termineDifferito).toBe("2026-08-20");
    expect(diff!.maggiorazione).toBe(0.008);
  });

  it("anni senza proroga in mappa → null (2025, 2027)", () => {
    expect(getDifferimentoForfettario(2025)).toBeNull();
    expect(getDifferimentoForfettario(2027)).toBeNull();
  });

  it("il termine coincide con taxGiugno di getScadenzeFiscali (single source of truth)", () => {
    const diff = getDifferimentoForfettario(2026);
    expect(diff!.termine).toBe(getScadenzeFiscali(2026).taxGiugno);
  });
});

describe("applyMaggiorazioneDifferimento", () => {
  it("applica la maggiorazione 0,80% e arrotonda ai centesimi", () => {
    expect(applyMaggiorazioneDifferimento(1000, 0.008)).toBe(1008);
    expect(applyMaggiorazioneDifferimento(1234.56, 0.008)).toBe(1244.44); // 1234.56 × 1.008 = 1244.43648
    expect(applyMaggiorazioneDifferimento(0, 0.008)).toBe(0);
  });
});

describe("getPaymentWindows", () => {
  it("2026 — 4 finestre con maggiorazione e date rappresentative corrette", () => {
    const w = getPaymentWindows(2026);
    expect(w).not.toBeNull();
    expect(w!.map((o) => o.code)).toEqual([
      "ordinary",
      "proroga",
      "differimento",
      "late",
    ]);
    const byCode = Object.fromEntries(w!.map((o) => [o.code, o]));
    expect(byCode.ordinary.maggiorazione).toBe(0);
    expect(byCode.proroga.maggiorazione).toBe(0);
    expect(byCode.differimento.maggiorazione).toBe(0.008);
    expect(byCode.late.maggiorazione).toBe(0);
    // isoDate = giorno lavorativo rappresentativo della finestra
    expect(byCode.ordinary.isoDate).toBe("2026-06-30");
    expect(byCode.proroga.isoDate).toBe("2026-07-20");
    expect(byCode.differimento.isoDate).toBe("2026-08-20");
  });

  it("anni senza proroga in mappa → null (2025, 2027)", () => {
    expect(getPaymentWindows(2025)).toBeNull();
    expect(getPaymentWindows(2027)).toBeNull();
  });

  it("differimento.isoDate coincide con termineDifferito (single source of truth)", () => {
    const diff = getDifferimentoForfettario(2026)!;
    const win = getPaymentWindows(2026)!.find((o) => o.code === "differimento")!;
    expect(win.isoDate).toBe(diff.termineDifferito);
  });
});

describe("classifyPaymentWindow", () => {
  it("classifica le date 2026 ai confini corretti del decreto", () => {
    expect(classifyPaymentWindow(2026, "2026-06-15")).toBe("ordinary");
    expect(classifyPaymentWindow(2026, "2026-06-30")).toBe("ordinary"); // confine ordinario incluso
    expect(classifyPaymentWindow(2026, "2026-07-01")).toBe("proroga");
    expect(classifyPaymentWindow(2026, "2026-07-20")).toBe("proroga"); // termine prorogato incluso
    expect(classifyPaymentWindow(2026, "2026-07-21")).toBe("differimento");
    expect(classifyPaymentWindow(2026, "2026-08-20")).toBe("differimento"); // differimento incluso
    expect(classifyPaymentWindow(2026, "2026-08-21")).toBe("late");
  });

  it("anni senza proroga → null", () => {
    expect(classifyPaymentWindow(2025, "2025-06-30")).toBeNull();
    expect(classifyPaymentWindow(2027, "2027-07-15")).toBeNull();
  });
});

describe("nextWorkingDay — slittamento weekend/festivi (Fix F4)", () => {
  it("giorno feriale resta invariato", () => {
    expect(nextWorkingDay("2026-06-30")).toBe("2026-06-30"); // martedi'
  });
  it("sabato → lunedì successivo", () => {
    expect(nextWorkingDay("2026-05-16")).toBe("2026-05-18"); // sab → lun
  });
  it("domenica → lunedì successivo", () => {
    expect(nextWorkingDay("2025-11-30")).toBe("2025-12-01"); // dom → lun
  });
  it("salta la festività nazionale fissa (1° maggio → 2 maggio)", () => {
    // 01/05/2026 è venerdì ma festivo (Festa del Lavoro) → slitta a sab → lun 04/05
    expect(nextWorkingDay("2026-05-01")).toBe("2026-05-04");
  });
  it("riproduce gli ex-override 2025/2026/2027", () => {
    expect(nextWorkingDay("2025-02-16")).toBe("2025-02-17"); // dom
    expect(nextWorkingDay("2025-11-16")).toBe("2025-11-17"); // dom
    expect(nextWorkingDay("2026-05-16")).toBe("2026-05-18"); // sab
    expect(nextWorkingDay("2027-05-16")).toBe("2027-05-17"); // dom
  });
});

describe("generateScheduleEvents", () => {
  // --- Separata ---

  it("Separata — genera 2 eventi TAX con split 40/60", () => {
    // ricavi 30000, coeff 78%, aliquota 15% → imposta con deducibilità = 2594.94
    // calculateTaxAdvances(2594.94) → 2 rate: first=1037.98, second=1556.96
    const events = generateScheduleEvents("separata", 30000, 78, params2026, 15, 2026);

    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    expect(taxEvents).toHaveLength(2);
    expect(taxEvents[0].importo).toBe(1037.98);
    expect(taxEvents[0].dataScadenza).toBe("2026-07-20"); // proroga forfettari/ISA 2026
    expect(taxEvents[1].importo).toBe(1556.96);
    expect(taxEvents[1].dataScadenza).toBe("2026-11-30");
  });

  it("Separata — nessun INPS_FISSO o INPS_VARIABILE", () => {
    const events = generateScheduleEvents("separata", 30000, 78, params2026, 15, 2026);

    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    const inpsVar = events.filter((e: ScheduleEvent) => e.tipo === "INPS_VARIABILE");
    expect(inpsFisso).toHaveLength(0);
    expect(inpsVar).toHaveLength(0);
  });

  it("Separata con imposta bassa (≤ 51.65) → 0 eventi TAX", () => {
    // ricavi 200, coeff 78% → imponibile 156, INPS 40.67, netto 115.33, imposta 17.30
    // calculateTaxAdvances(17.30) → ≤ 51.65 → 0 acconti
    const events = generateScheduleEvents("separata", 200, 78, params2026, 15, 2026);

    expect(events).toHaveLength(0);
  });

  it("Separata con imposta media (≤ 257.52) → 1 evento a novembre", () => {
    // Serve imposta tra 51.66 e 257.52
    // ricavi ~1200, coeff 78% → imponibile 936, INPS=243.90, netto=692.10, imposta=103.82
    // Verifica: toCents(936)=93600, 93600*26.07/100=Math.round(24401.52)=24402→244.02
    // netto = 93600-24402 = 69198 → 691.98
    // imposta = Math.round(69198*15/100)=Math.round(10379.7)=10380 → 103.80
    // calculateTaxAdvances(103.80) → > 51.65, ≤ 257.52 → single=103.80, hasTwoPayments=false
    const events = generateScheduleEvents("separata", 1200, 78, params2026, 15, 2026);

    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    expect(taxEvents).toHaveLength(1);
    expect(taxEvents[0].dataScadenza).toBe("2026-11-30");
    expect(taxEvents[0].importo).toBe(103.80);
  });

  // --- Artigiani ---

  it("Artigiani — genera fino a 8 eventi (4 INPS_FISSO + 2 INPS_VARIABILE + 2 TAX)", () => {
    // ricavi 30000, coeff 78%, aliquota 15%, NO riduzione
    // rateFisse = [1130.34, 1130.34, 1130.34, 1130.34]
    // variabile = 1102.08 → split 50/50 = 551.04, 551.04
    // imposta = 2666.48 → TAX: first=1066.59, second=1599.89
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);

    expect(events).toHaveLength(8);

    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    expect(inpsFisso).toHaveLength(4);
    expect(inpsFisso[0].importo).toBe(1130.34);
    expect(inpsFisso[0].dataScadenza).toBe("2026-02-16");
    expect(inpsFisso[1].dataScadenza).toBe("2026-05-18");
    expect(inpsFisso[2].dataScadenza).toBe("2026-08-20");
    expect(inpsFisso[3].dataScadenza).toBe("2026-11-16");

    const inpsVar = events.filter((e: ScheduleEvent) => e.tipo === "INPS_VARIABILE");
    expect(inpsVar).toHaveLength(2);
    expect(inpsVar[0].importo).toBe(551.04);
    expect(inpsVar[0].dataScadenza).toBe("2026-07-20"); // proroga forfettari/ISA: variabile segue il termine IRPEF
    expect(inpsVar[1].importo).toBe(551.04);
    expect(inpsVar[1].dataScadenza).toBe("2026-11-30"); // Fix F3: variabile 2°acconto

    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    expect(taxEvents).toHaveLength(2);
    expect(taxEvents[0].importo).toBe(1066.59);
    expect(taxEvents[0].dataScadenza).toBe("2026-07-20"); // proroga forfettari/ISA 2026
    expect(taxEvents[1].importo).toBe(1599.89);
    expect(taxEvents[1].dataScadenza).toBe("2026-11-30");
  });

  it("Artigiani sotto minimale — 4 INPS_FISSO + 0 INPS_VARIABILE + 0 TAX", () => {
    // ricavi 5000, coeff 78% → imposta=0, variabile=0
    const events = generateScheduleEvents("artigiani", 5000, 78, params2026, 15, 2026, false);

    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    const inpsVar = events.filter((e: ScheduleEvent) => e.tipo === "INPS_VARIABILE");
    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");

    expect(inpsFisso).toHaveLength(4);
    expect(inpsVar).toHaveLength(0);
    expect(taxEvents).toHaveLength(0);
    expect(events).toHaveLength(4);
  });

  // --- Commercianti ---

  it("Commercianti — stesso pattern di Artigiani con numeri diversi", () => {
    // ricavi 30000, coeff 78%, aliquota 15%, NO riduzione
    // rateFisse = [1152.91, 1152.91, 1152.91, 1152.91]
    // variabile = 1124.12 → split 50/50 = 562.06, 562.06
    // imposta = 2649.64 → TAX: first=1059.86, second=1589.78
    // Verifica TAX split: toCents(2649.64)=264964, first=Math.round(264964*40/100)=Math.round(105985.6)=105986→1059.86
    // second=264964-105986=158978→1589.78
    // Verifica INPS_VAR split: toCents(1124.12)=112412, first=Math.round(112412*50/100)=56206→562.06
    // second=112412-56206=56206→562.06
    const events = generateScheduleEvents("commercianti", 30000, 78, params2026, 15, 2026, false);

    expect(events).toHaveLength(8);

    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    expect(inpsFisso).toHaveLength(4);
    expect(inpsFisso[0].importo).toBe(1152.91);

    const inpsVar = events.filter((e: ScheduleEvent) => e.tipo === "INPS_VARIABILE");
    expect(inpsVar).toHaveLength(2);
    expect(inpsVar[0].importo).toBe(562.06);
    expect(inpsVar[1].importo).toBe(562.06);

    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    expect(taxEvents).toHaveLength(2);
    expect(taxEvents[0].importo).toBe(1059.86);
    expect(taxEvents[1].importo).toBe(1589.78);
  });

  // --- Riduzione 35% ---

  it("Artigiani con riduzione 35% — rate fisse e variabile ridotti", () => {
    // ricavi 30000, coeff 78%, aliquota 15%, riduzione35=true
    // minimale ridotto = 2938.88, rateFisse = [734.72, 734.72, 734.72, 734.72]
    // variabile ridotto = 716.35 → split 50/50 = 358.18, 358.17
    // imposta = 2961.72 → TAX: first=1184.69, second=1777.03
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, true);

    expect(events).toHaveLength(8);

    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    expect(inpsFisso).toHaveLength(4);
    expect(inpsFisso[0].importo).toBe(734.72);

    const inpsVar = events.filter((e: ScheduleEvent) => e.tipo === "INPS_VARIABILE");
    expect(inpsVar).toHaveLength(2);
    expect(inpsVar[0].importo).toBe(358.18);
    expect(inpsVar[1].importo).toBe(358.17);

    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    expect(taxEvents).toHaveLength(2);
    expect(taxEvents[0].importo).toBe(1184.69);
    expect(taxEvents[1].importo).toBe(1777.03);

    // Invariante: somma INPS_FISSO = minimale ridotto
    const sommaFisso = sumMoney(...inpsFisso.map((e: ScheduleEvent) => e.importo));
    expect(sommaFisso).toBe(2938.88);
  });

  it("Artigiani con riduzione 50% — rate fisse e variabile IVS-only", () => {
    // ricavi 30000, coeff 78%, aliquota 15%, riduzione50=true
    // minimale rid50 = 2264.40, rateFisse = splitWithRemainder(2264.40, [25,25,25,25]) = [566.10, 566.10, 566.10, 566.10]
    // variabile rid50 = 551.04 → split 50/50 = 275.52, 275.52
    // imposta = 3087.68 → TAX: first=1235.07, second=1852.61
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false, true);

    expect(events).toHaveLength(8);

    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    expect(inpsFisso).toHaveLength(4);
    // Invariante: somma INPS_FISSO = minimale rid50
    const sommaFisso = sumMoney(...inpsFisso.map((e: ScheduleEvent) => e.importo));
    expect(sommaFisso).toBe(2264.40);

    const inpsVar = events.filter((e: ScheduleEvent) => e.tipo === "INPS_VARIABILE");
    expect(inpsVar).toHaveLength(2);
    expect(sumMoney(inpsVar[0].importo, inpsVar[1].importo)).toBe(551.04);

    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    expect(taxEvents).toHaveLength(2);
    expect(taxEvents[0].importo).toBe(1235.07);
    expect(taxEvents[1].importo).toBe(1852.61);
  });

  it("Separata con riduzione35=true — parametro innocuo, risultato identico", () => {
    // Separata ignora riduzione35 — il risultato deve essere identico a riduzione35=false
    const eventsSenza = generateScheduleEvents("separata", 30000, 78, params2026, 15, 2026, false);
    const eventsCon = generateScheduleEvents("separata", 30000, 78, params2026, 15, 2026, true);

    expect(eventsCon).toHaveLength(eventsSenza.length);
    for (let i = 0; i < eventsSenza.length; i++) {
      expect(eventsCon[i].tipo).toBe(eventsSenza[i].tipo);
      expect(eventsCon[i].importo).toBe(eventsSenza[i].importo);
      expect(eventsCon[i].dataScadenza).toBe(eventsSenza[i].dataScadenza);
    }
  });

  // --- Invarianti ---

  it("invariante: somma INPS_FISSO = minimale per Artigiani", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);
    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    const sommaFisso = sumMoney(...inpsFisso.map((e: ScheduleEvent) => e.importo));

    expect(checkBreakdownEquals(4521.36, inpsFisso.map((e: ScheduleEvent) => e.importo))).toBe(true);
    expect(sommaFisso).toBe(4521.36);
  });

  it("invariante: somma INPS_FISSO = minimale per Commercianti", () => {
    const events = generateScheduleEvents("commercianti", 30000, 78, params2026, 15, 2026, false);
    const inpsFisso = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO");
    const sommaFisso = sumMoney(...inpsFisso.map((e: ScheduleEvent) => e.importo));

    expect(checkBreakdownEquals(4611.64, inpsFisso.map((e: ScheduleEvent) => e.importo))).toBe(true);
    expect(sommaFisso).toBe(4611.64);
  });

  it("invariante: somma INPS (FISSO + VARIABILE) = contributiINPS totali per Artigiani", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);
    const inpsAll = events.filter((e: ScheduleEvent) => e.tipo === "INPS_FISSO" || e.tipo === "INPS_VARIABILE");
    const sommaINPS = sumMoney(...inpsAll.map((e: ScheduleEvent) => e.importo));

    // contributiINPS totali = 5623.44
    expect(checkBreakdownEquals(5623.44, inpsAll.map((e: ScheduleEvent) => e.importo))).toBe(true);
    expect(sommaINPS).toBe(5623.44);
  });

  it("invariante: somma TAX = imposta totale per Separata", () => {
    const events = generateScheduleEvents("separata", 30000, 78, params2026, 15, 2026);
    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    const sommaTax = sumMoney(...taxEvents.map((e: ScheduleEvent) => e.importo));

    // imposta con deducibilità = 2594.94
    expect(checkBreakdownEquals(2594.94, taxEvents.map((e: ScheduleEvent) => e.importo))).toBe(true);
    expect(sommaTax).toBe(2594.94);
  });

  it("invariante: somma TAX = imposta totale per Artigiani", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);
    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    const sommaTax = sumMoney(...taxEvents.map((e: ScheduleEvent) => e.importo));

    // imposta = 2666.48
    expect(checkBreakdownEquals(2666.48, taxEvents.map((e: ScheduleEvent) => e.importo))).toBe(true);
    expect(sommaTax).toBe(2666.48);
  });

  it("invariante: somma TAX = imposta totale per Commercianti", () => {
    const events = generateScheduleEvents("commercianti", 30000, 78, params2026, 15, 2026, false);
    const taxEvents = events.filter((e: ScheduleEvent) => e.tipo === "TAX");
    const sommaTax = sumMoney(...taxEvents.map((e: ScheduleEvent) => e.importo));

    // imposta = 2649.64
    expect(checkBreakdownEquals(2649.64, taxEvents.map((e: ScheduleEvent) => e.importo))).toBe(true);
    expect(sommaTax).toBe(2649.64);
  });

  // --- Stato e formato date ---

  it("tutti gli eventi hanno stato non_pagato", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);

    for (const event of events) {
      expect(event.stato).toBe("non_pagato");
    }
  });

  it("tutte le date sono formato ISO YYYY-MM-DD nell'anno fiscale corretto", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);

    for (const event of events) {
      expect(event.dataScadenza).toMatch(/^2026-\d{2}-\d{2}$/);
    }
  });

  it("ogni evento ha una descrizione non vuota", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);

    for (const event of events) {
      expect(event.descrizione).toBeTruthy();
      expect(event.descrizione.length).toBeGreaterThan(0);
    }
  });

  it("gli eventi sono ordinati per data crescente", () => {
    const events = generateScheduleEvents("artigiani", 30000, 78, params2026, 15, 2026, false);

    for (let i = 1; i < events.length; i++) {
      expect(events[i].dataScadenza >= events[i - 1].dataScadenza).toBe(true);
    }
  });
});

// ========== Story 1.7 — calcPipelineCompleto ==========

describe("calcPipelineCompleto", () => {
  // --- Test 3.1: Regressione Separata ---
  it("Separata — spendibile coerente con formula corretta (con deducibilità)", () => {
    const input: PipelineInput = {
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
    };
    const result = calcPipelineCompleto(input);

    // Valori da calcTotaleMultiGestione verificati in Story 1.5
    expect(result.gestione).toBe("separata");
    expect(result.annoFiscale).toBe(2026);
    expect(result.imponibileLordo).toBe(23400);
    expect(result.contributiINPS).toBe(6100.38);
    expect(result.imponibileNetto).toBe(17299.62);
    expect(result.imposta).toBe(2594.94);
    expect(result.totaleAccantonamento).toBe(8695.32);

    // Spendibile = max(0, 30000 - 8695.32) = 21304.68
    expect(result.spendibile).toBe(21304.68);

    // daCopertura = 0 per Separata
    expect(result.daCopertura).toBe(0);

    // Schedule events presenti (2 TAX per Separata)
    expect(result.scheduleEvents.length).toBe(2);

    // Breakdown: 3 voci (ricavi + INPS + imposta)
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown[0]).toEqual({ voce: "Ricavi lordi", importo: 30000, tipo: "entrata" });
    expect(result.breakdown[1]).toEqual({ voce: "INPS Gestione Separata", importo: 6100.38, tipo: "uscita" });
    expect(result.breakdown[2]).toEqual({ voce: "Imposta sostitutiva", importo: 2594.94, tipo: "uscita" });
  });

  // --- Test 3.2: Artigiani sopra minimale ---
  it("Artigiani sopra minimale — spendibile, daCopertura, breakdown", () => {
    const input: PipelineInput = {
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
    };
    const result = calcPipelineCompleto(input);

    expect(result.gestione).toBe("artigiani");
    expect(result.contributiINPS).toBe(5623.44);
    expect(result.imposta).toBe(2666.48);
    expect(result.totaleAccantonamento).toBe(8289.92);

    // Spendibile = max(0, 30000 - 8289.92) = 21710.08
    expect(result.spendibile).toBe(21710.08);

    // daCopertura senza pagamenti = somma di tutti gli schedule events
    const sommaEvents = sumMoney(...result.scheduleEvents.map(e => e.importo));
    expect(result.daCopertura).toBe(sommaEvents);

    // Schedule events: 4 INPS_FISSO + 2 INPS_VARIABILE + 2 TAX = 8
    expect(result.scheduleEvents).toHaveLength(8);

    // Breakdown: 4 voci (ricavi + INPS fisso + INPS variabile + imposta)
    expect(result.breakdown).toHaveLength(4);
    expect(result.breakdown[0].voce).toBe("Ricavi lordi");
    expect(result.breakdown[0].tipo).toBe("entrata");
    expect(result.breakdown[1].voce).toBe("INPS fisso (minimale)");
    expect(result.breakdown[1].importo).toBe(4521.36); // minimale artigiani
    expect(result.breakdown[2].voce).toBe("INPS variabile");
    expect(result.breakdown[2].importo).toBe(1102.08); // 5623.44 - 4521.36
    expect(result.breakdown[3].voce).toBe("Imposta sostitutiva");
    expect(result.breakdown[3].importo).toBe(2666.48);
  });

  // --- Test 3.3: Artigiani sotto minimale ---
  it("Artigiani sotto minimale — minimale dovuto, imposta 0, daCopertura = minimale", () => {
    const input: PipelineInput = {
      ricaviLordi: 5000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
    };
    const result = calcPipelineCompleto(input);

    expect(result.imponibileLordo).toBe(3900);
    expect(result.contributiINPS).toBe(4521.36); // minimale intero
    expect(result.imposta).toBe(0); // INPS > imponibile → netto = 0
    expect(result.totaleAccantonamento).toBe(4521.36);

    // Spendibile = max(0, 5000 - 4521.36) = 478.64
    expect(result.spendibile).toBe(478.64);

    // imposta 0 → nessun acconto TAX, variabile 0 → nessun INPS_VARIABILE
    // Solo 4 INPS_FISSO = 4521.36
    expect(result.scheduleEvents).toHaveLength(4);
    expect(result.daCopertura).toBe(4521.36);

    // Breakdown: ricavi + INPS fisso + INPS variabile (0) + imposta
    expect(result.breakdown).toHaveLength(4);
    expect(result.breakdown[2].voce).toBe("INPS variabile");
    expect(result.breakdown[2].importo).toBe(0);
  });

  // --- Test 3.4: Commercianti con riduzione 35% ---
  it("Commercianti con riduzione 35% — importi ridotti nel breakdown", () => {
    const input: PipelineInput = {
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "commercianti",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: true,
    };
    const result = calcPipelineCompleto(input);

    // minimale ridotto = multiplyByPercent(4611.64, 65) = 2997.57
    // variabile ridotto = multiplyByPercent(1124.12, 65) = 730.68
    // totale INPS = 3728.25
    expect(result.contributiINPS).toBe(3728.25);

    // imponibileNetto = 23400 - 3728.25 = 19671.75
    expect(result.imponibileNetto).toBe(19671.75);

    // imposta = multiplyByPercent(19671.75, 15) = 2950.76
    expect(result.imposta).toBe(2950.76);

    // totaleAccantonamento = 2950.76 + 3728.25 = 6679.01
    expect(result.totaleAccantonamento).toBe(6679.01);

    // Spendibile = max(0, 30000 - 6679.01) = 23320.99
    expect(result.spendibile).toBe(23320.99);

    // Breakdown: commercianti ha fisso (minimale) + variabile + imposta
    expect(result.breakdown[1].voce).toBe("INPS fisso (minimale)");
    expect(result.breakdown[1].importo).toBe(2997.57); // minimale ridotto
    expect(result.breakdown[2].voce).toBe("INPS variabile");
    expect(result.breakdown[2].importo).toBe(730.68); // variabile ridotto
  });

  // --- Test 3.4b: Artigiani con riduzione 50% ---
  it("Artigiani con riduzione 50% — breakdown con importi IVS-only", () => {
    const input: PipelineInput = {
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione50Attiva: true,
    };
    const result = calcPipelineCompleto(input);

    // minimale rid50 = 2264.40, variabile rid50 = 551.04, totaleINPS = 2815.44
    expect(result.contributiINPS).toBe(2815.44);
    expect(result.imposta).toBe(3087.68);
    expect(result.totaleAccantonamento).toBe(5903.12);
    expect(result.spendibile).toBe(24096.88);

    expect(result.breakdown[1].importo).toBe(2264.40); // minimale rid50
    expect(result.breakdown[2].importo).toBe(551.04);  // variabile rid50
  });

  // --- Test 3.4c: Mutual exclusivity end-to-end ---
  it("mutual exclusivity pipeline: rid35+rid50 → rid50 prevale", () => {
    const soloRid50: PipelineInput = {
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione50Attiva: true,
    };
    const entrambe: PipelineInput = {
      ...soloRid50,
      riduzione35Attiva: true,
      riduzione50Attiva: true,
    };

    const r1 = calcPipelineCompleto(soloRid50);
    const r2 = calcPipelineCompleto(entrambe);

    expect(r2.contributiINPS).toBe(r1.contributiINPS);
    expect(r2.imposta).toBe(r1.imposta);
    expect(r2.spendibile).toBe(r1.spendibile);
  });

  // --- Test 3.5: Invarianti ---
  it("invariante: somma uscite breakdown = totaleAccantonamento", () => {
    const gestioni: Array<{ gestione: "separata" | "artigiani" | "commercianti"; rid35: boolean }> = [
      { gestione: "separata", rid35: false },
      { gestione: "artigiani", rid35: false },
      { gestione: "artigiani", rid35: true },
      { gestione: "commercianti", rid35: false },
      { gestione: "commercianti", rid35: true },
    ];

    for (const { gestione, rid35 } of gestioni) {
      const result = calcPipelineCompleto({
        ricaviLordi: 30000,
        coefficienteRedditivita: 78,
        gestione,
        params: params2026,
        aliquotaSostitutiva: 15,
        annoFiscale: 2026,
        riduzione35Attiva: rid35,
      });

      const uscite = result.breakdown.filter((v: BreakdownVoce) => v.tipo === "uscita");
      const sommaUscite = sumMoney(...uscite.map((v: BreakdownVoce) => v.importo));
      expect(checkBreakdownEquals(result.totaleAccantonamento, uscite.map((v: BreakdownVoce) => v.importo))).toBe(true);
      expect(sommaUscite).toBe(result.totaleAccantonamento);
    }
  });

  it("invariante: scheduleEvents coerenti con breakdown", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
    });

    // Somma TAX events = imposta
    const taxEvents = result.scheduleEvents.filter(e => e.tipo === "TAX");
    const sommaTax = sumMoney(...taxEvents.map(e => e.importo));
    expect(checkBreakdownEquals(result.imposta, taxEvents.map(e => e.importo))).toBe(true);

    // Somma INPS events = contributiINPS
    const inpsEvents = result.scheduleEvents.filter(e => e.tipo === "INPS_FISSO" || e.tipo === "INPS_VARIABILE");
    const sommaINPS = sumMoney(...inpsEvents.map(e => e.importo));
    expect(checkBreakdownEquals(result.contributiINPS, inpsEvents.map(e => e.importo))).toBe(true);
  });

  // --- Test daCopertura con pagamenti parziali (valori assoluti calcolati a mano) ---
  it("daCopertura ridotto con pagamenti parziali — valori assoluti", () => {
    // Artigiani ricavi 30000, coeff 78%, aliquota 15%, NO riduzione
    // 8 events: INPS_FISSO 1130.34×4 + INPS_VAR 551.04×2 + TAX 1066.59 + 1599.89
    // totaleObblighi = 4521.36 + 1102.08 + 2666.48 = 8289.92
    // pagato = 1130.34 + 1130.34 = 2260.68
    // daCopertura = 8289.92 - 2260.68 = 6029.24
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
      pagamentiEffettuati: [
        { tipo: "INPS_FISSO", dataScadenza: "2026-02-16", importoPagato: 1130.34 },
        { tipo: "INPS_FISSO", dataScadenza: "2026-05-18", importoPagato: 1130.34 },
      ],
    });

    expect(result.daCopertura).toBe(6029.24);
  });

  // --- Pagamenti duplicati: lo stesso evento non viene "speso" due volte ---
  it("daCopertura — pagamenti duplicati non gonfiano il totalePagato", () => {
    // Due pagamenti identici per lo stesso evento INPS_FISSO Q1
    // Solo il primo deve matchare, il secondo viene ignorato
    // totalePagato = 1130.34 (non 2260.68)
    // daCopertura = 8289.92 - 1130.34 = 7159.58
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
      pagamentiEffettuati: [
        { tipo: "INPS_FISSO", dataScadenza: "2026-02-16", importoPagato: 1130.34 },
        { tipo: "INPS_FISSO", dataScadenza: "2026-02-16", importoPagato: 1130.34 }, // duplicato
      ],
    });

    expect(result.daCopertura).toBe(7159.58);
  });

  // --- Pagamenti con importo negativo ignorati ---
  it("daCopertura — pagamenti con importo ≤ 0 sono ignorati", () => {
    const senzaPagamenti = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
    });

    const conPagamentoNegativo = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
      pagamentiEffettuati: [
        { tipo: "INPS_FISSO", dataScadenza: "2026-02-16", importoPagato: -500 },
      ],
    });

    expect(conPagamentoNegativo.daCopertura).toBe(senzaPagamenti.daCopertura);
  });

  // --- daCopertura per Separata = 0 sempre ---
  it("daCopertura per Separata è sempre 0 anche con pagamenti", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      pagamentiEffettuati: [
        { tipo: "TAX", dataScadenza: "2026-06-16", importoPagato: 500 },
      ],
    });
    expect(result.daCopertura).toBe(0);
  });

  // --- Performance ---
  it("performance: 1000 invocazioni < 100ms", () => {
    const input: PipelineInput = {
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calcPipelineCompleto(input);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  // --- Ricavi zero ---
  it("ricavi zero — spendibile 0, daCopertura = minimale per Art/Comm", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 0,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      riduzione35Attiva: false,
    });

    expect(result.spendibile).toBe(0);
    expect(result.contributiINPS).toBe(4521.36); // minimale dovuto anche senza ricavi
    expect(result.imposta).toBe(0);
    expect(result.daCopertura).toBe(4521.36);
  });

  // --- Divergenza consapevole da formula V1 (NFR15) ---
  it("Separata — divergenza intenzionale da V1: pipeline applica deducibilità INPS", () => {
    // La V1 (useFiscalCalculations) calcola:
    //   totalWithholding = imposta_senza_deducibilita + INPS = 3510 + 6100.38 = 9610.38
    // La pipeline 1.7 calcola con deducibilità:
    //   totaleAccantonamento = imposta_con_deducibilita + INPS = 2594.94 + 6100.38 = 8695.32
    //
    // Questa è una CORREZIONE della V1, non una regressione.
    // La V1 non applicava la deducibilità INPS, producendo un accantonamento più alto.
    // Il valore corretto (con deducibilità) è 8695.32, che è inferiore a 9610.38.
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
    });

    // Formula V1 (senza deducibilità): imposta = 23400 × 15% = 3510
    const impostaV1 = 3510.00;
    const totalWithholdingV1 = sumMoney(impostaV1, 6100.38); // 9610.38

    // Pipeline 1.7 (con deducibilità): imposta = (23400 - 6100.38) × 15% = 2594.94
    expect(result.imposta).toBe(2594.94);
    expect(result.totaleAccantonamento).toBe(8695.32);

    // La pipeline produce un accantonamento PIÙ BASSO della V1 (correzione)
    expect(result.totaleAccantonamento).toBeLessThan(totalWithholdingV1);

    // La differenza è esattamente: deducibilità × aliquota = 6100.38 × 15% = 915.06
    // 9610.38 - 8695.32 = 915.06
    const deltaV1 = subtractMoney(totalWithholdingV1, result.totaleAccantonamento);
    expect(deltaV1).toBe(915.06);
  });
});

// ========== Story 1.8 — Logica Acconti Cross-Anno e Primo Anno di Attività ==========

describe("calcAccontiAnnoSuccessivo", () => {
  // --- Test 4.1: Primo anno → tutti zero ---
  it("primo anno di attività → zero acconti", () => {
    const input: AccontiInput = {
      ricaviLordiAnnoN: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: true,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    expect(result.totaleAccontiImposta).toBe(0);
    expect(result.totaleAccontiINPS).toBe(0);
    expect(result.totaleAcconti).toBe(0);
    expect(result.accontoImpostaGiugno).toBe(0);
    expect(result.accontoImpostaNovembre).toBe(0);
    expect(result.impostaHasDueRate).toBe(false);
    expect(result.accontoINPSGiugno).toBe(0);
    expect(result.accontoINPSNovembre).toBe(0);
  });

  it("primo anno → zero acconti anche per Artigiani con ricavi alti", () => {
    const input: AccontiInput = {
      ricaviLordiAnnoN: 100000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: true,
      riduzione35Attiva: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    expect(result.totaleAcconti).toBe(0);
  });

  // --- Test 4.2: Separata secondo anno ---
  it("Separata secondo anno — acconti imposta + acconti INPS corretti", () => {
    // ricavi=30000, coeff=78%, aliq=15%
    // imponibile=23400, INPS=6100.38, impNetto=17299.62, imposta=2594.94
    // acconti imposta: total=2594.94, first=1037.98, second=1556.96 (2 rate)
    // acconti INPS: 80% di 6100.38=4880.30, first=2440.15, second=2440.15
    const input: AccontiInput = {
      ricaviLordiAnnoN: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    // Acconti imposta
    expect(result.totaleAccontiImposta).toBe(2594.94);
    expect(result.accontoImpostaGiugno).toBe(1037.98);
    expect(result.accontoImpostaNovembre).toBe(1556.96);
    expect(result.impostaHasDueRate).toBe(true);

    // Acconti INPS (80% del totale INPS Separata, split 50/50)
    expect(result.totaleAccontiINPS).toBe(4880.30);
    expect(result.accontoINPSGiugno).toBe(2440.15);
    expect(result.accontoINPSNovembre).toBe(2440.15);

    // Totale
    expect(result.totaleAcconti).toBe(7475.24);
  });

  // --- Test 4.3: Artigiani sopra minimale ---
  it("Artigiani sopra minimale — acconti imposta + acconti INPS variabile", () => {
    // ricavi=30000, coeff=78%, aliq=15%
    // imponibile=23400, minimale=4521.36, variabile=1102.08, totINPS=5623.44
    // imposta con deduc: (23400-5623.44)*15%=2666.48
    // acconti imposta: total=2666.48, first=1066.59, second=1599.89 (2 rate)
    // acconti INPS (solo variabile): 80% di 1102.08=881.66, first=440.83, second=440.83
    const input: AccontiInput = {
      ricaviLordiAnnoN: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
      riduzione35Attiva: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    // Acconti imposta
    expect(result.totaleAccontiImposta).toBe(2666.48);
    expect(result.accontoImpostaGiugno).toBe(1066.59);
    expect(result.accontoImpostaNovembre).toBe(1599.89);
    expect(result.impostaHasDueRate).toBe(true);

    // Acconti INPS (solo variabile, NON minimale)
    expect(result.totaleAccontiINPS).toBe(881.66);
    expect(result.accontoINPSGiugno).toBe(440.83);
    expect(result.accontoINPSNovembre).toBe(440.83);

    // Totale
    expect(result.totaleAcconti).toBe(3548.14);
  });

  // --- Test 4.4: Artigiani sotto minimale → zero variabile INPS ---
  it("Artigiani sotto minimale — acconti imposta + zero variabile INPS", () => {
    // ricavi=10000, coeff=78%, imponibile=7800 < reddMinimale(18808) → variabile=0
    // totINPS=4521.36 (solo minimale), impNetto=max(0, 7800-4521.36)=3278.64
    // imposta=3278.64*15%=491.80
    // acconti imposta: 491.80 > 257.52 → split40/60: first=196.72, second=295.08
    // acconti INPS: variabile=0 → zero
    const input: AccontiInput = {
      ricaviLordiAnnoN: 10000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
      riduzione35Attiva: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    // Acconti imposta
    expect(result.totaleAccontiImposta).toBe(491.80);
    expect(result.accontoImpostaGiugno).toBe(196.72);
    expect(result.accontoImpostaNovembre).toBe(295.08);
    expect(result.impostaHasDueRate).toBe(true);

    // Acconti INPS: zero (variabile = 0)
    expect(result.totaleAccontiINPS).toBe(0);
    expect(result.accontoINPSGiugno).toBe(0);
    expect(result.accontoINPSNovembre).toBe(0);

    // Totale = solo acconti imposta
    expect(result.totaleAcconti).toBe(491.80);
  });

  // --- Test 4.5: Commercianti con riduzione 35% ---
  it("Commercianti con riduzione 35% — importi ridotti", () => {
    // ricavi=30000, coeff=78%, imponibile=23400
    // minimale rid35 = 2997.57, variabile rid35 = 730.68, totINPS = 3728.25
    // imposta = (23400-3728.25)*15% = 2950.76
    // acconti imposta: total=2950.76, first=1180.30, second=1770.46 (2 rate)
    // acconti INPS (variabile): 80% di 730.68 = 584.54, first=292.27, second=292.27
    const input: AccontiInput = {
      ricaviLordiAnnoN: 30000,
      coefficienteRedditivita: 78,
      gestione: "commercianti",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
      riduzione35Attiva: true,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    // Acconti imposta
    expect(result.totaleAccontiImposta).toBe(2950.76);
    expect(result.accontoImpostaGiugno).toBe(1180.30);
    expect(result.accontoImpostaNovembre).toBe(1770.46);
    expect(result.impostaHasDueRate).toBe(true);

    // Acconti INPS (variabile ridotto)
    expect(result.totaleAccontiINPS).toBe(584.54);
    expect(result.accontoINPSGiugno).toBe(292.27);
    expect(result.accontoINPSNovembre).toBe(292.27);

    // Totale
    expect(result.totaleAcconti).toBe(3535.30);
  });

  // --- Test 4.5b: Artigiani con riduzione 50% ---
  it("Artigiani con riduzione 50% — acconti ridotti", () => {
    // INPS rid50: minimale 2264.40, variabile 551.04, totale 2815.44
    // imposta = (23400 - 2815.44) * 15% = 3087.68
    // acconti imposta: 3087.68, first=1235.07, second=1852.61
    // acconti INPS (variabile): 80% di 551.04 = 440.83, first=220.42 (ceil), second=220.41 (floor)
    const input: AccontiInput = {
      ricaviLordiAnnoN: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
      riduzione50Attiva: true,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    expect(result.totaleAccontiImposta).toBe(3087.68);
    expect(result.impostaHasDueRate).toBe(true);
    expect(result.accontoImpostaGiugno).toBe(1235.07);
    expect(result.accontoImpostaNovembre).toBe(1852.61);

    // Acconti INPS variabile ridotto: 80% di 551.04 = 440.83, split 50/50
    expect(result.totaleAccontiINPS).toBe(440.83);
    expect(result.accontoINPSGiugno).toBe(220.42);
    expect(result.accontoINPSNovembre).toBe(220.41);

    expect(result.totaleAcconti).toBe(sumMoney(3087.68, 440.83));
  });

  // --- Test 4.6: Soglia esenzione imposta (≤ €51.65 → zero acconti imposta) ---
  it("soglia esenzione imposta — imposta ≤ 51.65 → zero acconti imposta", () => {
    // ricavi=597, coeff=78%, aliq=15% → imposta=51.64 → sotto soglia 51.65
    // acconti imposta = 0
    // acconti INPS Separata: 80% di INPS × 50/50
    const input: AccontiInput = {
      ricaviLordiAnnoN: 597,
      coefficienteRedditivita: 78,
      gestione: "separata",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    // Zero acconti imposta
    expect(result.totaleAccontiImposta).toBe(0);
    expect(result.accontoImpostaGiugno).toBe(0);
    expect(result.accontoImpostaNovembre).toBe(0);
    expect(result.impostaHasDueRate).toBe(false);

    // Acconti INPS comunque calcolati (INPS esiste anche con ricavi bassi)
    expect(result.totaleAccontiINPS).toBeGreaterThan(0);

    // Totale = solo acconti INPS
    expect(result.totaleAcconti).toBe(result.totaleAccontiINPS);
  });

  // --- Test 4.7: Invarianti somma componenti ---
  it("invariante: totaleAcconti = totaleAccontiImposta + totaleAccontiINPS per tutte le gestioni", () => {
    const scenari: AccontiInput[] = [
      {
        ricaviLordiAnnoN: 30000, coefficienteRedditivita: 78, gestione: "separata",
        paramsAnnoN: params2026, aliquotaSostitutiva: 15, primoAnno: false,
      },
      {
        ricaviLordiAnnoN: 30000, coefficienteRedditivita: 78, gestione: "artigiani",
        paramsAnnoN: params2026, aliquotaSostitutiva: 15, primoAnno: false,
      },
      {
        ricaviLordiAnnoN: 30000, coefficienteRedditivita: 78, gestione: "commercianti",
        paramsAnnoN: params2026, aliquotaSostitutiva: 15, primoAnno: false, riduzione35Attiva: true,
      },
      {
        ricaviLordiAnnoN: 10000, coefficienteRedditivita: 78, gestione: "artigiani",
        paramsAnnoN: params2026, aliquotaSostitutiva: 15, primoAnno: false,
      },
      {
        ricaviLordiAnnoN: 30000, coefficienteRedditivita: 78, gestione: "separata",
        paramsAnnoN: params2026, aliquotaSostitutiva: 5, primoAnno: false,
      },
    ];

    for (const input of scenari) {
      const result = calcAccontiAnnoSuccessivo(input);
      const sommaParts = sumMoney(result.totaleAccontiImposta, result.totaleAccontiINPS);
      expect(sommaParts).toBe(result.totaleAcconti);

      // Invariante dettaglio imposta
      const sommaDettaglioImposta = sumMoney(result.accontoImpostaGiugno, result.accontoImpostaNovembre);
      expect(sommaDettaglioImposta).toBe(result.totaleAccontiImposta);

      // Invariante dettaglio INPS
      expect(checkBreakdownEquals(result.totaleAccontiINPS, [result.accontoINPSGiugno, result.accontoINPSNovembre])).toBe(true);
    }
  });

  // --- Test review fix: Unica rata imposta (51.65 < imposta ≤ 257.52) ---
  it("unica rata imposta — importo tra 51.65 e 257.52 → solo novembre, giugno = 0", () => {
    // ricavi=2000, coeff=78%, aliq=15%, separata
    // imponibile=1560, INPS=406.69, netto=1153.31, imposta=173.00
    // 51.65 < 173.00 ≤ 257.52 → unica rata a novembre
    // acconti INPS: 80% di 406.69=325.35, first=162.68, second=162.67
    const input: AccontiInput = {
      ricaviLordiAnnoN: 2000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    // Unica rata: giugno=0, novembre=importo pieno
    expect(result.totaleAccontiImposta).toBe(173.00);
    expect(result.accontoImpostaGiugno).toBe(0);
    expect(result.accontoImpostaNovembre).toBe(173.00);
    expect(result.impostaHasDueRate).toBe(false);

    // INPS comunque calcolati
    expect(result.totaleAccontiINPS).toBe(325.35);
    expect(result.accontoINPSGiugno).toBe(162.68);
    expect(result.accontoINPSNovembre).toBe(162.67);

    // Totale
    expect(result.totaleAcconti).toBe(498.35);
  });

  // --- Test review fix: Ricavi negativi → zero acconti ---
  it("ricavi negativi → zero acconti (difesa input)", () => {
    const input: AccontiInput = {
      ricaviLordiAnnoN: -5000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    expect(result.totaleAcconti).toBe(0);
    expect(result.totaleAccontiImposta).toBe(0);
    expect(result.totaleAccontiINPS).toBe(0);
  });

  it("ricavi zero → zero acconti", () => {
    const input: AccontiInput = {
      ricaviLordiAnnoN: 0,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      paramsAnnoN: params2026,
      aliquotaSostitutiva: 15,
      primoAnno: false,
    };
    const result = calcAccontiAnnoSuccessivo(input);

    expect(result.totaleAcconti).toBe(0);
  });

  // --- Test 4.8: Backward compatibility pipeline ---
  it("backward compatibility: calcPipelineCompleto senza paramsAnnoSuccessivo → accontiAnnoSuccessivo = undefined", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
    });

    expect(result.accontiAnnoSuccessivo).toBeUndefined();

    // Tutti i campi esistenti devono funzionare come prima
    expect(result.imposta).toBe(2594.94);
    expect(result.contributiINPS).toBe(6100.38);
    expect(result.totaleAccantonamento).toBe(8695.32);
    expect(result.spendibile).toBe(21304.68);
  });

  it("calcPipelineCompleto con paramsAnnoSuccessivo → accontiAnnoSuccessivo calcolati", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "separata",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      paramsAnnoSuccessivo: params2026, // usa stessi params per semplicità
    });

    expect(result.accontiAnnoSuccessivo).toBeDefined();
    expect(result.accontiAnnoSuccessivo!.totaleAccontiImposta).toBe(2594.94);
    expect(result.accontiAnnoSuccessivo!.totaleAccontiINPS).toBe(4880.30);
    expect(result.accontiAnnoSuccessivo!.totaleAcconti).toBe(7475.24);

    // I campi esistenti NON devono cambiare
    expect(result.imposta).toBe(2594.94);
    expect(result.contributiINPS).toBe(6100.38);
    expect(result.totaleAccantonamento).toBe(8695.32);
    expect(result.spendibile).toBe(21304.68);
  });

  it("calcPipelineCompleto con primoAnno=true → accontiAnnoSuccessivo zero", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 30000,
      coefficienteRedditivita: 78,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 15,
      annoFiscale: 2026,
      paramsAnnoSuccessivo: params2026,
      primoAnno: true,
    });

    expect(result.accontiAnnoSuccessivo).toBeDefined();
    expect(result.accontiAnnoSuccessivo!.totaleAcconti).toBe(0);
    expect(result.accontiAnnoSuccessivo!.totaleAccontiImposta).toBe(0);
    expect(result.accontiAnnoSuccessivo!.totaleAccontiINPS).toBe(0);
  });
});

// ─── Scenario post artigiani 2026 — sotto il minimale ─────────────────────
// Circolare INPS n.14 del 9 febbraio 2026:
// Il contributo INPS artigiani NON si calcola come % sull'imponibile quando questo
// e' sotto il reddito minimale (18.808€). E' il fisso del minimale che scatta comunque,
// anche con fatturato zero. La riduzione 35% forfettari si applica sia al fisso
// sia al variabile. Questo test blinda il calcolo contro regressioni.
describe("[scenario post 2026] Artigiano forfettario — imponibile < minimale con riduzione 35%", () => {
  // Parametri 2026 confermati: minimale_artigiani 4.521,36€ / reddito_minimale 18.808€.

  it("artigiano 10k, coeff 40%, aliquota 5%, riduz35: INPS = 2.938,88€ fisso, variabile = 0", () => {
    // 10.000 × 40% = 4.000€ di imponibile, ben sotto il minimale 18.808€.
    // Fisso = 4.521,36 × 65% = 2.938,88€. Variabile = 0 (nessuna eccedenza).
    const result = calcINPSArtigiani(4000, params2026, true, false);

    expect(result.minimaleAnnuo).toBe(2938.88);
    expect(result.variabile).toBe(0);
    expect(result.totale).toBe(2938.88);
    expect(result.riduzione35Applicata).toBe(true);
    expect(result.riduzione50Applicata).toBe(false);
  });

  it("artigiano fatturato 0€ con riduz35: INPS fisso scatta comunque a 2.938,88€", () => {
    // Il punto chiave del post: paghi il minimale anche a zero incassi.
    const result = calcINPSArtigiani(0, params2026, true, false);

    expect(result.minimaleAnnuo).toBe(2938.88);
    expect(result.variabile).toBe(0);
    expect(result.totale).toBe(2938.88);
  });

  it("artigiano 10k, coeff 40%, aliquota 5%, riduz35 — pipeline completo: spendibile = 7.008,06€", () => {
    const result = calcPipelineCompleto({
      ricaviLordi: 10000,
      coefficienteRedditivita: 40,
      gestione: "artigiani",
      params: params2026,
      aliquotaSostitutiva: 5,
      annoFiscale: 2026,
      riduzione35Attiva: true,
      riduzione50Attiva: false,
    });

    // Imponibile lordo = 10.000 × 40% = 4.000
    expect(result.imponibileLordo).toBe(4000);
    // INPS fisso totale = 2.938,88 (nessun variabile perche' sotto minimale)
    expect(result.contributiINPS).toBe(2938.88);
    // Imponibile netto con deducibilita' INPS = max(0, 4000 - 2938.88) = 1.061,12
    expect(result.imponibileNetto).toBe(1061.12);
    // Imposta sostitutiva 5% su 1061,12 = 53,06 (centesimi-safe)
    expect(result.imposta).toBe(53.06);
    // Accantonamento totale = 2.938,88 + 53,06 = 2.991,94
    expect(result.totaleAccantonamento).toBe(2991.94);
    // Spendibile = 10.000 - 2.991,94 = 7.008,06
    expect(result.spendibile).toBe(7008.06);
    // Dettaglio INPS: 4 rate trimestrali identiche (735,72 x 4 = 2942,88, no)
    // 2938,88 / 4 = 734,72 ciascuna
    if (result.dettaglioINPS.gestione === "artigiani") {
      expect(result.dettaglioINPS.result.rateFisse).toHaveLength(4);
      const sommaRate = result.dettaglioINPS.result.rateFisse.reduce((a, b) => a + b, 0);
      expect(Math.round(sommaRate * 100) / 100).toBe(2938.88);
      // Ogni rata ~= 734,72 (split 25/25/25/25 con eventuale remainder)
      result.dettaglioINPS.result.rateFisse.forEach((r) => {
        expect(r).toBeGreaterThan(734);
        expect(r).toBeLessThan(736);
      });
    }
  });

  it("confronto post vs gestione separata: artigiano paga fisso anche sotto minimale, separata paga 0", () => {
    // Artigiano con 4k imponibile → INPS 2.938,88 (fisso minimale)
    const inpsArtigiani = calcINPSArtigiani(4000, params2026, true, false);
    expect(inpsArtigiani.totale).toBe(2938.88);

    // Separata con stesso imponibile → INPS 1.042,80 (proporzionale, nessun minimale)
    // 4.000 × 26,07% = 1.042,80
    const inpsSeparata = calcINPSSeparata(4000, params2026.inps_rate_separata);
    expect(inpsSeparata).toBe(1042.8);

    // Fatturato zero: artigiano paga comunque 2.938,88, separata paga 0
    expect(calcINPSArtigiani(0, params2026, true, false).totale).toBe(2938.88);
    expect(calcINPSSeparata(0, params2026.inps_rate_separata)).toBe(0);
  });

  it("artigiano 50k coeff 40% riduz35: variabile solo sull'eccedenza, prima fascia 24%", () => {
    // 50.000 × 40% = 20.000 imponibile. Eccedenza = 20.000 - 18.808 = 1.192€.
    // Variabile pre-riduzione = 1.192 × 24% = 286,08€.
    // Con riduzione 35%: 286,08 × 65% = 185,95€.
    const result = calcINPSArtigiani(20000, params2026, true, false);
    expect(result.minimaleAnnuo).toBe(2938.88);
    expect(result.variabile).toBe(185.95);
    expect(result.totale).toBe(3124.83);
  });

  it("artigiano 150k coeff 78% riduz35: aliquota alta oltre soglia 56.224€", () => {
    // 150.000 × 78% = 117.000, ma cappato al massimale (test fixture 122.295).
    // Fascia 1: 56.224 - 18.808 = 37.416 × 24% = 8.979,84
    // Fascia 2: min(117.000, 122.295) - 56.224 = 60.776 × 25% = 15.194,00
    // Variabile totale pre-riduzione: 8.979,84 + 15.194,00 = 24.173,84
    // Con riduzione 35%: 24.173,84 × 65% = 15.712,996 → 15.713,00
    const result = calcINPSArtigiani(117000, params2026, true, false);
    expect(result.minimaleAnnuo).toBe(2938.88);
    expect(result.variabile).toBe(15713);
    expect(result.totale).toBe(18651.88);
  });
});

describe("computeAccontiNextYearTotal", () => {
  it("somma solo i 4 acconti (no saldo) — scenario Gestione Separata 5%", () => {
    // Doc check Netto Spendibile: imposta 2.118,60 (split 40/60) +
    // INPS 14.941,66 × 80% (split 50/50) = acconti 2027 forward-looking.
    const total = computeAccontiNextYearTotal({
      accontoTax1: 847.44,
      accontoTax2: 1271.16,
      accontoInps1: 5976.66,
      accontoInps2: 5976.67,
    });
    expect(total).toBe(14071.93);
  });

  it("NON include il saldo anno corrente (usa solo i 4 campi acconto)", () => {
    // Anche con saldoTax/saldoInps presenti, contano solo gli acconti:
    // è ciò che evita il doppio conteggio nel Netto prudenziale.
    const peakLike = {
      saldoTax: 9999,
      saldoInps: 9999,
      accontoTax1: 100,
      accontoTax2: 200,
      accontoInps1: 300,
      accontoInps2: 400,
    };
    expect(computeAccontiNextYearTotal(peakLike)).toBe(1000);
  });

  it("sanitizza valori NaN a 0", () => {
    const total = computeAccontiNextYearTotal({
      accontoTax1: Number.NaN,
      accontoTax2: 500,
      accontoInps1: 0,
      accontoInps2: 0,
    });
    expect(total).toBe(500);
  });
});
