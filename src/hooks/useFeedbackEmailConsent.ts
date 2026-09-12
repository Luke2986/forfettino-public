import { useProfile } from "./useProfile";
import { usePrivacyConsent } from "./usePrivacyConsent";

/**
 * Hook per determinare se mostrare il modal di consenso email feedback (Story 14.6).
 *
 * - needsEmailConsent: true se l'utente non ha mai risposto (feedback_email_consent_at == null)
 * - Non mostra il modal se il privacy consent è ancora pendente (priorità assoluta)
 */
export function useFeedbackEmailConsent() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { needsConsent: needsPrivacyConsent, isLoading: privacyLoading } = usePrivacyConsent();

  const isLoading = profileLoading || privacyLoading;

  // Mai mostrare se privacy consent ancora pendente o dati in caricamento
  if (isLoading || needsPrivacyConsent) {
    return { needsEmailConsent: false, isLoading };
  }

  // Mostra solo se l'utente non ha mai risposto (né SI né NO)
  const needsEmailConsent = profile?.feedback_email_consent_at == null;

  return { needsEmailConsent, isLoading };
}
