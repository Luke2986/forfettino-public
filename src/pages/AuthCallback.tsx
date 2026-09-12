import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { REFERRAL_CODE_KEY } from "./ReferralLanding";
import { PRIVACY_SIGNUP_FLAG } from "./Auth";
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from "@/lib/legal-versions";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // La sessione puo' non essere ancora scritta al primo tick (parsing hash /
      // scambio token in corso): attendi con retry invece di decidere subito.
      const waitForSession = async () => {
        for (let attempt = 0; attempt < 12; attempt++) {
          try {
            // getSession() puo' restare appeso sul lock auth: timeout per tentativo
            const result = await Promise.race([
              supabase.auth.getSession(),
              new Promise<null>((r) => setTimeout(() => r(null), 1500)),
            ]);
            if (result?.data?.session) return result.data.session;
          } catch { /* riprova */ }
          await new Promise((r) => setTimeout(r, 500));
        }
        return null;
      };


      const session = await waitForSession();
      const data = { session };



      if (data.session) {
        // Track first login
        const { track } = await import("@/lib/analytics");
        track("first_login", {});

        // Story 35.3: Save privacy consent from signup checkbox (OAuth bridge)
        const signupConsent = localStorage.getItem(PRIVACY_SIGNUP_FLAG);
        if (signupConsent === "true") {
          const now = new Date().toISOString();
          const { error: consentError } = await supabase.from("profiles").update({
            privacy_policy_accepted_at: now,
            privacy_policy_version: CURRENT_PRIVACY_VERSION,
            tos_accepted_at: now,
            tos_version: CURRENT_TOS_VERSION,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).eq("user_id", data.session.user.id);
          if (consentError) {
            // Keep flag so BlockingModal (35.2) acts as safety net
            console.error("Failed to save OAuth consent:", consentError.message);
          } else {
            localStorage.removeItem(PRIVACY_SIGNUP_FLAG);
          }
        }

        // Process referral if code was stored by ReferralLanding
        // Uses Edge Function for IP-based anti-abuse tracking
        const refCode = localStorage.getItem(REFERRAL_CODE_KEY);
        if (refCode) {
          localStorage.removeItem(REFERRAL_CODE_KEY);
          supabase.functions
            .invoke("process-referral", { body: { referrer_code: refCode } })
            .catch(() => {});
        }

        // Session established - go to dashboard
        // ProtectedRoute will handle wizard redirect if needed
        navigate("/dashboard", { replace: true });
      } else {
        // No session - probably expired or invalid
        navigate("/login", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <>
        <Helmet>
          <title>Accesso in corso | Forfettino</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
          <p className="text-destructive">Errore: {error}</p>
          <p className="text-muted-foreground">Reindirizzamento...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Accesso in corso | Forfettino</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </>
  );
}
