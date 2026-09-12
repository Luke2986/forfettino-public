/**
 * Canonical GEO sources — single source of truth per la sezione "Fonti e riferimenti"
 * consumata da LandingBelowFold e, in futuro (Epic 79.6), dallo schema markup
 * Article.citation / isBasedOn / sourceOrganization.
 *
 * Ogni fonte e' verificata contro le costanti fiscali usate nel codice (fiscal-rates DB,
 * landing-fiscal-constants.ts) e contro i riferimenti citati nei blog markdown.
 *
 * ZERO invenzione: ogni `reference` e `title` deve corrispondere a un documento ufficiale
 * realmente esistente. Una citazione errata e' peggio di nessuna citazione (penalizza E-E-A-T).
 */

export type GeoSource = {
  id: string;
  institution: string;
  reference: string;
  title: string;
  year: number;
};

export const GEO_SOURCES: Record<string, GeoSource> = {
  "l190-2014-disciplina": {
    id: "l190-2014-disciplina",
    institution: "Governo Italiano",
    reference: "Legge 23 dicembre 2014, n. 190, art. 1, commi 54-89",
    title: "Disciplina del regime forfettario",
    year: 2014,
  },
  "l197-2022-soglia-85k": {
    id: "l197-2022-soglia-85k",
    institution: "Governo Italiano",
    reference: "Legge 29 dicembre 2022, n. 197, art. 1, comma 54",
    title: "Innalzamento soglia forfettario a 85.000 euro",
    year: 2022,
  },
  "l207-2024-soglia-redd-dipendente": {
    id: "l207-2024-soglia-redd-dipendente",
    institution: "Governo Italiano",
    reference: "Legge 30 dicembre 2024, n. 207, art. 1",
    title:
      "Legge di Bilancio 2025 — proroga al 2025-2026 della soglia di 35.000 euro per i redditi da lavoro dipendente",
    year: 2024,
  },
  "inps-circ-8-2026-gs": {
    id: "inps-circ-8-2026-gs",
    institution: "INPS",
    reference: "Circolare n. 8 del 29 gennaio 2026",
    title: "Aliquote contributive Gestione Separata anno 2026",
    year: 2026,
  },
  "inps-circ-14-2026-artcom": {
    id: "inps-circ-14-2026-artcom",
    institution: "INPS",
    reference: "Circolare n. 14 del 7 febbraio 2026",
    title: "Minimali e massimali Artigiani e Commercianti 2026",
    year: 2026,
  },
  "l190-2014-riduzione-35": {
    id: "l190-2014-riduzione-35",
    institution: "Governo Italiano",
    reference: "Legge 190/2014, art. 1, comma 77",
    title: "Riduzione contributiva 35% per forfettari Artigiani e Commercianti",
    year: 2014,
  },
  "dlgs-127-2015-fe": {
    id: "dlgs-127-2015-fe",
    institution: "Governo Italiano",
    reference: "Decreto Legislativo 5 agosto 2015, n. 127, art. 1",
    title: "Obbligo di fatturazione elettronica",
    year: 2015,
  },
  "l190-2014-allegato-4": {
    id: "l190-2014-allegato-4",
    institution: "Governo Italiano",
    reference: "Legge 190/2014, Allegato 4",
    title: "Tabella coefficienti di redditivita' per codice ATECO",
    year: 2014,
  },
  "dl-73-2021-iscro": {
    id: "dl-73-2021-iscro",
    institution: "Governo Italiano",
    reference:
      "Decreto-Legge 25 maggio 2021, n. 73, art. 67, convertito con modificazioni dalla Legge 23 luglio 2021, n. 106",
    title: "Istituzione ISCRO per Gestione Separata",
    year: 2021,
  },
  "dpr-435-2001-versamenti": {
    id: "dpr-435-2001-versamenti",
    institution: "Governo Italiano",
    reference: "Decreto del Presidente della Repubblica 7 dicembre 2001, n. 435, art. 17",
    title: "Termini di versamento dell'imposta sui redditi",
    year: 2001,
  },
  "ade-ris-73e-2021-bollo": {
    id: "ade-ris-73e-2021-bollo",
    institution: "Agenzia delle Entrate",
    reference: "Risoluzione n. 73/E del 6 dicembre 2021",
    title: "Imposta di bollo su fatture elettroniche, modalita' di assolvimento",
    year: 2021,
  },
  "l190-2014-startup-5": {
    id: "l190-2014-startup-5",
    institution: "Governo Italiano",
    reference: "Legge 190/2014, art. 1, comma 65",
    title: "Aliquota ridotta al 5% per nuove attivita'",
    year: 2014,
  },
  "ade-circ-9e-2019": {
    id: "ade-circ-9e-2019",
    institution: "Agenzia delle Entrate",
    reference: "Circolare n. 9/E del 10 aprile 2019",
    title: "Regime forfettario, chiarimenti operativi",
    year: 2019,
  },
};

/**
 * Formatta una fonte nel formato canonico usato da blog markdown e landing:
 * `Istituzione, Riferimento — Titolo`
 * Usa em dash U+2014, NON hyphen.
 */
export function formatGeoSource(source: GeoSource): string {
  return `${source.institution}, ${source.reference} \u2014 ${source.title}`;
}
