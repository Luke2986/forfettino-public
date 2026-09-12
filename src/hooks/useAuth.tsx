import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { posthog, isPosthogReady } from "@/lib/posthog";
import { hasExplicitAnalyticsOptOut } from "@/lib/analytics";
import { clearDeviceTrust } from "@/lib/otp-smart";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  sendOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (isPosthogReady) {
        try {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
            // INITIAL_SESSION serve per la sessione ripristinata: /wizard e' una
            // route di primo livello, fuori da AppLayout, quindi li' non gira mai
            // setAnalyticsConsent. Senza questo ramo chi riprende l'onboarding in
            // una sessione successiva emette tutti gli eventi wizard_* sotto un
            // distinct_id anonimo nuovo — il bug che stiamo chiudendo.
            //
            // L'opt-out esplicito si legge da localStorage perche' il profilo non
            // e' ancora caricato a questo punto: senza il controllo, chi ha
            // disattivato l'analytics verrebbe re-identificato ad ogni accesso.
            //
            // Solo id pseudonimo: l'email la attacca setAnalyticsConsent quando il
            // profilo conferma il consenso.
            if (!hasExplicitAnalyticsOptOut()) {
              posthog.identify(session.user.id);
            }
          } else if (event === "SIGNED_OUT") {
            posthog.reset();
          }
        } catch { /* fail-silent */ }
      }
    });

    // THEN check for existing session.
    // Guard rail: getSession() puo' restare appeso (lock navigator.locks condiviso
    // tra tab, refresh token in corso). Senza timeout `loading` resta true per
    // sempre e ProtectedRoute mostra lo spinner all'infinito dopo il login.
    let settled = false;
    const stopLoading = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };
    const timeoutId = setTimeout(stopLoading, 4000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => { /* fail-silent: lo stato arriva da onAuthStateChange */ })
      .finally(() => {
        clearTimeout(timeoutId);
        stopLoading();
      });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);


  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    sessionStorage.removeItem("was_password_login");
    sessionStorage.removeItem("backup_mfa_verified");
    clearDeviceTrust(); // Rimuove tutti i device trust token (Story 67.2 — AC #4)
    await supabase.auth.signOut();
  };

  const sendOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
    return { error };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    // redirect_uri deve puntare a una rotta pubblica: /auth/callback attende la
    // sessione prima di navigare su /dashboard (ProtectedRoute rimbalzerebbe a /login)
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    const error = result?.error ?? null;
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        sendOtp,
        verifyOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
