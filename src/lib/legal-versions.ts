/** Current version identifiers for legal documents — GDPR compliance (Epic 35) */
// Bump 2026-09-01: la base giuridica dell'analytics e' cambiata. L'identificativo
// pseudonimo per gli utenti autenticati passa a legittimo interesse (Art. 6.1.f) e
// il consenso esplicito resta richiesto per email e attributi di profilo.
// ATTENZIONE: cambiare questa costante rende needsConsent=true per TUTTI gli utenti
// gia' registrati (usePrivacyConsent.ts:51) → modale di ri-consenso bloccante al
// prossimo accesso. Per posticiparlo, rimettere "2026-06-27-v2.1".
export const CURRENT_PRIVACY_VERSION = "2026-09-01-v2.2";
export const CURRENT_TOS_VERSION = "2026-03-05-v1.0";

/** Shape of consent fields stored in profiles table */
export interface LegalConsent {
  privacy_policy_accepted_at: string | null;
  privacy_policy_version: string | null;
  tos_accepted_at: string | null;
  tos_version: string | null;
  analytics_consent: boolean;
  analytics_consent_at: string | null;
  marketing_email_consent: boolean;
  marketing_email_consent_at: string | null;
}
