import { ReactNode, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { shouldRequireOtp, OTP_THRESHOLD_DAYS, isDeviceTrusted, saveDeviceTrust } from "@/lib/otp-smart";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const RESEND_COOLDOWN_SECONDS = 60;

interface OtpGateProps {
  children: ReactNode;
}

export function OtpGate({ children }: OtpGateProps) {
  const { user, sendOtp, verifyOtp } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  // Calcolo anticipato per condizionare la query app_settings
  const wasPasswordLogin =
    typeof window !== "undefined" && sessionStorage.getItem("was_password_login") === "true";

  // Query app_settings per device_trust_enabled + otp_threshold_days (5 min cache, solo per password login)
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("device_trust_enabled, otp_threshold_days")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return { device_trust_enabled: true, otp_threshold_days: OTP_THRESHOLD_DAYS };
      return data as { device_trust_enabled: boolean; otp_threshold_days: number };
    },
    staleTime: 5 * 60 * 1000,
    enabled: wasPasswordLogin,
  });
  const deviceTrustEnabled = appSettings?.device_trust_enabled ?? true;
  const thresholdDays = appSettings?.otp_threshold_days ?? OTP_THRESHOLD_DAYS;

  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer per reinvio
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Skip: OAuth login (no password)
  if (!wasPasswordLogin) {
    return <>{children}</>;
  }

  // Skip: profilo non ancora caricato (ProtectedRoute garantisce che esista)
  if (!profile || !user) {
    return <>{children}</>;
  }

  // Skip: gia' verificato in questa sessione
  if (verified) {
    return <>{children}</>;
  }

  // Skip: device trust valido (se feature abilitata)
  if (deviceTrustEnabled && isDeviceTrusted(user.id)) {
    return <>{children}</>;
  }

  // Logica soglia: se non serve OTP, passa (usa soglia da DB con fallback costante)
  if (!shouldRequireOtp(profile.last_otp_verified_at, thresholdDays)) {
    return <>{children}</>;
  }

  const email = user.email;
  if (!email) {
    return <>{children}</>;
  }

  const handleSendOtp = async () => {
    setSending(true);
    setError(null);
    const { error: sendError } = await sendOtp(email);
    setSending(false);
    if (sendError) {
      setError("Errore nell'invio del codice. Riprova.");
      return;
    }
    setOtpSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await verifyOtp(email, otpValue);
    if (verifyError) {
      setVerifying(false);
      setError("Codice non valido o scaduto. Riprova.");
      setOtpValue("");
      return;
    }

    // Aggiorna last_otp_verified_at nel profilo (Task 5 — AC #5)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ last_otp_verified_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (updateError) {
      console.error("[OtpGate] Failed to update last_otp_verified_at:", updateError.message);
    }
    queryClient.invalidateQueries({ queryKey: ["profile"] });

    // Salva device trust token per skip OTP futuro (Story 67.2 — AC #1)
    if (deviceTrustEnabled) {
      saveDeviceTrust(user.id);
    }

    setVerifying(false);
    setVerified(true);
  };

  // UI Gate: mostra form OTP
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Verifica la tua identita'</h2>
          <p className="text-sm text-muted-foreground">
            Per la tua sicurezza, conferma il tuo accesso con un codice OTP inviato alla tua email.
          </p>
        </div>

        {!otpSent ? (
          <Button onClick={handleSendOtp} disabled={sending} className="w-full gap-2">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MailCheck className="h-4 w-4" />
            )}
            Invia codice OTP
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            <p className="text-sm text-muted-foreground">
              Codice inviato a <span className="font-medium text-foreground">{email}</span>
            </p>

            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={setOtpValue}
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

            <Button
              onClick={handleVerifyOtp}
              disabled={verifying || otpValue.length !== 6}
              className="w-full"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Verifica
            </Button>

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={cooldown > 0 || sending}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Reinvia codice tra ${cooldown}s` : "Reinvia codice"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
