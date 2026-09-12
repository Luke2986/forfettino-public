import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MfaState {
  isLoading: boolean;
  isPasswordLogin: boolean;
  currentAal: "aal1" | "aal2";
  nextAal: "aal1" | "aal2";
  hasEnrolledFactor: boolean;
  factorId: string | null;
}

export interface EnrollResult {
  qr: string;
  secret: string;
  factorId: string;
}

export function useMfa() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkMfaStatus = useCallback(async (): Promise<MfaState> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get AAL level and authentication methods
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalError) {
        throw aalError;
      }

      // Determine if login was via password
      const isPasswordLogin = aalData?.currentAuthenticationMethods?.some(
        (method) => method.method === "password"
      ) ?? false;

      // Get enrolled factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) {
        throw factorsError;
      }

      // Find verified TOTP factor
      const totpFactors = factorsData?.totp || [];
      const verifiedFactor = totpFactors.find((f) => f.status === "verified");

      return {
        isLoading: false,
        isPasswordLogin,
        currentAal: (aalData?.currentLevel as "aal1" | "aal2") || "aal1",
        nextAal: (aalData?.nextLevel as "aal1" | "aal2") || "aal1",
        hasEnrolledFactor: !!verifiedFactor,
        factorId: verifiedFactor?.id || null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante il controllo MFA";
      setError(message);
      return {
        isLoading: false,
        isPasswordLogin: false,
        currentAal: "aal1",
        nextAal: "aal1",
        hasEnrolledFactor: false,
        factorId: null,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enrollTotp = useCallback(async (): Promise<EnrollResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (enrollError) {
        throw enrollError;
      }

      if (!data) {
        throw new Error("Nessun dato ricevuto dall'enrollment");
      }

      return {
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante l'enrollment TOTP";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyAndActivate = useCallback(async (code: string, factorId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify with code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        throw verifyError;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Codice non valido";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Alias for backward compatibility (createChallengeAndVerify is the same as verifyAndActivate)
  const createChallengeAndVerify = verifyAndActivate;

  const unenrollFactor = useCallback(async (factorId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) {
        throw unenrollError;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante la rimozione del fattore";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    checkMfaStatus,
    enrollTotp,
    verifyAndActivate,
    createChallengeAndVerify,
    unenrollFactor,
    clearError: () => setError(null),
  };
}
