import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface MfaProtectedRouteProps {
  children: ReactNode;
}

/**
 * Route wrapper for MFA pages.
 * - Requires authenticated user (session exists)
 * - Does NOT apply MfaGate (to avoid infinite loops)
 * - Redirects unauthenticated users to /login
 */
export function MfaProtectedRoute({ children }: MfaProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated - show MFA page
  // We do NOT apply MfaGate here to avoid loops
  return <>{children}</>;
}
