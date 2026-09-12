import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { strongPasswordSchema } from "@/lib/password-validation";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { REFERRAL_CODE_KEY } from "./ReferralLanding";
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from "@/lib/legal-versions";

/** localStorage key for bridging consent across redirects (OAuth, email confirm) */
export const PRIVACY_SIGNUP_FLAG = "forfettino:privacy-accepted-at-signup";

/** Detect in-app browsers / WebViews that Google OAuth blocks (403: disallowed_useragent) */
function isWebView(): boolean {
  const ua = navigator.userAgent || "";
  // Test environments (jsdom) have AppleWebKit without Safari — skip detection
  if (/jsdom|Node\.js/i.test(ua)) return false;
  // Android WebView
  if (/\bwv\b/.test(ua)) return true;
  // Facebook, Instagram, Telegram, Line, Twitter/X in-app browsers
  if (/FBAN|FBAV|Instagram|Telegram|Line\/|Twitter/i.test(ua)) return true;
  // iOS WebView: has AppleWebKit but NOT Safari (real Safari always includes "Safari")
  if (/AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return true;
  return false;
}

const emailSchema = z.string().trim().email("Email non valida").max(255, "Email troppo lunga");

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "La password deve avere almeno 6 caratteri").max(100, "Password troppo lunga"),
});

const signupSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
});
export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [inAppBrowser] = useState(isWebView);
  const {
    signIn,
    signUp,
    signInWithGoogle,
    user,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    toast
  } = useToast();
  const from = location.state?.from?.pathname || "/dashboard";

  // Redirect if already logged in (but NOT during form submission)
  if (!authLoading && user && !loading) {
    return <Navigate to={from} replace />;
  }
  const handleSubmit = async (mode: "login" | "signup") => {
    // Validate input — login uses relaxed schema, signup uses strong password
    const schema = mode === "signup" ? signupSchema : loginSchema;
    const result = schema.safeParse({
      email,
      password
    });
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      toast({
        title: "Errore di validazione",
        description: firstIssue.message,
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        error
      } = mode === "login" ? await signIn(email, password) : await signUp(email, password);
      if (error) {
        let message = error.message;
        if (error.message.includes("Invalid login credentials")) {
          message = "Credenziali non valide. Controlla email e password.";
        } else if (error.message.includes("User already registered")) {
          message = "Utente già registrato. Prova ad accedere.";
        } else if (error.message.includes("Email not confirmed")) {
          // Show confirmation screen with resend option
          setSignupEmail(email);
          setSignupComplete(true);
          setLoading(false);
          return;
        }
        toast({
          title: "Errore",
          description: message,
          variant: "destructive"
        });
      } else if (mode === "signup") {
        // Story 35.3: save consent flag for email-confirm returnees
        localStorage.setItem(PRIVACY_SIGNUP_FLAG, "true");

        // Verifica se Supabase ha auto-confermato l'utente (sessione attiva)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          // Auto-confirm attivo: save consent directly
          const now = new Date().toISOString();
          const { error: consentError } = await supabase.from("profiles").update({
            privacy_policy_accepted_at: now,
            privacy_policy_version: CURRENT_PRIVACY_VERSION,
            tos_accepted_at: now,
            tos_version: CURRENT_TOS_VERSION,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).eq("user_id", currentSession.user.id);
          if (consentError) {
            // Keep flag so BlockingModal (35.2) acts as safety net
            console.error("Failed to save signup consent:", consentError.message);
          } else {
            localStorage.removeItem(PRIVACY_SIGNUP_FLAG);
          }

          sessionStorage.setItem("was_password_login", "true");
          const refCode = localStorage.getItem(REFERRAL_CODE_KEY);
          if (refCode) {
            localStorage.removeItem(REFERRAL_CODE_KEY);
            supabase.functions
              .invoke("process-referral", { body: { referrer_code: refCode } })
              .catch(() => {});
          }
          navigate(from, { replace: true });
        } else {
          // Email confirmation richiesta: localStorage flag remains for later
          setSignupEmail(email);
          setSignupComplete(true);
        }
      } else if (mode === "login") {
        // Login riuscito — password auth è sufficiente, naviga direttamente
        sessionStorage.setItem("was_password_login", "true");
        const refCode = localStorage.getItem(REFERRAL_CODE_KEY);
        if (refCode) {
          localStorage.removeItem(REFERRAL_CODE_KEY);
          supabase.functions
            .invoke("process-referral", { body: { referrer_code: refCode } })
            .catch(() => {});
        }
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async () => {
    const emailResult = z.string().trim().email("Email non valida").safeParse(forgotEmail);
    if (!emailResult.success) {
      toast({
        title: "Errore",
        description: emailResult.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({
          title: "Errore",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setForgotSent(true);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Story 35.3: save consent flag for OAuth callback.
    // Only set in signup mode — a first-time user clicking Google from the login tab
    // won't have consent recorded here, but BlockingModal (35.2) acts as safety net.
    if (isSignUp && privacyAccepted) {
      localStorage.setItem(PRIVACY_SIGNUP_FLAG, "true");
    }
    setGoogleLoading(true);
    const {
      error
    } = await signInWithGoogle();
    if (error) {
      localStorage.removeItem(PRIVACY_SIGNUP_FLAG);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
      setGoogleLoading(false);
    }
  };
  const handleResendConfirmation = async () => {
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: signupEmail });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Email inviata!", description: "Controlla la tua casella di posta." });
      }
    } finally {
      setResendLoading(false);
    }
  };


  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <>
      <Helmet>
        <title>Accedi a Forfettino</title>
        <meta
          name="description"
          content="Accedi o crea il tuo account Forfettino per gestire netto spendibile, tasse, INPS e scadenze del regime forfettario."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://forfettino.it/login" />
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <span className="text-3xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Forfettino</h1>
          <p className="text-muted-foreground">
            Il tuo gestionale per il Regime Forfettario
          </p>
        </div>

        <Card className="border-0 shadow-[var(--v2-shadow-card)]">
          <CardContent className="space-y-4 pt-6">
            {signupComplete ? (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <Mail className="h-10 w-10 mx-auto text-primary" />
                  <h2 className="text-lg font-semibold">Controlla la tua email</h2>
                  <p className="text-sm text-muted-foreground">
                    Abbiamo inviato un link di conferma a <strong>{signupEmail}</strong>.
                    Clicca il link nell'email per attivare il tuo account.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Reinvia email di conferma
                </Button>
                <Button
                  variant="ghost"
                  className="w-full gap-2"
                  onClick={() => { setSignupComplete(false); setIsSignUp(false); }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Torna al login
                </Button>
              </div>
            ) : showForgotPassword ? (
              <div className="space-y-4">
                {forgotSent ? (
                  <>
                    <div className="text-center space-y-2">
                      <Mail className="h-10 w-10 mx-auto text-primary" />
                      <h2 className="text-lg font-semibold">Controlla la tua email</h2>
                      <p className="text-sm text-muted-foreground">
                        Abbiamo inviato un link di reset a <strong>{forgotEmail}</strong>.
                        Clicca il link nell'email per impostare una nuova password.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(""); }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Torna al login
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center space-y-1">
                      <h2 className="text-lg font-semibold">Password dimenticata?</h2>
                      <p className="text-sm text-muted-foreground">
                        Inserisci la tua email e ti invieremo un link per reimpostare la password.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="mario@esempio.it"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        disabled={forgotLoading}
                        onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                      />
                    </div>
                    <Button className="w-full" onClick={handleForgotPassword} disabled={forgotLoading}>
                      {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Invia link di reset
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full gap-2"
                      onClick={() => { setShowForgotPassword(false); setForgotEmail(""); }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Torna al login
                    </Button>
                  </>
                )}
              </div>
            ) : (<>
            {/* WebView warning — Google blocks OAuth from in-app browsers */}
            {inAppBrowser && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">Browser in-app rilevato</p>
                <p className="mt-1 text-amber-700">
                  L'accesso con Google non funziona nei browser integrati (es. Telegram, Instagram, Facebook).
                  Apri questa pagina in <strong>Safari</strong> o <strong>Chrome</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Attempt to open in system browser
                    window.open(window.location.href, "_system");
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline underline-offset-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Apri nel browser di sistema
                </button>
              </div>
            )}

            {/* Google Button - sempre visibile */}
            <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignIn} disabled={loading || googleLoading || inAppBrowser || (isSignUp && !privacyAccepted)}>
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>}
              Continua con Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">oppure</span>
              </div>
            </div>

            {/* Email Button / Form */}
            {!showEmailForm ? <Button className="w-full gap-2" onClick={() => setShowEmailForm(true)}>
                <Mail className="h-4 w-4" />
                Continua con Email
              </Button> : <div className="space-y-4">
                {/* Email input */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="mario@esempio.it" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
                </div>
                {/* Password input */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput id="password" placeholder={isSignUp ? "Minimo 8 caratteri" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} disabled={loading} onKeyDown={e => e.key === "Enter" && handleSubmit(isSignUp ? "signup" : "login")} />
                  <PasswordStrengthIndicator password={password} show={isSignUp} />
                </div>
                {/* Forgot password link (login only) */}
                {!isSignUp && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(true); setForgotEmail(email); }}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Password dimenticata?
                    </button>
                  </div>
                )}
                {/* Privacy consent checkbox (signup only — Story 35.3) */}
                {isSignUp && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="privacy-consent"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="privacy-consent" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                      Ho letto e accetto la{" "}
                      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                        Privacy Policy
                      </a>{" "}
                      e i{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                        Termini di Servizio
                      </a>
                    </label>
                  </div>
                )}
                {/* Submit */}
                <Button className="w-full" onClick={() => handleSubmit(isSignUp ? "signup" : "login")} disabled={loading || googleLoading || (isSignUp && !privacyAccepted)}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignUp ? "Registrati" : "Accedi"}
                </Button>
                {/* Toggle signup/login */}
                <p className="text-sm text-center text-muted-foreground">
                  {isSignUp ? <>
                      Hai già un account?{" "}
                      <button type="button" onClick={() => setIsSignUp(false)} className="text-primary underline-offset-4 hover:underline">
                        Accedi
                      </button>
                    </> : <>
                      Non hai un account?{" "}
                      <button type="button" onClick={() => setIsSignUp(true)} className="text-primary underline-offset-4 hover:underline">
                        Registrati
                      </button>
                    </>}
                </p>
              </div>}
            </>)}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Gestisci facilmente la tua Partita IVA in Regime Forfettario.
        </p>
      </div>
    </div>
  </>;
}
