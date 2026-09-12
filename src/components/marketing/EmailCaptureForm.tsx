import { useState, useEffect, useRef } from "react";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { posthog, isPosthogReady } from "@/lib/posthog";
import { cn } from "@/lib/utils";

type FormSource = "landing" | "blog" | "footer" | "calcolatore" | "other";
type LeadMagnet = "guida_protezione" | "scadenziario_2026" | "simulatore_acconti_2026";
type FormVariant = "inline" | "hero" | "footer";
type FormStatus = "idle" | "submitting" | "success" | "already_subscribed" | "error";

interface EmailCaptureFormProps {
  source: FormSource;
  sourceDetail?: string;
  leadMagnet?: LeadMagnet;
  variant: FormVariant;
  headline?: string;
  subtext?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CTA_TEXT: Record<string, string> = {
  guida_protezione: "Scarica la Guida Protezione",
  scadenziario_2026: "Scarica lo Scadenziario 2026",
  simulatore_acconti_2026: "Scarica il Simulatore Excel",
};

export function EmailCaptureForm({
  source,
  sourceDetail,
  leadMagnet,
  variant,
  headline,
  subtext,
}: EmailCaptureFormProps) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [emailError, setEmailError] = useState("");
  const viewedRef = useRef(false);

  // Track form viewed (once per mount)
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    if (isPosthogReady) {
      try {
        posthog.capture("newsletter_form_viewed", { source, leadMagnet });
      } catch {
        // fail-silent
      }
    }
  }, [source, leadMagnet]);

  const ctaText = leadMagnet ? CTA_TEXT[leadMagnet] : "Iscriviti";

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
      // 1. Call RPC
      const { data, error: rpcError } = await supabase.rpc(
        "subscribe_to_newsletter" as any,
        {
          p_email: trimmedEmail,
          p_source: source,
          p_source_detail: sourceDetail || null,
          p_lead_magnet: leadMagnet || null,
        }
      );

      if (rpcError) {
        console.error("RPC error:", rpcError);
        setStatus("error");
        return;
      }

      const result = data as any;
      if (result?.success === false) {
        setStatus("already_subscribed");
        return;
      }

      // 2. Call Edge Function to send confirmation email
      const { error: fnError } = await supabase.functions.invoke(
        "send-newsletter-confirmation",
        { body: { email: trimmedEmail, lead_magnet: leadMagnet || null } }
      );

      if (fnError) {
        console.error("Edge Function error:", fnError);
        setStatus("error");
        return;
      }

      // Track successful submission (after both RPC + Edge Function succeeded)
      if (isPosthogReady) {
        try {
          posthog.capture("newsletter_form_submitted", { source, leadMagnet });
        } catch {
          // fail-silent
        }
      }

      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  // --- Success state ---
  if (status === "success") {
    return (
      <div className={cn(wrapperClass(variant), "text-center")}>
        <Mail className={cn("mx-auto mb-3 h-10 w-10", variant === "inline" ? "text-teal-600 dark:text-teal-400" : "text-teal-400")} />
        <p className={cn("text-sm font-medium", variant === "inline" ? "text-slate-700 dark:text-white/90" : "text-white/90")}>
          Controlla la tua email per confermare l'iscrizione e scaricare il contenuto.
        </p>
      </div>
    );
  }

  // --- Already subscribed state ---
  if (status === "already_subscribed") {
    return (
      <div className={cn(wrapperClass(variant), "text-center")}>
        <Mail className={cn("mx-auto mb-3 h-10 w-10", variant === "inline" ? "text-teal-600 dark:text-teal-400" : "text-teal-400")} />
        <p className={cn("text-sm font-medium", variant === "inline" ? "text-slate-700 dark:text-white/90" : "text-white/90")}>
          Questa email è già iscritta. Controlla la tua casella per il link di conferma.
        </p>
      </div>
    );
  }

  return (
    <div className={wrapperClass(variant)}>
      {headline && (
        <h3
          className={cn(
            "text-lg font-bold leading-tight sm:text-xl",
            variant === "inline" ? "text-slate-900 dark:text-white" : "text-white"
          )}
        >
          {headline}
        </h3>
      )}
      {subtext && (
        <p
          className={cn(
            "text-sm",
            variant === "inline" ? "text-slate-600 dark:text-white/70" : "text-white/70"
          )}
        >
          {subtext}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Email + CTA row on footer variant, stacked otherwise */}
        <div className={cn(variant === "footer" ? "flex gap-2 items-start" : "space-y-3")}>
          <div className={cn(variant === "footer" && "flex-1")}>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              placeholder="La tua email"
              aria-label="Indirizzo email"
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm outline-none transition",
                variant === "inline"
                  ? "border border-slate-300 bg-white text-slate-900 placeholder:text-slate-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/70 dark:focus:border-white/30 dark:focus:ring-white/30"
                  : "border border-white/10 bg-white/10 text-white placeholder:text-white/70 focus:border-white/30 focus:ring-1 focus:ring-white/30"
              )}
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-500">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "submitting" || !consent}
            className={cn(
              "rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50",
              variant === "inline"
                ? "bg-teal-600 text-white hover:bg-teal-700 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                : "bg-white text-slate-900 hover:bg-white/90",
              variant === "footer" ? "shrink-0" : "w-full"
            )}
          >
            {status === "submitting" ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              ctaText
            )}
          </button>
        </div>

        {/* Consent checkbox */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span
            className={cn(
              "text-sm leading-snug",
              variant === "inline" ? "text-slate-500 dark:text-white/60" : "text-white/60"
            )}
          >
            Acconsento a ricevere email da Forfettino — posso disiscrivermi in qualsiasi momento
          </span>
        </label>

        {/* Error state */}
        {status === "error" && (
          <p className="text-sm text-red-500">
            Si è verificato un errore. Riprova.
          </p>
        )}
      </form>
    </div>
  );
}

function wrapperClass(variant: FormVariant): string {
  switch (variant) {
    case "hero":
      return "mx-auto max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8";
    case "inline":
      return "mx-auto max-w-lg space-y-4 rounded-2xl border border-teal-200/40 bg-teal-50/50 p-6 sm:p-8 dark:border-white/10 dark:bg-white/5";
    case "footer":
      return "mx-auto max-w-lg space-y-3 p-4";
  }
}
