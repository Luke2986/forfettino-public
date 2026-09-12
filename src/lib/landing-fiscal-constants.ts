/**
 * Landing fiscal constants — Epic 79.3
 *
 * Valori fiscali statici usati SOLO nella landing pubblica (server-less, build-time).
 * Devono restare allineati al fiscal_rules DB — anno 2026.
 *
 * Source of truth runtime: tabella `fiscal_rules` (colonne `minimale_artigiani`,
 * `minimale_commercianti`). Se questi valori cambiano alla Circolare INPS annuale,
 * aggiornare QUI e ricaricare anche il DB via migration.
 *
 * Consumed by: src/components/landing/LandingInfoSection.tsx
 */
export const LANDING_FISCAL_CONSTANTS_2026 = {
  // Gestione Separata — INPS, aliquota professionisti senza cassa
  gestioneSeparataAliquota: "26,07%",
  // Artigiani — minimale include maternità, cfr. calcMinimaleArtigiani in fiscal-engine.ts
  artigianiAliquota: "24,00%",
  artigianiMinimaleDisplay: "~4.521 EUR/anno",
  // Commercianti — stesso minimale struttura Artigiani
  commerciantiAliquota: "24,48%",
  commerciantiMinimaleDisplay: "~4.521 EUR/anno",
  // Soglia ricavi regime forfettario
  sogliaRicavi: "85.000 EUR",
  sogliaImpostaRidotta: "5%",
  sogliaImpostaStandard: "15%",
} as const;

/**
 * Ultimo aggiornamento dei dati fiscali della landing (story 79.6).
 * Formato "YYYY-MM". Mostrato come "aprile 2026" nel footer.
 * Aggiornare quando cambiano le Circolari INPS o le costanti fiscali di questa pagina.
 */
export const LANDING_LAST_UPDATED = "2026-04" as const;
