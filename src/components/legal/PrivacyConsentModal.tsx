import { useState } from "react";
import { Shield, ExternalLink } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrivacyConsent } from "@/hooks/usePrivacyConsent";

/**
 * Modal bloccante per consenso Privacy Policy e ToS (Story 35.2, GDPR Art. 7).
 *
 * - Non chiudibile: no escape, no click outside
 * - Priorità assoluta: renderizzato PRIMA del BlockingModal FIFO
 * - Checkbox obbligatorio per abilitare il bottone "Accetta e continua"
 * - Accessibilità: role="alertdialog", aria-modal, focus trap
 */
export function PrivacyConsentModal() {
  const { needsConsent, isFirstTime, acceptConsent, isPending } = usePrivacyConsent();
  const [checked, setChecked] = useState(false);

  if (!needsConsent) return null;

  return (
    <Dialog open={true}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60" />
        <DialogPrimitive.Content
          role="alertdialog"
          aria-modal="true"
          aria-label="Accettazione Privacy Policy e Termini di Servizio"
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%]",
            "max-w-[calc(100%-32px)] sm:max-w-md",
            "gap-4 border bg-background p-6 shadow-lg rounded-xl",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          )}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Header: icona + titolo */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
              <Shield className="h-6 w-6 text-teal-600" />
            </div>
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight text-center">
              Privacy Policy e Termini di Servizio
            </DialogPrimitive.Title>
          </div>

          {/* Body — DialogPrimitive.Description: Radix auto-linka aria-describedby su Content */}
          <DialogPrimitive.Description asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {isFirstTime ? (
                <p>
                  Benvenuto! Prima di iniziare ad utilizzare Forfettino, ti chiediamo di leggere e accettare
                  la nostra Privacy Policy e i Termini di Servizio.
                </p>
              ) : (
                <p>
                  Abbiamo aggiornato la nostra Privacy Policy e/o i Termini di Servizio.
                  Ti chiediamo di leggere le modifiche e accettare la versione aggiornata per continuare.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium"
                >
                  Leggi la Privacy Policy <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium"
                >
                  Leggi i Termini di Servizio <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </DialogPrimitive.Description>

          {/* Checkbox + Button */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="privacy-consent-checkbox"
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                aria-label="Ho letto e accetto la Privacy Policy e i Termini di Servizio"
              />
              <label
                htmlFor="privacy-consent-checkbox"
                className="text-sm leading-tight cursor-pointer select-none"
              >
                Ho letto e accetto la Privacy Policy e i Termini di Servizio
              </label>
            </div>

            <Button
              className="w-full"
              disabled={!checked || isPending}
              onClick={() => acceptConsent()}
            >
              {isPending ? "Salvataggio..." : "Accetta e continua"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
