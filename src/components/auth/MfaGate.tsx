import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMfa, MfaState } from "@/hooks/useMfa";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, RefreshCw, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const MFA_CHECK_TIMEOUT_MS = 10000;

interface MfaGateProps {
  children: ReactNode;
}

export function MfaGate({ children }: MfaGateProps) {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const { checkMfaStatus } = useMfa();
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [checking, setChecking] = useState(true);
  const [mfaError, setMfaError] = useState(false);
  const [backupVerified, setBackupVerified] = useState(false);
  const cancelledRef = useRef(false);

  const performCheck = useCallback(async () => {
    if (!session) {
      setChecking(false);
      return;
    }

    cancelledRef.current = false;
    setChecking(true);
    setMfaError(false);

    // Timeout: fail-closed after 10s
    const timeoutId = setTimeout(() => {
      cancelledRef.current = true;
      setMfaError(true);
      setMfaState(null);
      setChecking(false);
    }, MFA_CHECK_TIMEOUT_MS);

    try {
      const state = await checkMfaStatus();
      clearTimeout(timeoutId);
      if (cancelledRef.current) return; // timeout already fired

      setMfaState(state);

      // If user has enrolled factor and is at AAL1, also check server-side backup verification
      if (state.hasEnrolledFactor && state.currentAal === "aal1" && session.user?.id) {
        try {
          const { data } = await supabase.rpc("get_mfa_lockout_status", {
            p_user_id: session.user.id,
          });
          const lockoutData = data as unknown as { backup_verified?: boolean } | null;
          if (!cancelledRef.current && lockoutData?.backup_verified) {
            setBackupVerified(true);
          }
        } catch {
          // Non-critical: if backup check fails, user can still use TOTP
        }
      }
    } catch {
      clearTimeout(timeoutId);
      if (cancelledRef.current) return;
      // FAIL-CLOSED: on error, deny access
      setMfaError(true);
      setMfaState(null);
    } finally {
      if (!cancelledRef.current) {
        setChecking(false);
      }
    }
  }, [session, checkMfaStatus]);

  useEffect(() => {
    performCheck();
    return () => { cancelledRef.current = true; };
  }, [performCheck]);

  // Loading state
  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Shield className="h-12 w-12 text-primary animate-pulse" />
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Verifica sicurezza...</span>
        </div>
      </div>
    );
  }

  // FAIL-CLOSED: error or timeout — deny access, show retry
  if (mfaError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Impossibile verificare lo stato MFA</h2>
          <p className="text-sm text-muted-foreground">
            Si e' verificato un errore durante la verifica di sicurezza. Riprova o esci e accedi di nuovo.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <Button onClick={performCheck} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Riprova
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No session - let ProtectedRoute handle it
  if (!session || !mfaState) {
    return <>{children}</>;
  }

  // OAuth login (not password) - no MFA required
  const wasPasswordLogin = typeof window !== "undefined" && sessionStorage.getItem("was_password_login") === "true";
  if (!mfaState.isPasswordLogin && !wasPasswordLogin) {
    return <>{children}</>;
  }

  // Password login - check AAL level
  if (mfaState.currentAal === "aal2") {
    return <>{children}</>;
  }

  // Server-side backup code verification (replaces sessionStorage flag — fixes C1)
  if (backupVerified) {
    return <>{children}</>;
  }

  // Password login at AAL1 — no factor enrolled: allow access (MFA is voluntary, Story 16.2)
  if (!mfaState.hasEnrolledFactor) {
    return <>{children}</>;
  }

  // MFA enrolled but not verified this session - redirect to verify
  return <Navigate to="/mfa/verify" state={{ returnTo: location.pathname }} replace />;
}
