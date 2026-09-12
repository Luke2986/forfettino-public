import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { MfaGate } from "@/components/auth/MfaGate";
import { OtpGate } from "@/components/auth/OtpGate";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile();
  const location = useLocation();

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Profilo assente (null da maybeSingle) → redirect al wizard per onboarding
  // Con maybeSingle(), profileError scatta solo per errori DB reali (network, permessi),
  // non per "riga non trovata" — evita loop wizard↔dashboard
  if (!profile && !profileLoading && !profileError) {
    if (location.pathname !== "/wizard") {
      return <Navigate to="/wizard" replace />;
    }
  }

  // Redirect to wizard if onboarding not completed
  if (profile && !profile.onboarding_completed && location.pathname !== "/wizard") {
    return <Navigate to="/wizard" replace />;
  }

  // Redirect away from wizard if onboarding is already completed
  // (defensive guard: prevents getting stuck on /wizard after OTP login race condition)
  if (profile && profile.onboarding_completed && location.pathname === "/wizard") {
    return <Navigate to="/dashboard" replace />;
  }

  // MfaGate handles optional 2FA verification for password-based logins
  // OtpGate handles smart OTP verification after 14+ days of inactivity (Story 67.1)
  return <MfaGate><OtpGate>{children}</OtpGate></MfaGate>;
}
