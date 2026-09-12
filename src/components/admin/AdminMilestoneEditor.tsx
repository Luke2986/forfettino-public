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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminUpdateMilestone, useAdminCreateMilestone, type AdminMilestone } from "@/hooks/useAdminMilestones";
import { REWARD_TYPE_LABELS } from "@/lib/contribution-helpers";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AdminMilestoneEditorProps {
  milestone: AdminMilestone | null; // null = create mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminMilestoneEditor({
  milestone,
  open,
  onOpenChange,
}: AdminMilestoneEditorProps) {
  const isEdit = milestone !== null;

  const [name, setName] = useState(milestone?.name ?? "");
  const [level, setLevel] = useState(String(milestone?.level ?? 1));
  const [pointsRequired, setPointsRequired] = useState(
    String(milestone?.pointsRequired ?? 100),
  );
  const [rewardType, setRewardType] = useState(milestone?.rewardType ?? "badge");
  const [rewardLabel, setRewardLabel] = useState(milestone?.rewardLabel ?? "");
  const [isActive, setIsActive] = useState(milestone?.isActive ?? true);

  const updateMutation = useAdminUpdateMilestone();
  const createMutation = useAdminCreateMilestone();
  const { toast } = useToast();

  const isPending = updateMutation.isPending || createMutation.isPending;

  const handleSave = () => {
    const levelNum = parseInt(level, 10);
    const pointsNum = parseInt(pointsRequired, 10);

    if (!name.trim() || isNaN(levelNum) || isNaN(pointsNum) || pointsNum <= 0) {
      toast({
        title: "Dati non validi",
        description: "Compila tutti i campi correttamente.",
        variant: "destructive",
      });
      return;
    }

    const onSuccess = () => {
      toast({ title: isEdit ? "Traguardo aggiornato" : "Traguardo creato" });
      onOpenChange(false);
    };
    const onError = (err: Error) => {
      toast({
        title: "Errore",
        description: err.message ?? "Operazione fallita",
        variant: "destructive",
      });
    };

    if (isEdit) {
      updateMutation.mutate(
        {
          id: milestone.id,
          name: name.trim(),
          pointsRequired: pointsNum,
          rewardType,
          rewardLabel: rewardLabel.trim(),
          isActive,
        },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(
        {
          level: levelNum,
          name: name.trim(),
          pointsRequired: pointsNum,
          rewardType,
          rewardLabel: rewardLabel.trim(),
        },
        { onSuccess, onError },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifica Traguardo" : "Nuovo Traguardo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-level">Livello</Label>
              <Input
                id="milestone-level"
                type="number"
                min={1}
                max={99}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milestone-points">Punti richiesti</Label>
              <Input
                id="milestone-points"
                type="number"
                min={1}
                value={pointsRequired}
                onChange={(e) => setPointsRequired(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-name">Nome</Label>
            <Input
              id="milestone-name"
              placeholder="es. Supporter, Champion..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-reward-type">Tipo premio</Label>
            <Select value={rewardType} onValueChange={setRewardType}>
              <SelectTrigger id="milestone-reward-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REWARD_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-reward-label">Etichetta premio</Label>
            <Input
              id="milestone-reward-label"
              placeholder="es. Badge Supporter, 3 mesi Pro gratis"
              value={rewardLabel}
              onChange={(e) => setRewardLabel(e.target.value)}
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch
                id="milestone-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="milestone-active">Attivo</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "Salva" : "Crea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
