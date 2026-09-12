import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { strongPasswordSchema } from "@/lib/password-validation";
import { clearDeviceTrust } from "@/lib/otp-smart";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleReset = async () => {
    // Validate password
    const result = strongPasswordSchema.safeParse(password);
    if (!result.success) {
      toast({
        title: "Errore",
        description: result.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({
          title: "Errore",
          description: error.message,
          variant: "destructive",
        });
      } else {
        clearDeviceTrust(); // Invalida device trust dopo cambio password (Story 67.2 — AC #5)
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reimposta Password | Forfettino</title>
        <meta name="description" content="Pagina di reimpostazione password per gli account Forfettino." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="text-3xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Forfettino</h1>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="space-y-4 pt-6">
            {success ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
                <h2 className="text-lg font-semibold">Password aggiornata!</h2>
                <p className="text-sm text-muted-foreground">
                  La tua password è stata reimpostata con successo.
                </p>
                <Button className="w-full" onClick={() => navigate("/login")}>
                  Vai al login
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">Nuova password</h2>
                  <p className="text-sm text-muted-foreground">
                    Scegli una nuova password per il tuo account.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nuova password</Label>
                  <PasswordInput
                    id="new-password"
                    placeholder="Minimo 8 caratteri"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <PasswordStrengthIndicator password={password} show={true} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Conferma password</Label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="Ripeti la password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                  />
                </div>
                <Button className="w-full" onClick={handleReset} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Imposta nuova password
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
