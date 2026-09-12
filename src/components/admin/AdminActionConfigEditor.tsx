import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminUpdateActionConfig } from "@/hooks/useActionConfig";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { ActionConfig } from "@/lib/contribution-helpers";

interface AdminActionConfigEditorProps {
  config: ActionConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminActionConfigEditor({
  config,
  open,
  onOpenChange,
}: AdminActionConfigEditorProps) {
  const [points, setPoints] = useState(String(config.points));
  const [label, setLabel] = useState(config.label);
  const [frequencyLabel, setFrequencyLabel] = useState(config.frequencyLabel);

  const updateMutation = useAdminUpdateActionConfig();
  const { toast } = useToast();

  const handleSave = () => {
    const pointsNum = parseInt(points, 10);

    if (!label.trim() || isNaN(pointsNum) || pointsNum <= 0) {
      toast({
        title: "Dati non validi",
        description: "Compila tutti i campi correttamente.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate(
      {
        actionType: config.actionType,
        points: pointsNum,
        label: label.trim(),
        frequencyLabel: frequencyLabel.trim(),
      },
      {
        onSuccess: () => {
          toast({ title: "Configurazione aggiornata" });
          onOpenChange(false);
        },
        onError: (err: Error) => {
          toast({
            title: "Errore",
            description: err.message ?? "Impossibile aggiornare",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica Azione</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo azione</Label>
            <p className="text-sm font-mono bg-slate-50 px-3 py-2 rounded-md">
              {config.actionType}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="config-points">Punti</Label>
            <Input
              id="config-points"
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="config-label">Etichetta</Label>
            <Input
              id="config-label"
              placeholder="es. Call completata"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="config-frequency">Frequenza</Label>
            <Input
              id="config-frequency"
              placeholder="es. ogni call, una tantum"
              value={frequencyLabel}
              onChange={(e) => setFrequencyLabel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            )}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
