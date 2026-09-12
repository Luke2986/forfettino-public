import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useProWaitlist, PRO_WAITLIST_CONSENT_TEXT } from "@/hooks/useProWaitlist";

/**
 * Dialog di consenso GDPR per iscrizione alla waitlist Pro.
 * Checkbox obbligatorio (opt-in attivo), link privacy policy, testo consenso salvato nel DB.
 */
export function ProWaitlistConsentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const { join } = useProWaitlist();
  const { toast } = useToast();

  const handleJoin = () => {
    join.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Iscrizione confermata",
          description: "Ti avviseremo quando Pro sarà disponibile.",
        });
        onOpenChange(false);
        setAccepted(false);
      },
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile completare l'iscrizione. Riprova.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setAccepted(false); onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50">
            <Bell className="h-6 w-6 text-sky-600" />
          </div>
          <DialogTitle className="text-lg font-semibold text-center">
            Vuoi essere avvisato al lancio di Pro?
          </DialogTitle>
        </div>

        <DialogDescription className="text-sm text-muted-foreground text-center">
          Ti invieremo una sola email quando la versione Pro sarà disponibile.
          Nessuno spam, mai. Puoi revocare il consenso in qualsiasi momento dalle Impostazioni.
        </DialogDescription>

        {/* Checkbox consenso esplicito — GDPR Art. 7 */}
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            id="waitlist-consent"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
          />
          <label htmlFor="waitlist-consent" className="text-sm text-slate-700 leading-snug cursor-pointer">
            {PRO_WAITLIST_CONSENT_TEXT}{" "}
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 underline underline-offset-2 hover:text-sky-700"
            >
              Informativa Privacy
            </a>
          </label>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={handleJoin}
            disabled={!accepted || join.isPending}
          >
            {join.isPending ? "Iscrizione in corso..." : "Avvisami al lancio"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={join.isPending}
          >
            No, grazie
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
