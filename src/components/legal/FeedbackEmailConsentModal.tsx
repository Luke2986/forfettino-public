import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFeedbackEmailConsent } from "@/hooks/useFeedbackEmailConsent";
import { useUpdateProfile } from "@/hooks/useProfile";

/**
 * Modal non bloccante per consenso email feedback (Story 14.6, GDPR Art. 7).
 *
 * - Mostrato SOLO nella Dashboard dopo un ritardo (delayMs, default 80s)
 * - Chiudibile con X, Escape, click outside → riappare al prossimo login
 * - "Sì, contattami" → feedback_email_consent = true + timestamp
 * - "No, grazie" → feedback_email_consent = false + timestamp
 * - Nessun checkbox obbligatorio (opt-in facoltativo, GDPR Art. 7)
 */
export function FeedbackEmailConsentModal({ delayMs = 80_000 }: { delayMs?: number }) {
  const { needsEmailConsent } = useFeedbackEmailConsent();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (!needsEmailConsent) return;
    const timer = setTimeout(() => setDelayElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [needsEmailConsent, delayMs]);

  if (!needsEmailConsent || !open || !delayElapsed) return null;

  const handleResponse = (consent: boolean) => {
    updateProfile.mutate(
      {
        feedback_email_consent: consent,
        feedback_email_consent_at: new Date().toISOString(),
      },
      {
        onError: () => {
          toast({
            title: "Errore",
            description: "Impossibile salvare la preferenza email. Riprova.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) setOpen(false); }}>
      <DialogContent
        aria-label="Consenso email per sondaggi e miglioramento"
        className="max-w-[calc(100%-32px)] sm:max-w-md"
      >
        {/* Header: icona + titolo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-lg font-semibold leading-none tracking-tight text-center">
            Vuoi ricevere email da noi?
          </DialogTitle>
        </div>

        <DialogDescription className="text-sm text-muted-foreground text-center">
          Occasionalmente inviamo sondaggi e richieste di feedback per migliorare Forfettino.
          Massimo 1 email al mese, nessuno spam. Puoi cambiare idea in qualsiasi momento dalle Impostazioni.
        </DialogDescription>

        {/* Bottoni SI/NO */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => handleResponse(true)}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? "Salvataggio..." : "Sì, contattami"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResponse(false)}
            disabled={updateProfile.isPending}
          >
            No, grazie
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
