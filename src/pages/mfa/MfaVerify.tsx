import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type LockoutJson = { locked?: boolean; locked_until?: string; attempts?: number } | null;
import { useMfa } from "@/hooks/useMfa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, LogOut, AlertTriangle, KeyRound, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOut } = useAuth();
  const { checkMfaStatus, createChallengeAndVerify, isLoading, error, clearError } = useMfa();
  const { toast } = useToast();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [showBackupInput, setShowBackupInput] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [verifyingBackup, setVerifyingBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Server-side lockout state
  const [serverLocked, setServerLocked] = useState(false);
  const [serverLockedUntil, setServerLockedUntil] = useState<string | null>(null);
  const [serverAttempts, setServerAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);

  // Fetch lockout status from server
  const fetchLockoutStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase.rpc("get_mfa_lockout_status", {
        p_user_id: session.user.id,
      });
      const d = data as unknown as { locked?: boolean; locked_until?: string; attempts?: number } | null;
      if (d) {
        setServerLocked(d.locked || false);
        setServerLockedUntil(d.locked ? (d.locked_until ?? null) : null);
        setServerAttempts(d.attempts || 0);
      }
    } catch {
      // Non-critical — will be enforced server-side on verify attempt anyway
    }
  }, [session?.user?.id]);

  // Load factor on mount + fetch lockout status
  useEffect(() => {
    const loadFactor = async () => {
      const state = await checkMfaStatus();
      if (state.factorId) {
        setFactorId(state.factorId);
      } else {
        navigate("/mfa/setup", { replace: true });
      }
      setLoadingFactor(false);
    };
    loadFactor();
    fetchLockoutStatus();
  }, [checkMfaStatus, navigate, fetchLockoutStatus]);

  // Countdown timer for server-side lockout
  useEffect(() => {
    if (!serverLockedUntil) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.ceil((new Date(serverLockedUntil).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        setServerLocked(false);
        setServerLockedUntil(null);
        setCountdown(0);
        setServerAttempts(0);
      } else {
        setCountdown(remaining);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [serverLockedUntil]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6 || serverLocked) return;

    setVerifying(true);
    clearError();

    // Pre-check lockout server-side (AC2: track TOTP attempts too)
    if (session?.user?.id) {
      try {
        const { data: rawLockCheck } = await supabase.rpc("check_lockout_for_totp", {
          p_user_id: session.user.id,
        });
        const lockCheck = rawLockCheck as unknown as LockoutJson;
        if (lockCheck?.locked) {
          setServerLocked(true);
          setServerLockedUntil(lockCheck.locked_until ?? null);
          setServerAttempts(lockCheck.attempts || 0);
          setVerifying(false);
          return;
        }
      } catch {
        // Non-critical: Supabase Auth has its own rate limiting as fallback
      }
    }

    const success = await createChallengeAndVerify(code, factorId);

    if (success) {
      // Reset lockout on successful TOTP verification (uses auth-safe wrapper)
      if (session?.user?.id) {
        try { await supabase.rpc("reset_lockout_after_totp", { p_user_id: session.user.id }); } catch { /* non-critical */ }
      }
      toast({ title: "Verifica completata!" });
      window.location.href = "/dashboard";
    } else {
      setCode("");
      // Record failed TOTP attempt server-side (AC2: TOTP tracking)
      if (session?.user?.id) {
        try {
          const { data: rawFailData } = await supabase.rpc("record_failed_totp_attempt", {
            p_user_id: session.user.id,
          });
          const failData = rawFailData as unknown as LockoutJson;
          if (failData?.locked) {
            setServerLocked(true);
            setServerLockedUntil(failData.locked_until ?? null);
          }
          setServerAttempts(failData?.attempts || 0);
        } catch {
          await fetchLockoutStatus();
        }
      }
    }
    setVerifying(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleVerifyBackupCode = async () => {
    if (!backupCodeInput.trim() || serverLocked) return;

    setVerifyingBackup(true);
    setBackupError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-backup-code", {
        body: { code: backupCodeInput.trim() },
      });

      if (fnError) {
        // Check if it's a 429 lockout response
        setBackupError("Errore durante la verifica. Riprova.");
        await fetchLockoutStatus();
        setVerifyingBackup(false);
        return;
      }

      if (data?.locked) {
        // Server returned lockout
        setServerLocked(true);
        setServerLockedUntil(data.locked_until);
        setBackupError("Troppi tentativi. Account temporaneamente bloccato.");
        setBackupCodeInput("");
        setVerifyingBackup(false);
        return;
      }

      if (data?.valid) {
        toast({ title: "Codice di backup verificato!" });
        // Server-side backup_verified_at is set by the RPC — no sessionStorage needed
        window.location.href = "/dashboard";
      } else {
        const remaining = data?.remaining_attempts;
        const errorMsg = remaining !== undefined && remaining <= 2
          ? `Codice non valido. ${remaining} tentativi rimasti.`
          : (data?.error || "Codice di backup non valido.");
        setBackupError(errorMsg);
        setBackupCodeInput("");
        await fetchLockoutStatus();
      }
    } catch {
      setBackupError("Errore di rete. Riprova.");
    }
    setVerifyingBackup(false);
  };

  if (loadingFactor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const remainingAttempts = Math.max(0, 5 - serverAttempts);
  const showAttemptWarning = serverAttempts > 0 && !serverLocked;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {showBackupInput ? "Usa codice di backup" : "Inserisci il codice 2FA"}
          </CardTitle>
          <CardDescription>
            {showBackupInput
              ? "Inserisci uno dei codici di backup che hai salvato."
              : "Apri la tua app di autenticazione e inserisci il codice a 6 cifre."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Server-side lockout alert — shared between TOTP and backup */}
          {serverLocked && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Troppi tentativi. Attendi {countdown > 60 ? `${Math.ceil(countdown / 60)} minuti` : `${countdown} secondi`} prima di riprovare.
              </AlertDescription>
            </Alert>
          )}

          {showBackupInput ? (
            <>
              {backupError && !serverLocked && (
                <Alert variant="destructive">
                  <AlertDescription>{backupError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Input
                  placeholder="Es: A3BF72K9"
                  value={backupCodeInput}
                  onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                  disabled={verifyingBackup || serverLocked}
                  className="text-center font-mono tracking-widest text-lg"
                  maxLength={8}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyBackupCode()}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleVerifyBackupCode}
                  disabled={!backupCodeInput.trim() || verifyingBackup || serverLocked}
                  className="w-full gap-2"
                >
                  {verifyingBackup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  Verifica codice di backup
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBackupInput(false);
                    setBackupCodeInput("");
                    setBackupError(null);
                  }}
                  className="w-full gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Torna al codice 2FA
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </Button>
              </div>
            </>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* OTP Input */}
              <div className="space-y-3">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={verifying || serverLocked}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {showAttemptWarning && (
                  <p className="text-sm text-muted-foreground text-center">
                    Tentativi rimasti: {remainingAttempts}/5
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleVerify}
                  disabled={code.length !== 6 || verifying || serverLocked}
                  className="w-full gap-2"
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  Verifica
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowBackupInput(true);
                    clearError();
                  }}
                  className="w-full gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  Usa codice di backup
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
