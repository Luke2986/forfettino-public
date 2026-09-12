import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProWaitlist, PRO_WAITLIST_CONSENT_TEXT } from "@/hooks/useProWaitlist";
import { WaitlistReferralPanel } from "./WaitlistReferralPanel";
import { posthog, isPosthogReady } from "@/lib/posthog";
import { useQueryClient } from "@tanstack/react-query";

type FormStatus = "idle" | "submitting" | "success" | "already_registered" | "already_in_waitlist" | "rate_limited" | "error";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistCaptureFormProps {
  referredByToken?: string;
}

export function WaitlistCaptureForm({ referredByToken }: WaitlistCaptureFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mergeAttemptedRef = useRef(false);

  // Solo per utente autenticato
  const { isJoined, join: joinMutation } = useProWaitlist();

  // Form state (path anonimo)
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [emailError, setEmailError] = useState("");

  // Auto-merge al mount per utente autenticato
  useEffect(() => {
    if (!user?.email || mergeAttemptedRef.current) return;
    mergeAttemptedRef.current = true;

    supabase
      .rpc("merge_waitlist_lead_if_exists" as any, {
        p_user_id: user.id,
        p_email: user.email,
      })
      .then(({ data }) => {
        if ((data as any)?.merged) {
          queryClient.invalidateQueries({ queryKey: ["pro-waitlist"] });
          queryClient.invalidateQueries({ queryKey: ["waitlist-count"] });
        }
      }, () => {
        // fire-and-forget
      });
  }, [user, queryClient]);

  // --- Path autenticato: già in waitlist o appena iscritto ---
  if (user && (isJoined || status === "success")) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2 py-4">
          <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600" />
          <p className="text-sm font-medium text-slate-700">
            Sei in lista! Ti avviseremo via email quando PRO sarà disponibile.
          </p>
        </div>
        <WaitlistReferralPanel />
      </div>
    );
  }

  // --- Path autenticato: CTA diretta ---
  if (user) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => {
            joinMutation.mutate(referredByToken, {
              onSuccess: () => {
                setStatus("success");
                queryClient.invalidateQueries({ queryKey: ["waitlist-count"] });
                queryClient.invalidateQueries({ queryKey: ["waitlist-referral"] });
                trackJoin(true);
              },
              onError: () => setStatus("error"),
            });
          }}
          disabled={joinMutation.isPending}
          className="w-full rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {joinMutation.isPending ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            "Iscriviti alla waitlist"
          )}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600 text-center">
            Si è verificato un errore. Riprova.
          </p>
        )}
      </div>
    );
  }

  // --- Post-iscrizione anonima ---
  if (status === "success") {
    return (
      <div className="text-center space-y-3 py-4">
        <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600" />
        <p className="text-sm font-medium text-slate-700">
          Sei in lista! Ti avviseremo via email quando PRO sarà disponibile.
        </p>
        <p className="text-sm text-slate-600">
          Crea un account per ottenere il tuo link referral e saltare in coda.
        </p>
      </div>
    );
  }

  if (status === "already_in_waitlist") {
    return (
      <div className="text-center space-y-2 py-4">
        <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600" />
        <p className="text-sm font-medium text-slate-700">
          Sei già in lista! Accedi per gestire la tua iscrizione.
        </p>
      </div>
    );
  }

  if (status === "already_registered") {
    return (
      <div className="text-center space-y-2 py-4">
        <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600" />
        <p className="text-sm font-medium text-slate-700">
          Questa email è già registrata.
        </p>
      </div>
    );
  }

  // --- Path anonimo: form email + consenso ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmedEmail = email.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Email non valida");
      return;
    }
    setEmailError("");
    if (!consent) return;

    setStatus("submitting");

    try {
      const { data, error } = await supabase.rpc("join_waitlist_lead" as any, {
        p_email: trimmedEmail,
        p_source: "pro-presto",
        p_consent_text: PRO_WAITLIST_CONSENT_TEXT,
        p_source_detail: window.location.search || null,
        p_referred_by_token: referredByToken || null,
      });

      if (error) {
        setStatus("error");
        return;
      }

      const result = data as { success: boolean; reason?: string };

      if (result.success) {
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["waitlist-count"] });
        trackJoin(false);
      } else if (result.reason === "already_in_waitlist") {
        setStatus("already_in_waitlist");
      } else if (result.reason === "already_registered") {
        setStatus("already_registered");
      } else if (result.reason === "rate_limited") {
        setStatus("rate_limited");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          placeholder="La tua email"
          aria-label="Indirizzo email"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
        {emailError && (
          <p className="mt-1 text-sm text-red-600">{emailError}</p>
        )}
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="text-sm leading-snug text-slate-600">
          {PRO_WAITLIST_CONSENT_TEXT}
        </span>
      </label>

      <button
        type="submit"
        disabled={status === "submitting" || !consent}
        className="w-full rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
      >
        {status === "submitting" ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : (
          "Iscriviti alla waitlist"
        )}
      </button>

      {status === "rate_limited" && (
        <p className="text-sm text-red-600 text-center">
          Troppe richieste, riprova tra qualche minuto.
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600 text-center">
          Si è verificato un errore. Riprova.
        </p>
      )}
    </form>
  );
}

function trackJoin(authenticated: boolean) {
  if (isPosthogReady) {
    try {
      posthog.capture("pro_teaser_waitlist_joined", { authenticated });
    } catch {
      // fail-silent
    }
  }
}
