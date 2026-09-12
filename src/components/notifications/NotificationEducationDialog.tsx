import { useState, useEffect } from "react";
import { Bell, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "forfettino:notification-education-dismissed";

/**
 * Pop-up modale educativo one-time che informa gli utenti
 * dell'esistenza delle notifiche in-app e invita al feedback.
 * Appare una sola volta (flag in localStorage).
 */
export function NotificationEducationDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  }

  function handleGoToSettings() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
    navigate("/impostazioni");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <Bell className="h-6 w-6 text-teal-600 animate-pulse" />
          </div>
          <DialogTitle className="text-center">
            Notifiche In-App Attive
          </DialogTitle>
          <DialogDescription className="text-center">
            Forfettino ti avvisa direttamente nell'app quando ci sono
            aggiornamenti importanti o scadenze in arrivo. Trovi tutto
            cliccando la campanella in alto.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground text-center">
          Puoi gestire le tue preferenze di notifica in qualsiasi momento
          dalle Impostazioni. Il tuo feedback ci aiuta a migliorare —
          scrivici cosa ne pensi!
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleDismiss} className="w-full">
            Ho capito!
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoToSettings}
            className="w-full text-muted-foreground"
          >
            <Settings className="mr-2 h-4 w-4" />
            Gestisci preferenze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
