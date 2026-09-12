import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMfa, EnrollResult } from "@/hooks/useMfa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, QrCode, Copy, Check, LogOut, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function MfaSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { enrollTotp, verifyAndActivate, isLoading, error, clearError } = useMfa();
  const { toast } = useToast();

  const [enrollData, setEnrollData] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // Always redirect to dashboard after MFA setup

  const handleGenerateQr = async () => {
    clearError();
    const result = await enrollTotp();
    if (result) {
      setEnrollData(result);
    }
  };

  const handleCopySecret = async () => {
    if (enrollData?.secret) {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Codice copiato!" });
    }
  };

  const handleVerify = async () => {
    if (!enrollData || code.length !== 6) return;

    setVerifying(true);
    clearError();

    const success = await verifyAndActivate(code, enrollData.factorId);

    if (success) {
      toast({ title: "2FA attivato!", description: "La verifica in due passaggi è ora attiva." });

      // Generate backup codes after successful MFA activation
      setGeneratingCodes(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("generate-backup-codes");
        if (fnError) {
          console.error("Failed to generate backup codes:", fnError);
          // Still proceed — user can regenerate from Impostazioni
          window.location.href = "/dashboard";
          return;
        }
        if (data?.codes) {
          setBackupCodes(data.codes);
        } else {
          window.location.href = "/dashboard";
        }
      } catch (err) {
        console.error("Backup codes generation error:", err);
        window.location.href = "/dashboard";
      } finally {
        setGeneratingCodes(false);
      }
    } else {
      setCode("");
    }
    setVerifying(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Attiva verifica in due passaggi</CardTitle>
          <CardDescription>
            Aggiungi un ulteriore livello di sicurezza al tuo account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Backup codes view — shown after successful TOTP activation */}
          {backupCodes ? (
            <div className="space-y-6">
              <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertDescription>
                  <strong>Salva questi codici in un posto sicuro!</strong> Puoi usarli per accedere se perdi il telefono. Ogni codice è monouso e non sarà più visibile.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((c, i) => (
                  <code
                    key={i}
                    className="rounded bg-muted px-3 py-2 text-center text-sm font-mono tracking-wider"
                  >
                    {c}
                  </code>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(backupCodes.join("\n"));
                  toast({ title: "Codici copiati!" });
                }}
              >
                <Copy className="h-4 w-4" />
                Copia tutti i codici
              </Button>

              <Button
                className="w-full gap-2"
                onClick={() => {
                  window.location.href = "/dashboard";
                }}
              >
                <Shield className="h-4 w-4" />
                Continua
              </Button>
            </div>
          ) : generatingCodes ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generazione codici di backup...</p>
            </div>
          ) : !enrollData ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Usa un'app di autenticazione come Google Authenticator, Authy o Microsoft Authenticator.
              </p>
              <Button
                onClick={handleGenerateQr}
                disabled={isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Genera QR Code
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
          ) : (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg border bg-background p-4">
                  <img
                    src={enrollData.qr}
                    alt="QR Code per 2FA"
                    className="h-48 w-48"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scansiona questo QR code con la tua app di autenticazione
                </p>
              </div>

              {/* Secret fallback */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Non riesci a scansionare? Inserisci questo codice manualmente:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                    {enrollData.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* OTP Input */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-center">
                  Inserisci il codice a 6 cifre dall'app:
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={verifying}
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
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleVerify}
                  disabled={code.length !== 6 || verifying}
                  className="w-full gap-2"
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  Verifica e attiva
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
